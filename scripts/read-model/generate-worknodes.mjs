import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadAnchorRegistry } from './anchorRegistry.mjs';
import { readGitObservations } from './gitReader.mjs';
import { readGjcObservations } from './gjcReader.mjs';
import { readOmhObservations } from './omhReader.mjs';
import { isBrowserSafePathLabel } from './pathAllowlist.mjs';
import { reconcileWorkNodes } from './reconcileWorkNodes.mjs';
import { readTriageDynamicAnchors, readTriageObservations } from './triageReader.mjs';

const GENERATED_DATA = 'src/data/worknodes.generated.json';
const PROVENANCE_DATA = 'src/data/worknodes.provenance.json';

function hashObservation(observation) {
  return createHash('sha256')
    .update(JSON.stringify({
      worknodeId: observation.worknodeId,
      sourceKind: observation.sourceKind,
      sourcePath: observation.sourcePath,
      observationType: observation.observationType,
      summary: observation.summary,
    }))
    .digest('hex');
}

function assertBrowserSafe(nodes) {
  for (const node of nodes) {
    for (const link of node.evidenceLinks) {
      if (!link.redacted) throw new Error(`${node.id}: generated evidence must be redacted`);
      if (link.localPath && !isBrowserSafePathLabel(link.localPath)) throw new Error(`${node.id}: unsafe browser source label ${link.localPath}`);
    }
    for (const label of node.browserProvenance?.redactedPathLabels ?? []) {
      if (!isBrowserSafePathLabel(label)) throw new Error(`${node.id}: unsafe browser provenance label ${label}`);
    }
    if (JSON.stringify(node).includes('/home/ubuntu/')) {
      throw new Error(`${node.id}: browser generated data contains an absolute local path`);
    }
  }
}

function isFixturePath(path) {
  return String(path).includes('scripts/read-model/fixtures/');
}

function hasNonFixtureEvidence(anchor) {
  return (anchor.evidence_paths ?? []).some((path) => !isFixturePath(path));
}

export function generateWorkNodes({ observedAt = new Date().toISOString() } = {}) {
  const registry = loadAnchorRegistry();
  const dynamicTriageAnchors = readTriageDynamicAnchors();
  const anchors = [...registry.anchors, ...dynamicTriageAnchors].filter(hasNonFixtureEvidence);
  const observations = anchors.flatMap((anchor) => [
    ...readOmhObservations(anchor, observedAt),
    ...readGjcObservations(anchor, observedAt),
    ...readGitObservations(anchor, observedAt),
    ...readTriageObservations(anchor, observedAt),
  ]);

  const nodes = reconcileWorkNodes(anchors, observations);
  assertBrowserSafe(nodes);

  const provenance = {
    schema: 'chrisboard.worknodes.provenance.v1',
    generatedAt: observedAt,
    generator: 'scripts/read-model/generate-worknodes.mjs',
    anchorRegistry: 'src/read-model/anchors/worknode-anchors.json',
    generatedData: GENERATED_DATA,
    observationCount: observations.length,
    sourcePaths: observations.map((observation) => ({
      worknodeId: observation.worknodeId,
      sourceKind: observation.sourceKind,
      sourcePath: observation.sourcePath,
      sourcePathLabel: observation.sourcePathLabel,
      observationType: observation.observationType,
      redaction: observation.redaction,
      sha256: hashObservation(observation),
    })),
    browserRedaction: {
      absolutePathsInBrowserData: false,
      rawExcerptsInBrowserData: false,
      evidenceLinksRedacted: nodes.every((node) => node.evidenceLinks.every((link) => link.redacted === true)),
    },
  };

  mkdirSync(dirname(GENERATED_DATA), { recursive: true });
  writeFileSync(GENERATED_DATA, `${JSON.stringify(nodes, null, 2)}\n`);
  writeFileSync(PROVENANCE_DATA, `${JSON.stringify(provenance, null, 2)}\n`);
  return { nodes, provenance };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { nodes, provenance } = generateWorkNodes();
  console.log(JSON.stringify({ status: 'generated', nodes: nodes.length, observations: provenance.observationCount }, null, 2));
}
