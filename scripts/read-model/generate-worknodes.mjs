import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadAnchorRegistry } from './anchorRegistry.mjs';
import { readGitObservations } from './gitReader.mjs';
import { readGjcObservations } from './gjcReader.mjs';
import { readOmhObservations } from './omhReader.mjs';
import { buildGoalContracts } from './goalContracts.mjs';
import { browserSafeIdentityGraph, buildIdentityGraph } from './identityGraph.mjs';
import { isBrowserSafePathLabel } from './pathAllowlist.mjs';
import { reconcileWorkNodes } from './reconcileWorkNodes.mjs';
import { browserSafeSourceRecords, discoverSourceInventory } from './sourceInventory.mjs';
import { readTriageDynamicAnchors, readTriageObservations } from './triageReader.mjs';

const GENERATED_DATA = 'src/data/worknodes.generated.json';
const PROVENANCE_DATA = 'src/data/worknodes.provenance.json';
const SOURCE_RECORDS_DATA = 'src/data/source-records.generated.json';
const OBSERVATIONS_DATA = 'src/data/observations.generated.json';
const IDENTITY_GRAPH_DATA = 'src/data/identity-graph.generated.json';
const GOAL_CONTRACTS_DATA = 'src/data/goal-contracts.generated.json';

function hashObservation(observation) {
  return createHash('sha256')
    .update(JSON.stringify({
      observationId: observation.observationId,
      worknodeId: observation.worknodeId,
      candidateWorkNodeId: observation.candidateWorkNodeId,
      sourceId: observation.sourceId,
      sourceKind: observation.sourceKind,
      sourcePathLabel: observation.sourcePathLabel,
      observationType: observation.observationType,
      summary: observation.summary,
      strength: observation.strength,
      confidence: observation.confidence,
    }))
    .digest('hex');
}

function hashRecord(record) {
  return createHash('sha256')
    .update(JSON.stringify({
      sourceId: record.sourceId,
      sourceKind: record.sourceKind,
      allowlistedPath: record.allowlistedPath,
      browserLabel: record.browserLabel,
      discoveryMode: record.discoveryMode,
      fingerprint: record.fingerprint,
      redaction: record.redaction,
    }))
    .digest('hex');
}

function browserSafeObservation(observation) {
  return {
    observationId: observation.observationId,
    sourceId: observation.sourceId,
    candidateWorkNodeId: observation.candidateWorkNodeId,
    observationType: observation.observationType,
    observedAt: observation.observedAt,
    confidence: observation.confidence,
    strength: observation.strength,
    summary: observation.summary,
    redaction: observation.redaction,
    metadata: observation.metadata ?? {},
  };
}

