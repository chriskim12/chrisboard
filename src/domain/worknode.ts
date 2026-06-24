export const WORK_STATUSES = [
  'TRIAGE',
  'TODO',
  'DOING',
  'WAITING',
  'REVIEW',
  'DONE',
  'RESIDUE',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_NODE_KINDS = ['ParentGoal', 'ChildWork', 'StandaloneTask'] as const;
export type WorkNodeKind = (typeof WORK_NODE_KINDS)[number];

export type CompletionDepth = 'child_done' | 'parent_partial' | 'parent_done' | 'unknown';
export type ExecutorLane = 'Hermes direct' | 'GJC delegated' | 'other' | 'unknown';
export type ExecutionState = 'running' | 'blocked' | 'completed' | 'stale' | 'unknown';
export type SourceKind = 'Discord' | 'Hermes' | 'GJC' | 'Git' | 'PR' | 'tests' | 'Kanban' | 'Spec' | 'Repo' | 'Plan';

export interface LinkRef {
  label: string;
  url?: string;
  localPath?: string;
}

export interface EvidenceLink extends LinkRef {
  kind: 'plan' | 'spec' | 'artifact' | 'test' | 'session' | 'repo' | 'log' | 'receipt';
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
  realSource?: {
    sourceName: string;
    allowlistedPath: string;
    redaction: string;
  };
}
