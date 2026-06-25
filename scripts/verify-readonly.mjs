import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateAnchorRegistry } from './read-model/anchorRegistry.mjs';
import { buildGoalContracts, validateGoalContract } from './read-model/goalContracts.mjs';
import { buildIdentityGraph, validateIdentityNode } from './read-model/identityGraph.mjs';
import { assertAllowedSourcePath, isAllowedSourcePath, isBrowserSafePathLabel, TRIAGE_INBOX } from './read-model/pathAllowlist.mjs';
import { reconcileAnchor } from './read-model/reconcileWorkNodes.mjs';
import { createObservation, validateSourceRecord } from './read-model/sourceObservation.mjs';
import { TRIAGE_ALLOWED_FIELDS, TRIAGE_ALLOWED_SOURCE_FIELDS, validateTriageEntry } from './read-model/triageReader.mjs';

const root = process.cwd();
const requiredStatuses = ['TRIAGE', 'TODO', 'RUNNING', 'REVIEW', 'BLOCKED', 'LANDED', 'RESIDUE', 'DONE'];
const forbiddenStatuses = ['DOING', 'WAITING'];
const requiredFixtures = [
  'fixture-triage-raw-entry.jsonl',
  'fixture-anchor-forbidden-status.json',
  'fixture-source-path-outside-allowlist.json',
  'fixture-landed-not-done.json',
  'fixture-parent-child-done-no-parent-acceptance.json',
  'fixture-parent-accepted-final-proof.json',
  'fixture-self-report-only.json',
  'fixture-reader-error-blocked.json',
  'fixture-residue-dirty-worktree.json',
  'fixture-browser-provenance-redaction.json',
  'fixture-triage-writer-contract.json',
  'fixture-status-vocabulary.json',
];
const read = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const rel = join(dir, entry);
    const stat = statSync(join(root, rel));
    return stat.isDirectory() ? walk(rel) : [rel];
  });
}

