import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateAnchorRegistry } from './anchorRegistry.mjs';
import { buildGoalContracts, validateGoalContract } from './goalContracts.mjs';
import { buildIdentityGraph, validateIdentityNode } from './identityGraph.mjs';
import { assertAllowedSourcePath } from './pathAllowlist.mjs';
import { reconcileAnchor } from './reconcileWorkNodes.mjs';
import { createObservation, validateSourceRecord } from './sourceObservation.mjs';
import { isAllowedLocalRepoName, isAllowedLocalWorktreeName, localRepoDiscoveryNames, localWorktreeDiscoveryPrefixes } from './sourceInventory.mjs';
import { validateTriageEntry } from './triageReader.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function observationsFromFixture(path, worknodeId = 'fixture-node') {
  const fixture = readJson(path);
  return fixture.observations.map((observation, index) => createObservation({
    id: `${worknodeId}:${index}:${observation.observationType}`,
    worknodeId,
    sourceKind: observation.sourceKind ?? 'GJC',
    sourcePath: path,
    sourcePathLabel: `repo:${path}`,
    observedAt: observation.observedAt ?? '2026-06-25T00:00:00.000Z',
    observationType: observation.observationType,
    strength: observation.strength,
    confidence: observation.confidence,
    summary: observation.summary,
    redaction: observation.redaction ?? 'redacted',
  }));
}

const anchor = { id: 'fixture-node', title: 'Fixture node', kind: 'StandaloneTask', evidence_paths: ['README.md'] };
function contractFor(anchorValue, observations) {
  const [identityNode] = buildIdentityGraph([anchorValue], observations);
  const [goalContract] = buildGoalContracts([identityNode], observations);
  return { identityNode, goalContract };
}

const sourceRecord = {
  sourceId: 'repo_root:test',
  sourceKind: 'Git',
  allowlistedPath: 'repo:.',
  browserLabel: 'Current Chrisboard worktree',
  discoveredAt: '2026-06-25T00:00:00.000Z',
  discoveryMode: 'configured',
  fingerprint: 'abc123',
  redaction: 'redacted',
  freshnessTtl: 'PT24H',
};

