import { describe, expect, it } from 'vitest';
import { loadReadOnlyWorkNodes, type ReadOnlyAdapter } from '../adapters/readOnlyAdapter';
import { parseWorkNodes, WORK_STATUSES, type WorkNode } from '../domain/worknode';
import { deriveCompletionDepth, readOnlyGateIssues, relationshipIssues, sourceConflicts } from './worknodeJudgement';

const baseNode: WorkNode = {
  id: 'base',
  kind: 'ParentGoal',
  title: 'Base parent',
  canonicalStatus: 'RUNNING',
  statusReason: 'testing',
  completionDepth: 'unknown',
  executorLane: 'unknown',
  executionState: 'unknown',
  evidenceLinks: [{ label: 'redacted plan', kind: 'plan', localPath: 'plan.md', redacted: true }],
  approvalGates: [],
  residueState: { hasResidue: false, summary: 'none', items: [] },
  sourceStates: [],
  conflicts: [],
};

describe('worknode judgement', () => {
  it('uses the source-backed board status vocabulary', () => {
    expect(WORK_STATUSES).toEqual(['TRIAGE', 'TODO', 'RUNNING', 'REVIEW', 'BLOCKED', 'LANDED', 'RESIDUE', 'DONE']);
    expect(WORK_STATUSES).not.toContain('DOING');
    expect(WORK_STATUSES).not.toContain('WAITING');
  });
  it('does not infer parent done from done children alone', () => {
    const child: WorkNode = { ...baseNode, id: 'child', kind: 'ChildWork', parentGoalId: 'base', canonicalStatus: 'DONE' };
    expect(deriveCompletionDepth(baseNode, [child])).toBe('parent_partial');
  });

  it('requires explicit parent acceptance for parent done', () => {
    const accepted: WorkNode = {
      ...baseNode,
      canonicalStatus: 'DONE',
      sourceStates: [{ source: 'tests', state: 'parent verified', confidence: 'high', details: 'acceptance receipt' }],
    };
    expect(deriveCompletionDepth(accepted, [])).toBe('parent_done');
  });
  it('recognizes generated parent acceptance states for completion depth', () => {
    const accepted: WorkNode = {
      ...baseNode,
      canonicalStatus: 'DONE',
      sourceStates: [
        { source: 'OMH', state: 'final_proof', confidence: 'high', details: 'final verifier receipt' },
        { source: 'OMH', state: 'parent_acceptance', confidence: 'high', details: 'parent acceptance receipt' },
      ],
    };
    expect(deriveCompletionDepth(accepted, [])).toBe('parent_done');
  });

  it('keeps standalone tasks out of fake parents', () => {
    const standalone: WorkNode = { ...baseNode, id: 'solo', kind: 'StandaloneTask', parentGoalId: 'fake' };
    expect(relationshipIssues([standalone])).toContain('solo: StandaloneTask must not be forced under a fake parent');
  });
  it('rejects child references to non-parent work nodes', () => {
    const standalone: WorkNode = { ...baseNode, id: 'solo', kind: 'StandaloneTask' };
    const child: WorkNode = { ...baseNode, id: 'child', kind: 'ChildWork', parentGoalId: 'solo' };
    expect(relationshipIssues([standalone, child])).toContain('child: ChildWork parentGoalId solo is not a ParentGoal');
  });


  it('flags source disagreement without mutating sources', () => {
    expect(sourceConflicts([
      { source: 'GJC', state: 'blocked', confidence: 'high', details: 'runner stopped' },
      { source: 'Spec', state: 'running', confidence: 'medium', details: 'stale external tracker card' },
    ])).toHaveLength(1);
  });

  it('flags unredacted evidence and incorrectly approved write gates', () => {
    const unsafe: WorkNode = {
      ...baseNode,
      id: 'unsafe',
      evidenceLinks: [{ label: 'raw local data', kind: 'artifact', localPath: 'secretish.txt', redacted: false }],
      approvalGates: [{ label: 'write', requiredBefore: 'write to remote', status: 'approved' }],
    };
    expect(readOnlyGateIssues([unsafe])).toEqual([
      'unsafe: write gate write is incorrectly approved in v1',
      'unsafe: evidence raw local data is not marked redacted',
    ]);
  });
  it('returns deep-cloned read-only adapter snapshots', async () => {
    const sourceNode: WorkNode = {
      ...baseNode,
      id: 'source',
      evidenceLinks: [{ label: 'redacted plan', kind: 'plan', localPath: 'plan.md', redacted: true }],
      residueState: { hasResidue: true, summary: 'source residue', items: ['original'] },
    };
    const adapter: ReadOnlyAdapter = {
      id: 'fixture',
      label: 'Fixture',
      mode: 'read-only',
      allowlistedSources: ['fixture.json'],
      async loadWorkNodes() {
        return [sourceNode];
      },
    };

    const [first] = await loadReadOnlyWorkNodes([adapter]);
    first.evidenceLinks[0].label = 'mutated';
    first.residueState.items.push('mutated');

    const [second] = await loadReadOnlyWorkNodes([adapter]);
    expect(second.evidenceLinks[0].label).toBe('redacted plan');
    expect(second.residueState.items).toEqual(['original']);
  });
  it('rejects malformed WorkNode data at the adapter boundary', () => {
    expect(() => parseWorkNodes([{ ...baseNode, kind: 'WrongKind' }])).toThrow('base: invalid kind');
    expect(() => parseWorkNodes([{ ...baseNode, evidenceLinks: [{ label: 'missing shape' }] }])).toThrow('base: invalid evidenceLinks');
  });
});