function observationsFromFixture(path, worknodeId = 'fixture-node') {
  const fixture = readJson(path);
  return (fixture.observations ?? []).map((observation, index) => createObservation({
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

function assertFixtureStatus(path, expectedStatus, message) {
  const anchor = { id: 'fixture-node', title: 'Fixture node', kind: 'StandaloneTask', evidence_paths: [path] };
  const observations = observationsFromFixture(path);
  const [identityNode] = buildIdentityGraph([anchor], observations);
  const [goalContract] = expectedStatus === 'DONE' ? buildGoalContracts([identityNode], observations) : [undefined];
  const node = reconcileAnchor(anchor, observations, [], { identityNode, goalContract });
  if (node.canonicalStatus !== expectedStatus) {
    throw new Error(`${message}: expected ${expectedStatus}, got ${node.canonicalStatus}`);
  }
  return node;
}

const domain = read('src/domain/worknode.ts');
for (const status of requiredStatuses) {
  if (!domain.includes(`'${status}'`)) throw new Error(`Missing status vocabulary entry ${status}`);
}
for (const status of forbiddenStatuses) {
  if (domain.includes(`'${status}'`)) throw new Error(`Domain still contains legacy status ${status}`);
}

const fixtureDir = 'scripts/read-model/fixtures';
const fixtureFiles = readdirSync(join(root, fixtureDir));
for (const fixture of requiredFixtures) {
  if (!fixtureFiles.includes(fixture)) throw new Error(`Missing verifier fixture ${fixture}`);
}
const statusFixture = readJson(`${fixtureDir}/fixture-status-vocabulary.json`);
if (JSON.stringify(statusFixture.expectedStatuses) !== JSON.stringify(requiredStatuses)) throw new Error('Status vocabulary fixture does not match required order');
if (statusFixture.forbiddenStatuses.some((status) => !forbiddenStatuses.includes(status))) throw new Error('Status fixture forbidden statuses drifted');

const anchorRegistry = readJson('src/read-model/anchors/worknode-anchors.json');
validateAnchorRegistry(anchorRegistry);
try {
  validateAnchorRegistry(readJson(`${fixtureDir}/fixture-anchor-forbidden-status.json`));
  throw new Error('Forbidden anchor status fixture unexpectedly passed');
} catch (error) {
  if (!String(error instanceof Error ? error.message : error).includes('forbidden anchor truth/status field')) throw error;
}
const outsidePath = readJson(`${fixtureDir}/fixture-source-path-outside-allowlist.json`).path;
if (isAllowedSourcePath(outsidePath)) throw new Error('Outside allowlist fixture unexpectedly passed');
try {
  assertAllowedSourcePath(outsidePath);
  throw new Error('Outside allowlist fixture did not throw');
} catch (error) {
  if (!String(error instanceof Error ? error.message : error).includes('outside the Chrisboard allowlist')) throw error;
}

const generated = readJson('src/data/worknodes.generated.json');
const provenance = readJson('src/data/worknodes.provenance.json');
const sourceRecords = readJson('src/data/source-records.generated.json');
const generatedObservations = readJson('src/data/observations.generated.json');
const identityGraph = readJson('src/data/identity-graph.generated.json');
const goalContracts = readJson('src/data/goal-contracts.generated.json');
if (!Array.isArray(generated) || generated.length < 8) throw new Error('Generated WorkNode data must contain source-backed dashboard nodes');
const generatedStatuses = new Set(generated.map((node) => node.canonicalStatus));

for (const status of forbiddenStatuses) {
  if (generatedStatuses.has(status)) throw new Error(`Generated data contains legacy status ${status}`);
}
for (const source of provenance.sourcePaths ?? []) {
  if (source.sourcePath.includes('scripts/read-model/fixtures/')) throw new Error(`Generated provenance contains fixture-only source ${source.sourcePath}`);
}

for (const node of generated) {
  if (!requiredStatuses.includes(node.canonicalStatus)) throw new Error(`${node.id} has invalid status ${node.canonicalStatus}`);
  if (!node.browserProvenance || node.browserProvenance.redaction !== 'redacted') throw new Error(`${node.id}: missing redacted browser provenance`);
  for (const evidence of node.evidenceLinks ?? []) {
    if (evidence.redacted !== true) throw new Error(`${node.id}: evidence ${evidence.label} is not marked redacted`);
    if (evidence.localPath && !isBrowserSafePathLabel(evidence.localPath)) throw new Error(`${node.id}: unsafe evidence label ${evidence.localPath}`);
  }
  for (const label of node.browserProvenance.redactedPathLabels ?? []) {
    if (!isBrowserSafePathLabel(label)) throw new Error(`${node.id}: unsafe provenance label ${label}`);
  }
}

if (!Array.isArray(sourceRecords) || sourceRecords.length < 5) throw new Error('Generated source inventory must contain approved local/read-only sources');
for (const record of sourceRecords) {
  validateSourceRecord(record);
  if (!isBrowserSafePathLabel(record.allowlistedPath)) throw new Error(`${record.sourceId}: unsafe source inventory label ${record.allowlistedPath}`);
}
const sourceKinds = new Set(sourceRecords.map((record) => record.sourceKind));
for (const required of ['Git', 'GJC', 'OMH', 'Hermes', 'HermesTriage']) {
  if (!sourceKinds.has(required)) throw new Error(`Generated source inventory missing ${required}`);
}
if (!sourceRecords.some((record) => record.discoveryMode === 'auto_discovered')) throw new Error('Generated source inventory must include conservative auto-discovery');
const autoDiscoveredGitRecords = sourceRecords.filter((record) => record.sourceKind === 'Git' && record.discoveryMode === 'auto_discovered');
const autoDiscoveredLocalRepoRecords = autoDiscoveredGitRecords.filter((record) => record.sourceId.startsWith('local_repo_'));
const autoDiscoveredLocalWorktreeRecords = autoDiscoveredGitRecords.filter((record) => record.sourceId.startsWith('local_worktree_'));
if (autoDiscoveredLocalRepoRecords.length < 2) throw new Error('Generated source inventory must prove broader-than-Chrisboard-only local repo discovery');
if (autoDiscoveredLocalWorktreeRecords.length < 1) throw new Error('Generated source inventory must include allowlisted local worktree discovery');
for (const record of autoDiscoveredGitRecords) {
  if (/\b(?:Chrisboard|dailychingu|whystarve|clawhip|oh-my-codex|hermes-core-workflows)\b/i.test(record.browserLabel)) {
    throw new Error(`${record.sourceId}: auto-discovered browser label must stay generic/redacted`);
  }
}

if (!Array.isArray(generatedObservations) || generatedObservations.length < sourceRecords.length) throw new Error('Generated observation projection is missing');
for (const observation of generatedObservations) {
  for (const field of ['observationId', 'sourceId', 'candidateWorkNodeId', 'observationType', 'observedAt', 'confidence', 'strength', 'summary', 'redaction']) {
    if (typeof observation[field] !== 'string' || observation[field].length === 0) throw new Error(`Generated observation missing ${field}`);
  }
  if ('sourcePath' in observation || 'rawExcerpt' in observation) throw new Error(`${observation.observationId}: generated observation leaks verifier-only data`);
}
if (!Array.isArray(identityGraph) || identityGraph.length !== generated.length) throw new Error('Generated identity graph must cover every WorkNode');
const identityIds = new Set();
for (const identityNode of identityGraph) {
  validateIdentityNode(identityNode);
  identityIds.add(identityNode.canonicalId);
  if (JSON.stringify(identityNode).includes('canonicalStatus')) throw new Error(`${identityNode.canonicalId}: identity graph leaks status truth`);
}
if (!Array.isArray(goalContracts) || goalContracts.length !== generated.length) throw new Error('Generated goal contracts must cover every WorkNode');
const contractIds = new Set();
for (const contract of goalContracts) {
  validateGoalContract(contract);
  contractIds.add(contract.canonicalId);
  if (!contract.originalGoal.includes('WorkNode operational SSOT')) throw new Error(`${contract.canonicalId}: contract does not preserve original parent goal`);
  if (!contract.scopeReductions.some((reduction) => reduction.approvedByChris === false)) throw new Error(`${contract.canonicalId}: missing explicit unapproved scope-reduction accounting`);
}
for (const node of generated) {
  if (!identityIds.has(node.id)) throw new Error(`${node.id}: missing identity graph entry`);
  if (!contractIds.has(node.id)) throw new Error(`${node.id}: missing goal contract entry`);
  if (!node.identityMapping || !Array.isArray(node.identityMapping.aliases)) throw new Error(`${node.id}: missing browser identity aliases`);
  if (!node.goalContract || !node.goalContract.originalGoal.includes('WorkNode operational SSOT')) throw new Error(`${node.id}: missing browser goal contract`);
  if (node.kind === 'ParentGoal' && node.canonicalStatus === 'DONE' && !node.goalContract.parentAcceptanceRequired) throw new Error(`${node.id}: parent DONE contract does not require parent acceptance`);
}

const generatedText = read('src/data/worknodes.generated.json');
const redactionFixture = readJson(`${fixtureDir}/fixture-browser-provenance-redaction.json`);
for (const forbidden of redactionFixture.forbiddenBrowserSubstrings) {
  if (generatedText.includes(forbidden)) throw new Error(`Generated browser data leaks forbidden substring ${forbidden}`);
}

if (provenance.schema !== 'chrisboard.worknodes.provenance.v2') throw new Error('Missing provenance schema');
if (provenance.identityNodeCount !== identityGraph.length) throw new Error('Provenance identity graph count does not match generated identity graph');
if (provenance.goalContractCount !== goalContracts.length) throw new Error('Provenance goal contract count does not match generated contracts');
if (!provenance.browserRedaction?.evidenceLinksRedacted) throw new Error('Provenance does not confirm evidence redaction');
if (!provenance.browserRedaction?.sourceRecordsRedacted) throw new Error('Provenance does not confirm source record redaction');
if (!provenance.browserRedaction?.observationsRedacted) throw new Error('Provenance does not confirm observation redaction');
for (const record of provenance.sourceRecords ?? []) {
  assertAllowedSourcePath(record.sourcePath);
  if (!isBrowserSafePathLabel(record.sourcePathLabel)) throw new Error(`Unsafe source record provenance label ${record.sourcePathLabel}`);
  if (!['configured', 'auto_discovered', 'manual_identity_mapping'].includes(record.discoveryMode)) throw new Error(`Invalid discovery mode ${record.discoveryMode}`);
}

for (const source of provenance.sourcePaths ?? []) {
  assertAllowedSourcePath(source.sourcePath);
  if (!isBrowserSafePathLabel(source.sourcePathLabel)) throw new Error(`Unsafe provenance label ${source.sourcePathLabel}`);
  if (!['browser_safe', 'redacted', 'verifier_only'].includes(source.redaction)) throw new Error(`Invalid provenance redaction ${source.redaction}`);
}

assertFixtureStatus(`${fixtureDir}/fixture-landed-not-done.json`, 'LANDED', 'LANDED fixture failed');
assertFixtureStatus(`${fixtureDir}/fixture-self-report-only.json`, 'REVIEW', 'Self-report fixture failed');
assertFixtureStatus(`${fixtureDir}/fixture-reader-error-blocked.json`, 'BLOCKED', 'Reader error fixture failed');
assertFixtureStatus(`${fixtureDir}/fixture-residue-dirty-worktree.json`, 'RESIDUE', 'Residue fixture failed');
const doneNode = assertFixtureStatus(`${fixtureDir}/fixture-parent-accepted-final-proof.json`, 'DONE', 'Parent accepted final proof fixture failed');
if (doneNode.completionDepth !== 'parent_done') throw new Error('Parent accepted final proof fixture did not produce parent_done');
const parentFixture = readJson(`${fixtureDir}/fixture-parent-child-done-no-parent-acceptance.json`);
if (parentFixture.parentExpectedStatusNot === 'DONE' && parentFixture.parent.canonicalStatus === 'DONE') throw new Error('Parent child fixture incorrectly marks parent DONE');
if (parentFixture.parentMustNotBe === parentFixture.parent.completionDepth) throw new Error('Parent child fixture incorrectly marks parent_done');

const triageWriter = readJson(`${fixtureDir}/fixture-triage-writer-contract.json`);
if (triageWriter.defaultAllowedPath !== '/home/ubuntu/.hermes/omh/chrisboard/triage/inbox.jsonl') throw new Error('TRIAGE writer fixture default path drifted');
if (JSON.stringify(triageWriter.allowedFields) !== JSON.stringify(TRIAGE_ALLOWED_FIELDS)) throw new Error('TRIAGE writer allowed fields drifted');
if (JSON.stringify(triageWriter.allowedSourceFields) !== JSON.stringify(TRIAGE_ALLOWED_SOURCE_FIELDS)) throw new Error('TRIAGE writer source fields drifted');
const triageLines = readFileSync(TRIAGE_INBOX, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
if (triageLines.length === 0) throw new Error('TRIAGE inbox must contain a contract-valid sample entry');
triageLines.forEach((line, index) => {
  let triageEntry;
  try {
    triageEntry = validateTriageEntry(JSON.parse(line));
  } catch (error) {
    throw new Error(`TRIAGE inbox line ${index + 1} violates writer contract: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const field of Object.keys(triageEntry)) {
    if (!triageWriter.allowedFields.includes(field)) throw new Error(`TRIAGE entry line ${index + 1} contains forbidden field ${field}`);
  }
  for (const field of Object.keys(triageEntry.source ?? {})) {
    if (!triageWriter.allowedSourceFields.includes(field)) throw new Error(`TRIAGE source line ${index + 1} contains forbidden field ${field}`);
  }
  if (triageEntry.status !== triageWriter.requiredStatus) throw new Error(`TRIAGE entry line ${index + 1} status must be ${triageWriter.requiredStatus}`);
  for (const forbidden of triageWriter.forbiddenFields) {
    if (line.includes(`"${forbidden}"`)) throw new Error(`TRIAGE writer contract leaked forbidden field ${forbidden} on line ${index + 1}`);
  }
});

const jsonAdapter = read('src/adapters/jsonWorkNodeAdapter.ts');
for (const required of ['mode: \'read-only\'', 'src/data/worknodes.generated.json', 'src/data/worknodes.provenance.json']) {
  if (!jsonAdapter.includes(required)) throw new Error(`JSON adapter missing required read-only/generated marker: ${required}`);
}
for (const required of ['src/data/identity-graph.generated.json', 'src/data/goal-contracts.generated.json']) {
  if (!jsonAdapter.includes(required)) throw new Error(`JSON adapter missing required generated model source: ${required}`);
}

const adapterFiles = walk('src/adapters').filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
const forbiddenMethod = /(?:async\s+)?(?:post|put|patch|delete|dispatch|resume|pause|assign|markDone|mark_done|promote|plan|execute)\s*\(|\b(?:post|put|patch|delete|dispatch|resume|pause|assign|markDone|mark_done|promote|plan|execute)\s*:/i;
for (const file of adapterFiles) {
  const source = read(file);
  const match = source.match(forbiddenMethod);
  if (match) throw new Error(`${file} exposes mutation-like adapter member ${match[0]}`);
}

const appSource = walk('src').filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => [file, read(file)]);
for (const [file, source] of appSource) {
  if (/fetch\s*\([^)]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(source)) throw new Error(`${file} contains mutation HTTP fetch`);
  if (/\b(dispatch|resume|pause|assign|markDone|mark_done|promote|restartGateway|rotateSecret)\b/i.test(source)) throw new Error(`${file} contains forbidden control word in browser source`);
}

for (const file of ['src/App.tsx', 'src/components/Board.tsx', 'src/components/WorkCard.tsx']) {
  const source = read(file);
  if (source.includes("join(' → ')") || source.includes('status-vocabulary')) throw new Error(`${file} contains workflow legend/subtitle residue`);
}

const readme = read('README.md');
for (const required of ['read-only', 'Source-backed generated read model', 'TRIAGE / TODO / RUNNING / REVIEW / BLOCKED / LANDED / RESIDUE / DONE', 'src/read-model/anchors/worknode-anchors.json', '/home/ubuntu/.hermes/omh/chrisboard/triage/inbox.jsonl', 'CHRISBOARD_REPO_ROOT', 'CHRISBOARD_TRIAGE_INBOX', 'CHRISBOARD_LOCAL_REPO_NAMES', 'CHRISBOARD_LOCAL_WORKTREE_PREFIXES', 'Non-goals', 'Future approval gates', 'workflow legends/subtitles are intentionally absent']) {
  if (!readme.includes(required)) throw new Error(`README missing ${required}`);
}

console.log(JSON.stringify({
  status: 'passed',
  statuses: requiredStatuses,
  generatedWorkNodes: generated.length,
  sourceRecords: sourceRecords.length,
  autoDiscoveredGitRecords: autoDiscoveredGitRecords.length,
  autoDiscoveredLocalRepos: autoDiscoveredLocalRepoRecords.length,
  autoDiscoveredLocalWorktrees: autoDiscoveredLocalWorktreeRecords.length,
  provenanceObservations: provenance.observationCount,
  fixtures: requiredFixtures.length,
  adapterFiles,
  triageInbox: TRIAGE_INBOX,
}, null, 2));
