import type { WorkNode } from '../domain/worknode';
import type { ReadOnlyAdapter } from './readOnlyAdapter';

const SOURCE_PLAN = '/home/ubuntu/.hermes/omh/task-management-dashboard/plans/2026-06-24-chrisboard-v1-readonly-proof.md';
const SOURCE_GOALS = '.gjc/ultragoal/goals.json';
const SOURCE_LAUNCH_PROMPT = '.gjc/ultragoal/artifacts/chrisboard-ultragoal-launch-prompt.md';
const SOURCE_LEDGER = '.gjc/ultragoal/ledger.jsonl';

const mutationGate = {
  label: 'External/task mutation gate',
  requiredBefore: 'Any GitHub remote, PR, DNS, auth, deploy, gateway, Discord, Kanban, worker, production, provider, env, or secret mutation',
  status: 'not_requested' as const,
};

export const localProofWorkNodes: WorkNode[] = [
  {
    id: 'real-ralplan-chrisboard-v1',
    kind: 'ParentGoal',
    title: 'Chrisboard v1 read-only proof RALPLAN',
    canonicalStatus: 'DOING',
    statusReason: 'Real allowlisted plan evidence approves a local-only read-only proof; final proof is not parent Done until verification and closeout pass.',
    completionDepth: 'parent_partial',
    executorLane: 'Hermes direct',
    executionState: 'running',
    nextAction: 'Run focused local verification and preserve closeout evidence.',
    evidenceLinks: [
      { label: 'Approved local-only RALPLAN', kind: 'plan', localPath: SOURCE_PLAN, redacted: true },
      { label: 'Ultragoal launch prompt', kind: 'artifact', localPath: SOURCE_LAUNCH_PROMPT, redacted: true },
    ],
    approvalGates: [mutationGate],
    residueState: { hasResidue: false, summary: 'No runtime residue from local proof app', items: [] },
    sourceStates: [
      { source: 'Plan', state: 'local read-only proof approved', confidence: 'high', details: 'Allowlisted path explicitly names the first execution tranche and hard side-effect gates.' },
      { source: 'GJC', state: 'implementation active', confidence: 'high', details: 'Current Ultragoal lane is building the local proof inside /home/ubuntu/repos/chrisboard.' },
    ],
    conflicts: [],
    updatedAt: '2026-06-24T08:42:28.203Z',
    realSource: {
      sourceName: 'Approved RALPLAN markdown',
      allowlistedPath: SOURCE_PLAN,
      redaction: 'Only plan title, acceptance facts, and side-effect gates are rendered; no credentials, customer/provider data, or secrets are imported.',
    },
  },
  {
    id: 'real-ultragoal-g001',
    kind: 'ChildWork',
    title: 'G001 local Vite React TypeScript proof',
    parentGoalId: 'real-ralplan-chrisboard-v1',
    parentGoalTitle: 'Chrisboard v1 read-only proof RALPLAN',
    childScope: 'Build the local dashboard proof with WorkNode schema, read-only adapters, real redacted evidence, README gates, and focused verification.',
    canonicalStatus: 'DOING',
    statusReason: 'Real Ultragoal goals.json contains G001 pending for this exact local proof; current UI renders it as active child work rather than parent completion.',
    completionDepth: 'unknown',
    executorLane: 'GJC delegated',
    executionState: 'running',
    nextAction: 'Complete local proof verification; do not infer parent Done from this child until the closeout receipt exists.',
    evidenceLinks: [
      { label: 'Ultragoal goals.json G001', kind: 'receipt', localPath: SOURCE_GOALS, redacted: true },
      { label: 'Ultragoal ledger', kind: 'receipt', localPath: SOURCE_LEDGER, redacted: true },
    ],
    approvalGates: [mutationGate],
    residueState: { hasResidue: false, summary: 'No external worker or deployment residue allowed in this tranche', items: [] },
    sourceStates: [
      { source: 'GJC', state: 'pending/active child proof', confidence: 'high', details: 'Local Ultragoal goals file is allowlisted by the runner prompt and has been redacted to objective/status fields.' },
      { source: 'Repo', state: 'local-only files under construction', confidence: 'high', details: 'Work remains inside /home/ubuntu/repos/chrisboard.' },
    ],
    conflicts: [{ kind: 'approval_required', summary: 'Completion cannot be claimed until focused verification and Ultragoal closeout evidence exist.', sources: ['GJC', 'Repo'] }],
    updatedAt: '2026-06-24T08:42:28.203Z',
    realSource: {
      sourceName: 'Repo Ultragoal goals ledger',
      allowlistedPath: SOURCE_GOALS,
      redaction: 'Only id, title, objective summary, and status are represented; local absolute paths outside approved artifacts are not rendered.',
    },
  },
];

export const localProofAdapter: ReadOnlyAdapter = {
  id: 'local-proof',
  label: 'Allowlisted local proof evidence',
  mode: 'read-only',
  allowlistedSources: [SOURCE_PLAN, SOURCE_GOALS, SOURCE_LAUNCH_PROMPT, SOURCE_LEDGER],
  async loadWorkNodes() {
    return localProofWorkNodes;
  },
};
