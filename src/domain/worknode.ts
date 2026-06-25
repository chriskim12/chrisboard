export const WORK_STATUSES = [
  'TRIAGE',
  'TODO',
  'RUNNING',
  'REVIEW',
  'BLOCKED',
  'LANDED',
  'RESIDUE',
  'DONE',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_NODE_KINDS = ['ParentGoal', 'ChildWork', 'StandaloneTask'] as const;
export type WorkNodeKind = (typeof WORK_NODE_KINDS)[number];

export type CompletionDepth = 'child_done' | 'parent_partial' | 'parent_done' | 'unknown';
export type ExecutorLane = 'Hermes direct' | 'GJC delegated' | 'other' | 'unknown';
export type ExecutionState = 'running' | 'blocked' | 'completed' | 'stale' | 'unknown';
export type SourceKind = 'Discord' | 'DiscordAnchor' | 'Hermes' | 'HermesTriage' | 'GJC' | 'Git' | 'PR' | 'tests' | 'Spec' | 'Repo' | 'Plan' | 'OMH';

const COMPLETION_DEPTHS = ['child_done', 'parent_partial', 'parent_done', 'unknown'] as const;
const EXECUTOR_LANES = ['Hermes direct', 'GJC delegated', 'other', 'unknown'] as const;
const EXECUTION_STATES = ['running', 'blocked', 'completed', 'stale', 'unknown'] as const;
const SOURCE_KINDS = ['Discord', 'DiscordAnchor', 'Hermes', 'HermesTriage', 'GJC', 'Git', 'PR', 'tests', 'Spec', 'Repo', 'Plan', 'OMH'] as const;
const EVIDENCE_KINDS = ['plan', 'spec', 'artifact', 'test', 'session', 'repo', 'log', 'receipt', 'triage'] as const;
const GATE_STATUSES = ['not_requested', 'pending', 'approved', 'blocked', 'not_applicable'] as const;
const CONFLICT_KINDS = ['source_conflict', 'evidence_missing', 'approval_required', 'residue_present', 'unsafe_to_render'] as const;
const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;

export interface LinkRef {
  label: string;
  url?: string;
  localPath?: string;
}

export interface EvidenceLink extends LinkRef {
  kind: 'plan' | 'spec' | 'artifact' | 'test' | 'session' | 'repo' | 'log' | 'receipt' | 'triage';
  redacted: boolean;
}

export interface ApprovalGate {
  label: string;
  requiredBefore: string;
  status: 'not_requested' | 'pending' | 'approved' | 'blocked' | 'not_applicable';
}

export interface ResidueState {
  hasResidue: boolean;
  summary: string;
  items: string[];
}

export interface SourceState {
  source: SourceKind;
  state: string;
  observedAt?: string;
  confidence: 'high' | 'medium' | 'low';
  details: string;
}

export interface Conflict {
  kind: 'source_conflict' | 'evidence_missing' | 'approval_required' | 'residue_present' | 'unsafe_to_render';
  summary: string;
  sources: SourceKind[];
}

export interface WorkNode {
  id: string;
  kind: WorkNodeKind;
  title: string;
  parentGoalId?: string;
  parentGoalTitle?: string;
  childScope?: string;
  canonicalStatus: WorkStatus;
  statusReason: string;
  completionDepth: CompletionDepth;
  discordThread?: LinkRef;
  executorLane: ExecutorLane;
  executionState: ExecutionState;
  blocker?: string;
  nextAction?: string;
  evidenceLinks: EvidenceLink[];
  approvalGates: ApprovalGate[];
  residueState: ResidueState;
  sourceStates: SourceState[];
  conflicts: Conflict[];
  updatedAt?: string;
  browserProvenance?: {
    sourceKinds: SourceKind[];
    redactedPathLabels: string[];
    observationCount: number;
    redaction: 'browser_safe' | 'redacted';
  };
  realSource?: {
    sourceName: string;
    allowlistedPath: string;
    redaction: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function assertOptionalString(record: Record<string, unknown>, field: string, id: string): void {
  if (record[field] !== undefined && typeof record[field] !== 'string') {
    throw new Error(`${id}: invalid ${field}`);
  }
}

function assertWorkNode(value: unknown): asserts value is WorkNode {
  if (!isRecord(value)) {
    throw new Error('WorkNode must be an object');
  }

  const id = typeof value.id === 'string' ? value.id : 'WorkNode';
  if (typeof value.id !== 'string' || value.id.length === 0) throw new Error(`${id}: invalid id`);
  if (!isOneOf(WORK_NODE_KINDS, value.kind)) throw new Error(`${id}: invalid kind`);
  if (typeof value.title !== 'string' || value.title.length === 0) throw new Error(`${id}: invalid title`);
  if (!isOneOf(WORK_STATUSES, value.canonicalStatus)) throw new Error(`${id}: invalid canonicalStatus`);
  if (typeof value.statusReason !== 'string') throw new Error(`${id}: invalid statusReason`);
  if (!isOneOf(COMPLETION_DEPTHS, value.completionDepth)) throw new Error(`${id}: invalid completionDepth`);
  if (!isOneOf(EXECUTOR_LANES, value.executorLane)) throw new Error(`${id}: invalid executorLane`);
  if (!isOneOf(EXECUTION_STATES, value.executionState)) throw new Error(`${id}: invalid executionState`);

  for (const field of ['parentGoalId', 'parentGoalTitle', 'childScope', 'blocker', 'nextAction', 'updatedAt']) {
    assertOptionalString(value, field, id);
  }

  if (
    !Array.isArray(value.evidenceLinks) ||
    !value.evidenceLinks.every(
      (link) =>
        isRecord(link) &&
        typeof link.label === 'string' &&
        isOneOf(EVIDENCE_KINDS, link.kind) &&
        typeof link.redacted === 'boolean' &&
        (link.url === undefined || typeof link.url === 'string') &&
        (link.localPath === undefined || typeof link.localPath === 'string'),
    )
  ) {
    throw new Error(`${id}: invalid evidenceLinks`);
  }

  if (
    !Array.isArray(value.approvalGates) ||
    !value.approvalGates.every(
      (gate) =>
        isRecord(gate) &&
        typeof gate.label === 'string' &&
        typeof gate.requiredBefore === 'string' &&
        isOneOf(GATE_STATUSES, gate.status),
    )
  ) {
    throw new Error(`${id}: invalid approvalGates`);
  }

  if (
    !isRecord(value.residueState) ||
    typeof value.residueState.hasResidue !== 'boolean' ||
    typeof value.residueState.summary !== 'string' ||
    !isStringArray(value.residueState.items)
  ) {
    throw new Error(`${id}: invalid residueState`);
  }

  if (
    !Array.isArray(value.sourceStates) ||
    !value.sourceStates.every(
      (source) =>
        isRecord(source) &&
        isOneOf(SOURCE_KINDS, source.source) &&
        typeof source.state === 'string' &&
        (source.observedAt === undefined || typeof source.observedAt === 'string') &&
        isOneOf(CONFIDENCE_VALUES, source.confidence) &&
        typeof source.details === 'string',
    )
  ) {
    throw new Error(`${id}: invalid sourceStates`);
  }

  if (
    !Array.isArray(value.conflicts) ||
    !value.conflicts.every(
      (conflict) =>
        isRecord(conflict) &&
        isOneOf(CONFLICT_KINDS, conflict.kind) &&
        typeof conflict.summary === 'string' &&
        Array.isArray(conflict.sources) &&
        conflict.sources.every((source) => isOneOf(SOURCE_KINDS, source)),
    )
  ) {
    throw new Error(`${id}: invalid conflicts`);
  }

  if (
    value.browserProvenance !== undefined &&
    (!isRecord(value.browserProvenance) ||
      !Array.isArray(value.browserProvenance.sourceKinds) ||
      !value.browserProvenance.sourceKinds.every((source) => isOneOf(SOURCE_KINDS, source)) ||
      !isStringArray(value.browserProvenance.redactedPathLabels) ||
      typeof value.browserProvenance.observationCount !== 'number' ||
      !isOneOf(['browser_safe', 'redacted'], value.browserProvenance.redaction))
  ) {
    throw new Error(`${id}: invalid browserProvenance`);
  }

  if (
    value.realSource !== undefined &&
    (!isRecord(value.realSource) ||
      typeof value.realSource.sourceName !== 'string' ||
      typeof value.realSource.allowlistedPath !== 'string' ||
      typeof value.realSource.redaction !== 'string')
  ) {
    throw new Error(`${id}: invalid realSource`);
  }
}

export function parseWorkNodes(value: unknown): WorkNode[] {
  if (!Array.isArray(value)) {
    throw new Error('WorkNodes payload must be an array');
  }

  value.forEach(assertWorkNode);
  return value;
}
