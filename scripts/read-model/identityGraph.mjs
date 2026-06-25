const CONFIDENCES = ['high', 'medium', 'low'];
const MAPPING_STATUSES = ['mapped', 'auto_discovered', 'needs_mapping', 'conflict'];
const CREATED_FROM = ['contract', 'triage', 'discovery', 'manual_identity_correction'];
const KINDS = ['ParentGoal', 'ChildWork', 'StandaloneTask'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOneOf(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`IdentityNode ${field} is invalid: ${String(value)}`);
  }
}

function normalizeTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function aliasesFor(anchor, observations) {
  const aliases = [
    { kind: 'anchor_id', value: anchor.id, confidence: 'high' },
    { kind: 'title', value: anchor.title, confidence: 'high' },
    ...(anchor.source_labels ?? []).map((value) => ({ kind: 'source_label', value: String(value), confidence: 'medium' })),
    ...observations.map((observation) => ({ kind: 'candidate_worknode_id', value: observation.candidateWorkNodeId, confidence: 'medium' })),
    ...observations.map((observation) => ({ kind: 'source_id', value: observation.sourceId, confidence: 'medium' })),
  ].filter((alias) => alias.value && typeof alias.value === 'string');
  return uniqueBy(aliases, (alias) => `${alias.kind}:${alias.value}`).sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
}

function mappingStatusFor(anchor, observations, duplicateTitleIds) {
  if (duplicateTitleIds.has(anchor.id)) return 'conflict';
  if (anchor.discovered_source_id) return 'auto_discovered';
  if (observations.length === 0) return 'needs_mapping';
  return 'mapped';
}

function createdFromFor(anchor) {
  if (anchor.discovered_source_id) return 'discovery';
  if (anchor.kind === 'ParentGoal') return 'contract';
  if (String(anchor.id).includes('triage')) return 'triage';
  return 'contract';
}

export function validateIdentityNode(value) {
  if (!isRecord(value)) throw new Error('IdentityNode must be an object');
  for (const field of ['canonicalId', 'kind', 'title', 'mappingStatus', 'createdFrom']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      throw new Error(`IdentityNode ${field} is required`);
    }
  }
  assertOneOf('kind', value.kind, KINDS);
  assertOneOf('mappingStatus', value.mappingStatus, MAPPING_STATUSES);
  assertOneOf('createdFrom', value.createdFrom, CREATED_FROM);
  if (value.parentId !== undefined && typeof value.parentId !== 'string') throw new Error('IdentityNode parentId must be a string');
  if (!Array.isArray(value.sourceRefs) || !value.sourceRefs.every((sourceRef) => typeof sourceRef === 'string')) throw new Error('IdentityNode sourceRefs must be strings');
  if (!Array.isArray(value.aliases)) throw new Error('IdentityNode aliases must be an array');
  for (const alias of value.aliases) {
    if (!isRecord(alias) || typeof alias.kind !== 'string' || typeof alias.value !== 'string') throw new Error('IdentityNode alias is invalid');
    assertOneOf('alias.confidence', alias.confidence, CONFIDENCES);
    if (/canonicalStatus|\bDONE\b|\bBLOCKED\b/.test(alias.kind)) throw new Error('IdentityNode alias contains forbidden status-like mapping truth');
  }
  if (value.mappingStatus === 'mapped' && value.sourceRefs.length === 0) throw new Error('IdentityNode mapped status requires sourceRefs');
  return value;
}

export function buildIdentityGraph(anchors, observations) {
  const observationsByNode = new Map();
  for (const observation of observations) {
    const key = observation.worknodeId;
    observationsByNode.set(key, [...(observationsByNode.get(key) ?? []), observation]);
  }

  const titleBuckets = new Map();
  for (const anchor of anchors) {
    const titleKey = normalizeTitle(anchor.title);
    if (!titleKey) continue;
    titleBuckets.set(titleKey, [...(titleBuckets.get(titleKey) ?? []), anchor.id]);
  }
  const duplicateTitleIds = new Set([...titleBuckets.values()].filter((ids) => ids.length > 1).flat());

  return anchors.map((anchor) => {
    const nodeObservations = observationsByNode.get(anchor.id) ?? [];
    const sourceRefs = [...new Set(nodeObservations.map((observation) => observation.sourceId))].sort((a, b) => a.localeCompare(b));
    return validateIdentityNode({
      canonicalId: anchor.id,
      kind: anchor.kind,
      title: anchor.title,
      ...(anchor.parent_id ? { parentId: anchor.parent_id } : {}),
      aliases: aliasesFor(anchor, nodeObservations),
      sourceRefs,
      mappingStatus: mappingStatusFor(anchor, nodeObservations, duplicateTitleIds),
      createdFrom: createdFromFor(anchor),
    });
  }).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

export function browserSafeIdentityGraph(identityNodes) {
  return identityNodes.map((node) => validateIdentityNode({
    ...node,
    aliases: node.aliases.filter((alias) => !String(alias.value).includes('/home/ubuntu/')),
  }));
}