describe('source-backed read model pipeline', () => {
  it('rejects forbidden truth fields in anchors', () => {
    expect(() => validateAnchorRegistry(readJson('scripts/read-model/fixtures/fixture-anchor-forbidden-status.json'))).toThrow('forbidden anchor truth/status field');
  });

  it('rejects source paths outside the Chrisboard allowlist', () => {
    const fixture = readJson('scripts/read-model/fixtures/fixture-source-path-outside-allowlist.json');
    expect(() => assertAllowedSourcePath(fixture.path)).toThrow('outside the Chrisboard allowlist');
  });
  it('validates SourceRecord schema for approved source inventory', () => {
    expect(validateSourceRecord(sourceRecord).sourceId).toBe('repo_root:test');
    expect(() => validateSourceRecord({ ...sourceRecord, discoveryMode: 'broad_scan' })).toThrow('discoveryMode is invalid');
  });

  it('builds identity graph and goal contract records without status truth', () => {
    const observations = observationsFromFixture('scripts/read-model/fixtures/fixture-landed-not-done.json');
    const [identityNode] = buildIdentityGraph([anchor], observations);
    expect(validateIdentityNode(identityNode).canonicalId).toBe(anchor.id);
    expect(identityNode.mappingStatus).toBe('mapped');
    expect(JSON.stringify(identityNode)).not.toContain('canonicalStatus');
    const [goalContract] = buildGoalContracts([identityNode], observations);
    expect(validateGoalContract(goalContract).canonicalId).toBe(anchor.id);
    expect(goalContract.originalGoal).toContain('WorkNode operational SSOT');
    expect(goalContract.scopeReductions[0].approvedByChris).toBe(false);
  });

  it('keeps weak title similarity as separate identity nodes', () => {
    const anchors = [
      { id: 'one', title: 'DailyChingu paid ads cleanup', kind: 'StandaloneTask', evidence_paths: ['README.md'] },
      { id: 'two', title: 'DailyChingu paid ads cleanups', kind: 'StandaloneTask', evidence_paths: ['README.md'] },
    ];
    const identityNodes = buildIdentityGraph(anchors, []);
    expect(identityNodes).toHaveLength(2);
    expect(identityNodes.map((node) => node.canonicalId).sort()).toEqual(['one', 'two']);
    expect(identityNodes.every((node) => node.mappingStatus === 'needs_mapping')).toBe(true);
  });

  it('marks exact identity collisions as conflicts instead of merging them', () => {
    const anchors = [
      { id: 'one', title: 'Same title', kind: 'StandaloneTask', evidence_paths: ['README.md'] },
      { id: 'two', title: 'Same title', kind: 'StandaloneTask', evidence_paths: ['README.md'] },
    ];
    const identityNodes = buildIdentityGraph(anchors, []);
    expect(identityNodes.map((node) => node.mappingStatus)).toEqual(['conflict', 'conflict']);
  });

  it('uses configurable conservative local repo and worktree allowlists', () => {
    const originalRepoNames = process.env.CHRISBOARD_LOCAL_REPO_NAMES;
    const originalWorktreePrefixes = process.env.CHRISBOARD_LOCAL_WORKTREE_PREFIXES;
    try {
      expect(localRepoDiscoveryNames()).toEqual(['chrisboard', 'clawhip', 'dailychingu', 'oh-my-codex', 'whystarve']);
      expect(localWorktreeDiscoveryPrefixes()).toEqual(['chrisboard', 'clawhip', 'dailychingu', 'hermes-core-workflows', 'oh-my-codex', 'whystarve']);
      expect(isAllowedLocalRepoName('dailychingu')).toBe(true);
      expect(isAllowedLocalRepoName('dailychingu-paid-ads-timeframes-clone')).toBe(false);
      expect(isAllowedLocalWorktreeName('chrisboard-gjc-ultragoal-20260625T132628Z', ['chrisboard'])).toBe(true);
      expect(isAllowedLocalWorktreeName('chrisboardevil', ['chrisboard'])).toBe(false);

      process.env.CHRISBOARD_LOCAL_REPO_NAMES = 'dailychingu, whystarve, ../secrets, dailychingu';
      process.env.CHRISBOARD_LOCAL_WORKTREE_PREFIXES = 'hermes-core-workflows, clawhip, /tmp/bad';
      expect(localRepoDiscoveryNames()).toEqual(['dailychingu', 'whystarve']);
      expect(localWorktreeDiscoveryPrefixes()).toEqual(['clawhip', 'hermes-core-workflows']);
    } finally {
      if (originalRepoNames === undefined) delete process.env.CHRISBOARD_LOCAL_REPO_NAMES;
      else process.env.CHRISBOARD_LOCAL_REPO_NAMES = originalRepoNames;
      if (originalWorktreePrefixes === undefined) delete process.env.CHRISBOARD_LOCAL_WORKTREE_PREFIXES;
      else process.env.CHRISBOARD_LOCAL_WORKTREE_PREFIXES = originalWorktreePrefixes;
    }
  });


  it('maps LANDED without final proof to LANDED, not DONE', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-landed-not-done.json'));
    expect(node.canonicalStatus).toBe('LANDED');
    expect(node.canonicalStatus).not.toBe('DONE');
  });

  it('keeps self-report-only evidence in REVIEW, never DONE', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-self-report-only.json'));
    expect(node.canonicalStatus).toBe('REVIEW');
    expect(node.canonicalStatus).not.toBe('DONE');
  });

  it('fails reader errors closed to BLOCKED', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-reader-error-blocked.json'));
    expect(node.canonicalStatus).toBe('BLOCKED');
    expect(node.conflicts[0].kind).toBe('evidence_missing');
  });

  it('surfaces dirty and unpushed evidence as RESIDUE', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-residue-dirty-worktree.json'));
    expect(node.canonicalStatus).toBe('RESIDUE');
    expect(node.residueState.hasResidue).toBe(true);
  });

  it('requires final proof, goal contract, and parent acceptance for DONE', () => {
    const observations = observationsFromFixture('scripts/read-model/fixtures/fixture-parent-accepted-final-proof.json');
    const { identityNode, goalContract } = contractFor(anchor, observations);
    const node = reconcileAnchor(anchor, observations, [], { identityNode, goalContract });
    expect(node.canonicalStatus).toBe('DONE');
    expect(node.completionDepth).toBe('parent_done');
  });

  it('does not allow final proof to produce DONE without a goal contract', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-parent-accepted-final-proof.json'));
    expect(node.canonicalStatus).not.toBe('DONE');
    expect(node.policyDecision?.missingEvidence).toContain('goal contract with Done criteria, non-done rules, and scope reduction accounting');
  });
  it('validates every TRIAGE writer field and rejects forbidden fields', () => {
    const [line] = readFileSync('scripts/read-model/fixtures/fixture-triage-raw-entry.jsonl', 'utf8').trim().split('\n');
    const entry = JSON.parse(line);
    expect(validateTriageEntry(entry).id).toBe('triage-fixture-001');
    expect(() => validateTriageEntry({ ...entry, canonicalStatus: 'DONE' })).toThrow('forbidden field canonicalStatus');
    expect(() => validateTriageEntry({ ...entry, source: { type: 'session', url: 'https://example.invalid' } })).toThrow('forbidden source field url');
  });

  it('enforces browser provenance redaction fixture', () => {
    const fixture = readJson('scripts/read-model/fixtures/fixture-browser-provenance-redaction.json');
    const generated = readFileSync('src/data/worknodes.generated.json', 'utf8');
    for (const forbidden of fixture.forbiddenBrowserSubstrings) {
      expect(generated).not.toContain(forbidden);
    }
    const nodes = JSON.parse(generated);
    expect(nodes.every((node) => node.evidenceLinks.every((link) => link.redacted === true))).toBe(true);
  });
  it('emits browser-safe SourceRecord and Observation projections', () => {
    const sourceRecords = readFileSync('src/data/source-records.generated.json', 'utf8');
    const observations = readFileSync('src/data/observations.generated.json', 'utf8');
    expect(sourceRecords).not.toContain('/home/ubuntu/');
    expect(observations).not.toContain('/home/ubuntu/');
    expect(observations).not.toContain('rawExcerpt');
    expect(JSON.parse(sourceRecords).length).toBeGreaterThan(0);
    expect(JSON.parse(observations).length).toBeGreaterThan(0);
  });
  it('emits identity graph and goal contract projections', () => {
    const identityGraph = JSON.parse(readFileSync('src/data/identity-graph.generated.json', 'utf8'));
    const goalContracts = JSON.parse(readFileSync('src/data/goal-contracts.generated.json', 'utf8'));
    expect(identityGraph.length).toBeGreaterThan(0);
    expect(goalContracts.length).toBeGreaterThan(0);
    expect(goalContracts.every((contract) => contract.scopeReductions.some((reduction) => reduction.approvedByChris === false))).toBe(true);
  });
});
