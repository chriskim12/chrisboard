import { readFileSync } from 'node:fs';
import { assertAllowedSourcePath } from './pathAllowlist.mjs';

export const ANCHOR_REGISTRY_PATH = 'src/read-model/anchors/worknode-anchors.json';

const FORBIDDEN_TRUTH_KEYS = new Set([
  'canonicalStatus',
  'status',
  'statusReason',
  'completionDepth',
  'done',
  'isDone',
  'blocked',
  'isBlocked',
  'residue',
  'hasResidue',
  'running',
  'isRunning',
  'landed',
  'isLanded',
  'final',
  'finalProof',
  'executionApproved',
  'executionApproval',
  'reviewReady',
]);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scanForbiddenKeys(value, path = 'anchor') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_TRUTH_KEYS.has(key)) {
      throw new Error(`${path}.${key} is a forbidden anchor truth/status field`);
    }
    scanForbiddenKeys(nested, `${path}.${key}`);
  }
}

export function validateAnchorRegistry(registry) {
  if (!isRecord(registry) || !Array.isArray(registry.anchors)) {
    throw new Error('Anchor registry must contain an anchors array');
  }
  const ids = new Set();
  for (const anchor of registry.anchors) {
    scanForbiddenKeys(anchor);
    if (!isRecord(anchor)) throw new Error('Anchor must be an object');
    if (typeof anchor.id !== 'string' || anchor.id.length === 0) throw new Error('Anchor id is required');
    if (ids.has(anchor.id)) throw new Error(`Duplicate anchor id ${anchor.id}`);
    ids.add(anchor.id);
    if (typeof anchor.title !== 'string' || anchor.title.length === 0) throw new Error(`${anchor.id}: title is required`);
    if (!['ParentGoal', 'ChildWork', 'StandaloneTask'].includes(anchor.kind)) throw new Error(`${anchor.id}: invalid kind`);
    if (anchor.parent_id !== undefined && typeof anchor.parent_id !== 'string') throw new Error(`${anchor.id}: invalid parent_id`);
    if (anchor.repo_path !== undefined) assertAllowedSourcePath(anchor.repo_path);
    if (!Array.isArray(anchor.evidence_paths) || anchor.evidence_paths.length === 0) {
      throw new Error(`${anchor.id}: evidence_paths are required`);
    }
    anchor.evidence_paths.forEach(assertAllowedSourcePath);
    if (anchor.source_labels !== undefined && (!Array.isArray(anchor.source_labels) || !anchor.source_labels.every((item) => typeof item === 'string'))) {
      throw new Error(`${anchor.id}: invalid source_labels`);
    }
    if (anchor.thread_anchor !== undefined && typeof anchor.thread_anchor !== 'string') throw new Error(`${anchor.id}: invalid thread_anchor`);
  }
  for (const anchor of registry.anchors) {
    if (anchor.parent_id && !ids.has(anchor.parent_id)) throw new Error(`${anchor.id}: parent_id ${anchor.parent_id} is missing`);
  }
  return registry;
}

export function loadAnchorRegistry(path = ANCHOR_REGISTRY_PATH) {
  return validateAnchorRegistry(JSON.parse(readFileSync(path, 'utf8')));
}

export function forbiddenAnchorFields() {
  return [...FORBIDDEN_TRUTH_KEYS];
}
