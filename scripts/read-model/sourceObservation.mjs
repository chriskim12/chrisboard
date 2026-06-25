export const SOURCE_KINDS = ['Git', 'GJC', 'OMH', 'HermesTriage', 'DiscordAnchor'];
export const OBSERVATION_TYPES = [
  'triage_item',
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

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOneOf(field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`SourceObservation ${field} is invalid: ${String(value)}`);
  }
}

export function validateSourceObservation(value) {
  if (!isRecord(value)) throw new Error('SourceObservation must be an object');
  for (const field of ['id', 'worknodeId', 'sourcePath', 'sourcePathLabel', 'observedAt', 'summary']) {
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
    ...fields,
  });
}
