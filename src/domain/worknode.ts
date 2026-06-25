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
export type SourceKind = 'Discord' | 'DiscordAnchor' | 'Hermes' | 'HermesTriage' | 'GJC' | 'Git' | 'PR' | 'tests' | 'Spec' | 'Repo' | 'Plan' | 'OMH' | 'GitHub' | 'Deploy' | 'Kanban';

const COMPLETION_DEPTHS = ['child_done', 'parent_partial', 'parent_done', 'unknown'] as const;
const EXECUTOR_LANES = ['Hermes direct', 'GJC delegated', 'other', 'unknown'] as const;
const EXECUTION_STATES = ['running', 'blocked', 'completed', 'stale', 'unknown'] as const;
const SOURCE_KINDS = ['Discord', 'DiscordAnchor', 'Hermes', 'HermesTriage', 'GJC', 'Git', 'PR', 'tests', 'Spec', 'Repo', 'Plan', 'OMH', 'GitHub', 'Deploy', 'Kanban'] as const;
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
export interface PolicyDecisionTrace {
  canonicalStatus: WorkStatus;
  winningRule: string;
  statusReason: string;
  suppressedRules: string[];
  missingEvidence: string[];
  conflicts: Conflict[];
  confidence: 'high' | 'medium' | 'low';
  freshness: 'fresh' | 'stale' | 'unknown';
}
export interface IdentityAlias {
  kind: string;
  value: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScopeReduction {
  approvedByChris: boolean;
  delta: string;
  userCanNoLongerExpect: string;
  evidenceRef: string;
}

export interface GoalContract {
  canonicalId: string;
  originalGoal: string;
  approvedScope: string;
  doneCriteria: string[];
  nonDoneIfMissing: string[];
  approvalGates: Array<{ gate: string; requiredBefore: string; status: string }>;
  scopeReductions: ScopeReduction[];
  parentAcceptanceRequired: boolean;
}


export interface SourceRecord {
  sourceId: string;
  sourceKind: SourceKind;
  allowlistedPath?: string;
  browserLabel: string;
  discoveredAt: string;
  discoveryMode: 'configured' | 'auto_discovered' | 'manual_identity_mapping';
  fingerprint: string;
  redaction: 'browser_safe' | 'redacted' | 'verifier_only';
  freshnessTtl?: string;
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
  freshness?: 'fresh' | 'stale' | 'unknown';
  policyDecision?: PolicyDecisionTrace;
  identityMapping?: {
    mappingStatus: 'mapped' | 'auto_discovered' | 'needs_mapping' | 'conflict';
    sourceRefs: string[];
    aliases?: IdentityAlias[];
  };
  realSource?: {
    sourceName: string;
    allowlistedPath: string;
    redaction: string;
  };
  goalContract?: GoalContract;
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
  if (value.freshness !== undefined && !isOneOf(['fresh', 'stale', 'unknown'], value.freshness)) {
    throw new Error(`${id}: invalid freshness`);
  }

  if (
    value.policyDecision !== undefined &&
    (!isRecord(value.policyDecision) ||
      !isOneOf(WORK_STATUSES, value.policyDecision.canonicalStatus) ||
      typeof value.policyDecision.winningRule !== 'string' ||
      typeof value.policyDecision.statusReason !== 'string' ||
      !isStringArray(value.policyDecision.suppressedRules) ||
      !isStringArray(value.policyDecision.missingEvidence) ||
      !Array.isArray(value.policyDecision.conflicts) ||
      !isOneOf(CONFIDENCE_VALUES, value.policyDecision.confidence) ||
      !isOneOf(['fresh', 'stale', 'unknown'], value.policyDecision.freshness))
  ) {
    throw new Error(`${id}: invalid policyDecision`);
  }

  if (
    value.identityMapping !== undefined &&
    (!isRecord(value.identityMapping) ||
      !isOneOf(['mapped', 'auto_discovered', 'needs_mapping', 'conflict'], value.identityMapping.mappingStatus) ||
      !isStringArray(value.identityMapping.sourceRefs) ||
      (value.identityMapping.aliases !== undefined &&
        (!Array.isArray(value.identityMapping.aliases) ||
          !value.identityMapping.aliases.every(
            (alias) =>
              isRecord(alias) &&
              typeof alias.kind === 'string' &&
              typeof alias.value === 'string' &&
              isOneOf(CONFIDENCE_VALUES, alias.confidence),
          ))))
  ) {
    throw new Error(`${id}: invalid identityMapping`);
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

  if (
    value.goalContract !== undefined &&
    (!isRecord(value.goalContract) ||
      typeof value.goalContract.canonicalId !== 'string' ||
      typeof value.goalContract.originalGoal !== 'string' ||
      typeof value.goalContract.approvedScope !== 'string' ||
      !isStringArray(value.goalContract.doneCriteria) ||
      value.goalContract.doneCriteria.length === 0 ||
      !isStringArray(value.goalContract.nonDoneIfMissing) ||
      value.goalContract.nonDoneIfMissing.length === 0 ||
      !Array.isArray(value.goalContract.approvalGates) ||
      !Array.isArray(value.goalContract.scopeReductions) ||
      value.goalContract.scopeReductions.length === 0 ||
      typeof value.goalContract.parentAcceptanceRequired !== 'boolean')
  ) {
    throw new Error(`${id}: invalid goalContract`);
  }
}

export function parseWorkNodes(value: unknown): WorkNode[] {
  if (!Array.isArray(value)) {
    throw new Error('WorkNodes payload must be an array');
  }

  value.forEach(assertWorkNode);
  return value;
}
