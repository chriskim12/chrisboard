import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  LOCAL_REPOS_ROOT,
  LOCAL_WORKTREES_ROOT,
  OMH_ROOT,
  REPO_ROOT,
  TRIAGE_INBOX,
  ULTRAGOAL_RUN_ROOT,
  assertAllowedSourcePath,
  isAllowedSourcePath,
  sourcePathLabel,
} from './pathAllowlist.mjs';
import { createObservation, validateSourceRecord } from './sourceObservation.mjs';

const DEFAULT_TTL = 'PT24H';
const DEFAULT_LOCAL_REPO_NAMES = ['chrisboard', 'dailychingu', 'whystarve', 'clawhip', 'oh-my-codex'];
const DEFAULT_LOCAL_WORKTREE_PREFIXES = ['chrisboard', 'dailychingu', 'whystarve', 'clawhip', 'oh-my-codex', 'hermes-core-workflows'];
const SAFE_DISCOVERY_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const SOURCE_KIND_BY_ID = {
  repo_root: 'Git',
  local_repo: 'Git',
  local_worktree: 'Git',
  omh_plans: 'OMH',
  omh_specs: 'OMH',
  gjc_state: 'GJC',
  hermes_goal_runs: 'Hermes',
  hermes_sessions: 'Hermes',
  triage_inbox: 'HermesTriage',
  kanban_evidence: 'Kanban',
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeStat(path) {
  try {
    return existsSync(path) ? statSync(path) : null;
  } catch {
    return null;
  }
}

function parseDiscoveryList(envName, defaults) {
  const raw = process.env[envName];
  const values = raw && raw.trim().length > 0 ? raw.split(',') : defaults;
  return [...new Set(values.map((value) => value.trim()).filter((value) => SAFE_DISCOVERY_NAME.test(value)))].sort((a, b) => a.localeCompare(b));
}

export function localRepoDiscoveryNames() {
  return parseDiscoveryList('CHRISBOARD_LOCAL_REPO_NAMES', DEFAULT_LOCAL_REPO_NAMES);
}

export function localWorktreeDiscoveryPrefixes() {
  return parseDiscoveryList('CHRISBOARD_LOCAL_WORKTREE_PREFIXES', DEFAULT_LOCAL_WORKTREE_PREFIXES);
}

export function isAllowedLocalRepoName(name, allowlist = localRepoDiscoveryNames()) {
  return allowlist.includes(name);
}

export function isAllowedLocalWorktreeName(name, allowlist = localWorktreeDiscoveryPrefixes()) {
  return allowlist.some((prefix) => name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}_`) || name.startsWith(`${prefix}.`));
}

function hasGitMetadata(path) {
  return Boolean(safeStat(join(path, '.git')));
}

function directChildren(root, predicate) {
  try {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name))
      .filter(predicate)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function configuredSource({ inventoryId, sourceKind, sourcePath, browserLabel, discoveryMode = 'configured', freshnessTtl = DEFAULT_TTL, observedAt }) {
  const allowedPath = assertAllowedSourcePath(sourcePath);
  const stat = safeStat(allowedPath);
  const label = sourcePathLabel(allowedPath);
  const fingerprint = sha256(JSON.stringify({ inventoryId, sourceKind, label, mtimeMs: stat?.mtimeMs ?? null, size: stat?.size ?? null }));
  return validateSourceRecord({
    sourceId: `${inventoryId}:${sha256(`${sourceKind}:${label}`).slice(0, 12)}`,
    sourceKind,
    allowlistedPath: label,
    browserLabel,
    discoveredAt: observedAt,
    discoveryMode,
    fingerprint,
    redaction: 'redacted',
    freshnessTtl,
    sourcePath: allowedPath,
    exists: Boolean(stat),
    statKind: stat ? (stat.isDirectory() ? 'directory' : 'file') : 'missing',
  });
}

function sourceRecordToAnchor(record) {
  return {
    id: `discovered-${record.sourceId.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
    title: record.browserLabel,
    kind: record.sourceKind === 'OMH' || record.sourceKind === 'Hermes' || record.sourceKind === 'GJC' ? 'ParentGoal' : 'StandaloneTask',
    evidence_paths: [record.sourcePath],
    source_labels: [record.browserLabel],
    discovered_source_id: record.sourceId,
  };
}

function sourceRecordToObservation(record, observedAt) {
  const anchor = sourceRecordToAnchor(record);
  return createObservation({
    id: `${anchor.id}:inventory:${record.exists ? 'discovered' : 'missing'}`,
    worknodeId: anchor.id,
    candidateWorkNodeId: anchor.id,
    sourceId: record.sourceId,
    sourceKind: record.sourceKind,
    sourcePath: record.sourcePath,
    sourcePathLabel: record.allowlistedPath,
    observedAt,
    observationType: record.exists ? 'source_discovered' : 'source_missing',
    strength: record.exists ? 'medium' : 'error',
    confidence: record.exists ? 'high' : 'low',
    summary: record.exists
      ? `Approved source inventory discovered ${record.browserLabel}.`
      : `Approved source inventory expected ${record.browserLabel}, but it is missing.`,
    redaction: 'redacted',
    metadata: {
      discoveryMode: record.discoveryMode,
      statKind: record.statKind,
      freshnessTtl: record.freshnessTtl,
    },
  });
}

function candidateRecords(observedAt) {
  const configured = [
    { inventoryId: 'repo_root', sourceKind: 'Git', sourcePath: REPO_ROOT, browserLabel: 'Current Chrisboard worktree' },
    { inventoryId: 'omh_plans', sourceKind: 'OMH', sourcePath: join(OMH_ROOT, 'plans'), browserLabel: 'Chrisboard OMH plans' },
    { inventoryId: 'omh_specs', sourceKind: 'OMH', sourcePath: join(OMH_ROOT, 'specs'), browserLabel: 'Chrisboard OMH specs' },
    { inventoryId: 'gjc_state', sourceKind: 'GJC', sourcePath: join(REPO_ROOT, '.gjc'), browserLabel: 'Repo-local GJC state' },
    { inventoryId: 'hermes_goal_runs', sourceKind: 'Hermes', sourcePath: ULTRAGOAL_RUN_ROOT, browserLabel: 'Hermes local goal/session traces' },
    { inventoryId: 'triage_inbox', sourceKind: 'HermesTriage', sourcePath: TRIAGE_INBOX, browserLabel: 'Hermes TRIAGE inbox' },
    { inventoryId: 'kanban_evidence', sourceKind: 'Kanban', sourcePath: join(OMH_ROOT, 'kanban'), browserLabel: 'Existing local Kanban evidence', optional: true },
  ];

  const worktreePrefixes = localWorktreeDiscoveryPrefixes();
  const worktreeRecords = directChildren(
    LOCAL_WORKTREES_ROOT,
    (path) => hasGitMetadata(path) && isAllowedLocalWorktreeName(basename(path), worktreePrefixes) && isAllowedSourcePath(path),
  )
    .slice(0, 12)
    .map((sourcePath, index) => ({
      inventoryId: `local_worktree_${index + 1}`,
      sourceKind: 'Git',
      sourcePath,
      browserLabel: `Discovered allowlisted local worktree ${index + 1}`,
      discoveryMode: 'auto_discovered',
    }));

  const repoNames = localRepoDiscoveryNames();
  const repoRecords = directChildren(
    LOCAL_REPOS_ROOT,
    (path) => hasGitMetadata(path) && isAllowedLocalRepoName(basename(path), repoNames) && isAllowedSourcePath(path),
  )
    .slice(0, 12)
    .map((sourcePath, index) => ({
      inventoryId: `local_repo_${index + 1}`,
      sourceKind: 'Git',
      sourcePath,
      browserLabel: `Discovered allowlisted local repo ${index + 1}`,
      discoveryMode: 'auto_discovered',
    }));

  return [...configured, ...repoRecords, ...worktreeRecords]
    .filter((record) => !record.optional || existsSync(record.sourcePath))
    .filter((record) => SOURCE_KIND_BY_ID[record.inventoryId.replace(/_\d+$/, '')] || record.sourceKind)
    .map((record) => configuredSource({ ...record, observedAt }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

export function discoverSourceInventory({ observedAt = new Date().toISOString() } = {}) {
  const sourceRecords = candidateRecords(observedAt);
  const identityAnchors = sourceRecords.map(sourceRecordToAnchor).sort((a, b) => a.id.localeCompare(b.id));
  const observations = sourceRecords.map((record) => sourceRecordToObservation(record, observedAt)).sort((a, b) => a.id.localeCompare(b.id));
  return { sourceRecords, identityAnchors, observations };
}

export function browserSafeSourceRecords(records) {
  return records.map(({ sourcePath, exists, statKind, ...record }) => record);
}
