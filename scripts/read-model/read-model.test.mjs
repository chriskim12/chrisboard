import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateAnchorRegistry } from './anchorRegistry.mjs';
import { assertAllowedSourcePath } from './pathAllowlist.mjs';
import { reconcileAnchor } from './reconcileWorkNodes.mjs';
import { createObservation } from './sourceObservation.mjs';
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

describe('source-backed read model pipeline', () => {
  it('rejects forbidden truth fields in anchors', () => {
    expect(() => validateAnchorRegistry(readJson('scripts/read-model/fixtures/fixture-anchor-forbidden-status.json'))).toThrow('forbidden anchor truth/status field');
  });

  it('rejects source paths outside the Chrisboard allowlist', () => {
    const fixture = readJson('scripts/read-model/fixtures/fixture-source-path-outside-allowlist.json');
    expect(() => assertAllowedSourcePath(fixture.path)).toThrow('outside the Chrisboard allowlist');
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

  it('requires final proof and parent acceptance for DONE', () => {
    const node = reconcileAnchor(anchor, observationsFromFixture('scripts/read-model/fixtures/fixture-parent-accepted-final-proof.json'));
    expect(node.canonicalStatus).toBe('DONE');
    expect(node.completionDepth).toBe('parent_done');
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
});