function assertBrowserSafe(nodes, sourceRecords, observations) {
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

  for (const record of sourceRecords) {
    if (!isBrowserSafePathLabel(record.allowlistedPath)) throw new Error(`${record.sourceId}: unsafe source record label ${record.allowlistedPath}`);
    if (JSON.stringify(record).includes('/home/ubuntu/')) throw new Error(`${record.sourceId}: source record leaks an absolute local path`);
  }

  for (const observation of observations) {
    if (JSON.stringify(observation).includes('/home/ubuntu/')) throw new Error(`${observation.observationId}: observation leaks an absolute local path`);
    if ('rawExcerpt' in observation || 'sourcePath' in observation) throw new Error(`${observation.observationId}: browser observation contains verifier-only data`);
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
  const inventory = discoverSourceInventory({ observedAt });
  const dynamicTriageAnchors = readTriageDynamicAnchors();
  const identityAnchors = [...registry.anchors.filter(hasNonFixtureEvidence), ...dynamicTriageAnchors, ...inventory.identityAnchors]
    .sort((a, b) => a.id.localeCompare(b.id));
  const observations = [
    ...inventory.observations,
    ...identityAnchors.flatMap((anchor) => [
      ...readOmhObservations(anchor, observedAt),
      ...readGjcObservations(anchor, observedAt),
      ...readGitObservations(anchor, observedAt),
      ...readTriageObservations(anchor, observedAt),
    ]),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const identityGraph = browserSafeIdentityGraph(buildIdentityGraph(identityAnchors, observations));
  const goalContracts = buildGoalContracts(identityGraph, observations);
  const goalContractsById = new Map(goalContracts.map((contract) => [contract.canonicalId, contract]));
  const identityById = new Map(identityGraph.map((identity) => [identity.canonicalId, identity]));
  const nodes = reconcileWorkNodes(identityAnchors, observations, {
    generatedAt: observedAt,
    goalContractsById,
    identityById,
  });
  const browserSourceRecords = browserSafeSourceRecords(inventory.sourceRecords).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const browserObservations = observations.map(browserSafeObservation).sort((a, b) => a.observationId.localeCompare(b.observationId));
  assertBrowserSafe(nodes, browserSourceRecords, browserObservations);

  const provenance = {
    schema: 'chrisboard.worknodes.provenance.v2',
    generatedAt: observedAt,
    generator: 'scripts/read-model/generate-worknodes.mjs',
    anchorRegistry: 'src/read-model/anchors/worknode-anchors.json',
    generatedData: GENERATED_DATA,
    sourceRecordsData: SOURCE_RECORDS_DATA,
    observationsData: OBSERVATIONS_DATA,
    identityGraphData: IDENTITY_GRAPH_DATA,
    goalContractsData: GOAL_CONTRACTS_DATA,
    sourceRecordCount: inventory.sourceRecords.length,
    observationCount: observations.length,
    nodeCount: nodes.length,
    identityNodeCount: identityGraph.length,
    goalContractCount: goalContracts.length,
    sourceRecords: inventory.sourceRecords.map((record) => ({
      sourceId: record.sourceId,
      sourceKind: record.sourceKind,
      sourcePath: record.sourcePath,
      sourcePathLabel: record.allowlistedPath,
      discoveryMode: record.discoveryMode,
      redaction: record.redaction,
      sha256: hashRecord(record),
    })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    sourcePaths: observations.map((observation) => ({
      worknodeId: observation.worknodeId,
      candidateWorkNodeId: observation.candidateWorkNodeId,
      sourceId: observation.sourceId,
      sourceKind: observation.sourceKind,
      sourcePath: observation.sourcePath,
      sourcePathLabel: observation.sourcePathLabel,
      observationType: observation.observationType,
      redaction: observation.redaction,
      sha256: hashObservation(observation),
    })),
    freshness: {
      generatedAt: observedAt,
      staleNodeCount: nodes.filter((node) => node.freshness === 'stale').length,
      unknownFreshnessNodeCount: nodes.filter((node) => node.freshness === 'unknown').length,
    },
    browserRedaction: {
      absolutePathsInBrowserData: false,
      rawExcerptsInBrowserData: false,
      evidenceLinksRedacted: nodes.every((node) => node.evidenceLinks.every((link) => link.redacted === true)),
      sourceRecordsRedacted: browserSourceRecords.every((record) => record.redaction !== 'browser_safe' || !String(record.allowlistedPath).startsWith('/')),
      observationsRedacted: browserObservations.every((observation) => !('rawExcerpt' in observation) && !('sourcePath' in observation)),
    },
    identityGraph: identityGraph.map((identity) => ({
      canonicalId: identity.canonicalId,
      mappingStatus: identity.mappingStatus,
      sourceRefs: identity.sourceRefs,
      aliasCount: identity.aliases.length,
    })),
    goalContracts: goalContracts.map((contract) => ({
      canonicalId: contract.canonicalId,
      doneCriteriaCount: contract.doneCriteria.length,
      approvalGateCount: contract.approvalGates.length,
      scopeReductionCount: contract.scopeReductions.length,
      parentAcceptanceRequired: contract.parentAcceptanceRequired,
    })),
  };

  mkdirSync(dirname(GENERATED_DATA), { recursive: true });
  writeFileSync(GENERATED_DATA, `${JSON.stringify(nodes, null, 2)}\n`);
  writeFileSync(SOURCE_RECORDS_DATA, `${JSON.stringify(browserSourceRecords, null, 2)}\n`);
  writeFileSync(OBSERVATIONS_DATA, `${JSON.stringify(browserObservations, null, 2)}\n`);
  writeFileSync(IDENTITY_GRAPH_DATA, `${JSON.stringify(identityGraph, null, 2)}\n`);
  writeFileSync(GOAL_CONTRACTS_DATA, `${JSON.stringify(goalContracts, null, 2)}\n`);
  writeFileSync(PROVENANCE_DATA, `${JSON.stringify(provenance, null, 2)}\n`);
  return { nodes, sourceRecords: browserSourceRecords, observations: browserObservations, identityGraph, goalContracts, provenance };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { nodes, provenance } = generateWorkNodes();
  console.log(JSON.stringify({
    status: 'generated',
    nodes: nodes.length,
    sourceRecords: provenance.sourceRecordCount,
    observations: provenance.observationCount,
  }, null, 2));
}
