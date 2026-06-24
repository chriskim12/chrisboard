import { describe, expect, it } from 'vitest';
import type { WorkNode } from '../domain/worknode';
import { deriveCompletionDepth, readOnlyGateIssues, relationshipIssues, sourceConflicts } from './worknodeJudgement';

const baseNode: WorkNode = {
  id: 'base',
  kind: 'ParentGoal',
  title: 'Base parent',
  canonicalStatus: 'DOING',
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

  it('keeps standalone tasks out of fake parents', () => {
    const standalone: WorkNode = { ...baseNode, id: 'solo', kind: 'StandaloneTask', parentGoalId: 'fake' };
    expect(relationshipIssues([standalone])).toContain('solo: StandaloneTask must not be forced under a fake parent');
  });

  it('flags source disagreement without mutating sources', () => {
    expect(sourceConflicts([
      { source: 'GJC', state: 'blocked', confidence: 'high', details: 'runner stopped' },
      { source: 'Kanban', state: 'running', confidence: 'medium', details: 'stale card' },
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
});
