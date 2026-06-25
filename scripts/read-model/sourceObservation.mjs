export const SOURCE_KINDS = ['Git', 'GJC', 'OMH', 'Hermes', 'HermesTriage', 'DiscordAnchor', 'GitHub', 'Deploy', 'Kanban'];
export const OBSERVATION_TYPES = [
  'triage_item',
  'source_discovered',
  'source_missing',
  'plan_present',
  'approval_boundary',
  'execution_active',
  'artifact_present',
  'verifier_receipt',
  'git_dirty',
  'git_clean',
  'git_landed',
  'git_unpushed',
  'review_needed',
  'blocked',
  'residue',
  'final_proof',
  'parent_acceptance',
  'self_report',
  'conflict',
  'reader_error',
];
export const STRENGTHS = ['final', 'strong', 'medium', 'weak', 'error'];
export const CONFIDENCES = ['high', 'medium', 'low'];
export const REDACTIONS = ['browser_safe', 'redacted', 'verifier_only'];
export const SOURCE_RECORD_KINDS = ['Git', 'GJC', 'OMH', 'Hermes', 'HermesTriage', 'DiscordAnchor', 'GitHub', 'Deploy', 'Kanban'];
export const DISCOVERY_MODES = ['configured', 'auto_discovered', 'manual_identity_mapping'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOneOf(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`SourceObservation ${field} is invalid: ${String(value)}`);
  }
}

export function validateSourceRecord(value) {
  if (!isRecord(value)) throw new Error('SourceRecord must be an object');
  for (const field of ['sourceId', 'sourceKind', 'browserLabel', 'discoveredAt', 'discoveryMode', 'fingerprint', 'redaction']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      throw new Error(`SourceRecord ${field} is required`);
    }
  }
  assertOneOf('sourceKind', value.sourceKind, SOURCE_RECORD_KINDS);
  assertOneOf('discoveryMode', value.discoveryMode, DISCOVERY_MODES);
  assertOneOf('redaction', value.redaction, REDACTIONS);
  if (value.allowlistedPath !== undefined && typeof value.allowlistedPath !== 'string') throw new Error('SourceRecord allowlistedPath must be a string');
  if (value.freshnessTtl !== undefined && typeof value.freshnessTtl !== 'string') throw new Error('SourceRecord freshnessTtl must be a string');
  return value;
}

export function validateSourceObservation(value) {
  if (!isRecord(value)) throw new Error('SourceObservation must be an object');
  for (const field of ['id', 'observationId', 'worknodeId', 'candidateWorkNodeId', 'sourceId', 'sourcePath', 'sourcePathLabel', 'observedAt', 'summary']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      throw new Error(`SourceObservation ${field} is required`);
    }
  }
  assertOneOf('sourceKind', value.sourceKind, SOURCE_KINDS);
  assertOneOf('observationType', value.observationType, OBSERVATION_TYPES);
  assertOneOf('strength', value.strength, STRENGTHS);
  assertOneOf('confidence', value.confidence, CONFIDENCES);
  assertOneOf('redaction', value.redaction, REDACTIONS);
  if (value.sourceRef !== undefined && typeof value.sourceRef !== 'string') throw new Error('SourceObservation sourceRef must be a string');
  if (value.rawExcerpt !== undefined && typeof value.rawExcerpt !== 'string') throw new Error('SourceObservation rawExcerpt must be a string');
  if (value.metadata !== undefined && !isRecord(value.metadata)) throw new Error('SourceObservation metadata must be an object');
  return value;
}

export function createObservation(fields) {
  return validateSourceObservation({
    sourceRef: undefined,
    rawExcerpt: undefined,
    metadata: undefined,
    observationId: fields.observationId ?? fields.id,
    sourceId: fields.sourceId ?? `${fields.sourceKind}:${fields.sourcePathLabel}`,
    candidateWorkNodeId: fields.candidateWorkNodeId ?? fields.worknodeId,
    ...fields,
  });
}
