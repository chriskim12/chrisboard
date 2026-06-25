const FULL_PARENT_GOAL = `Chrisboard becomes Chris's WorkNode operational SSOT for scattered work identity, goal contract, evidence-backed state projection, next action, and residue/conflict/freshness accounting, while raw evidence remains in source systems and the UI stays read-only until a later control-plane approval.`;

const COMPLETION_STANDARD = `Chris can open Chrisboard and, within 30 seconds, know what needs intervention, which work is running/blocked/review-ready/residue/stale/conflicting, why that judgment was made, what evidence supports it, what original parent goal is at stake, and what the next safe action is. The board must avoid manual status truth and must distinguish child completion, landed changes, final Done, and residue.`;

const REQUIRED_OUTCOMES = [
  'Observation-backed source ingestion exists for the approved source inventory.',
  'WorkNode identity graph maps aliases/source traces to canonical work nodes.',
  'Goal contracts capture original goal, Done criteria, approval gates, and scope reductions.',
  'Reconciliation policy derives canonical status from observations and contracts with explainable decision traces.',
  'Parent/child hierarchy prevents child Done from becoming parent Done without parent acceptance evidence.',
  'Residue, conflict, freshness, and approval gates are first-class and visible.',
  'UI remains read-only and focuses on Needs Chris / intervention queue first.',
  'Refresh/publish lifecycle prevents stale generated artifacts from masquerading as live truth.',
];

const NON_DONE_IF_MISSING = [
  'Auto-discovery/inventory is absent and all real work must be manually anchored.',
  'Status can be manually written or agent self-report can produce Done.',
  'Goal contract and scope reduction records are absent.',
  'Reconciliation lacks decision trace / missing evidence explanation.',
  'Parent goal completion is inferred from children only.',
  'Generated projection can stale silently without freshness/provenance warnings.',
  'Residue/conflict/approval gates are hidden or treated as cosmetic badges only.',
];

const LOCAL_READONLY_SCOPE = 'Local source edits, generated artifacts, tests/build/readonly verification, commit/push/deploy where configured credentials permit; UI remains read-only and source systems retain raw evidence.';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasObservation(observations, type) {
  return observations.some((observation) => observation.observationType === type);
}

function defaultApprovalGates(identityNode) {
  const gates = [
    {
      gate: 'Read-only UI boundary',
      requiredBefore: 'Any browser control-plane action, dispatch, status write, pause/resume, assignment, gateway, private integration, account, env, secret, or production DB mutation.',
      status: 'not_requested',
    },
    {
      gate: 'Broad source expansion',
      requiredBefore: 'Broad Discord history ingestion or external integration/write API ingestion beyond approved safe local/read-only sources.',
      status: 'not_requested',
    },
  ];
  if (identityNode.kind === 'ParentGoal') {
    gates.push({
      gate: 'Parent acceptance evidence',
      requiredBefore: 'Final DONE for the parent WorkNode operational SSOT outcome.',
      status: 'pending',
    });
  }
  return gates;
}

function doneCriteriaFor(identityNode) {
  if (identityNode.kind === 'ParentGoal') return REQUIRED_OUTCOMES;
  if (identityNode.kind === 'ChildWork') {
    return [
      'Child work has source-backed final proof or verifier receipt.',
      'Child work has no unresolved residue, conflict, stale source, reader error, or approval blocker.',
      'Parent goal acceptance remains separate and is not inferred from this child.',
    ];
  }
  return [
    'Standalone task has source-backed final proof or explicit triage disposition.',
    'Standalone task has no unresolved residue, conflict, stale source, reader error, or approval blocker.',
  ];
}

function scopeReductionLedger(identityNode) {
  return [{
    approvedByChris: false,
    delta: identityNode.kind === 'ParentGoal'
      ? 'No approved scope reduction is recorded; prior first-envelope work is accounting/progress only and the full parent objective remains expected.'
      : 'No approved child-level scope reduction is recorded; child completion cannot shrink the parent objective.',
    userCanNoLongerExpect: 'Nothing is removed from the approved full parent objective by this record.',
    evidenceRef: 'canonical-ralplan:2026-06-25-chrisboard-worknode-ssot-final-target',
  }];
}

export function validateGoalContract(value) {
  if (!isRecord(value)) throw new Error('GoalContract must be an object');
  for (const field of ['canonicalId', 'originalGoal', 'approvedScope']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) throw new Error(`GoalContract ${field} is required`);
  }
  for (const field of ['doneCriteria', 'nonDoneIfMissing']) {
    if (!Array.isArray(value[field]) || !value[field].every((item) => typeof item === 'string' && item.length > 0)) throw new Error(`GoalContract ${field} must be non-empty strings`);
  }
  if (!Array.isArray(value.doneCriteria) || value.doneCriteria.length === 0) throw new Error('GoalContract doneCriteria is required');
  if (!Array.isArray(value.nonDoneIfMissing) || value.nonDoneIfMissing.length === 0) throw new Error('GoalContract nonDoneIfMissing is required');
  if (!Array.isArray(value.approvalGates)) throw new Error('GoalContract approvalGates must be an array');
  for (const gate of value.approvalGates) {
    if (!isRecord(gate) || typeof gate.gate !== 'string' || typeof gate.requiredBefore !== 'string' || typeof gate.status !== 'string') throw new Error('GoalContract approvalGate is invalid');
  }
  if (!Array.isArray(value.scopeReductions) || value.scopeReductions.length === 0) throw new Error('GoalContract scopeReductions must be recorded');
  for (const reduction of value.scopeReductions) {
    if (!isRecord(reduction) || typeof reduction.approvedByChris !== 'boolean' || typeof reduction.delta !== 'string' || typeof reduction.userCanNoLongerExpect !== 'string' || typeof reduction.evidenceRef !== 'string') {
      throw new Error('GoalContract scopeReduction is invalid');
    }
  }
  if (typeof value.parentAcceptanceRequired !== 'boolean') throw new Error('GoalContract parentAcceptanceRequired is required');
  return value;
}

export function buildGoalContracts(identityNodes, observations) {
  const observationsByNode = new Map();
  for (const observation of observations) {
    observationsByNode.set(observation.worknodeId, [...(observationsByNode.get(observation.worknodeId) ?? []), observation]);
  }

  return identityNodes.map((identityNode) => {
    const nodeObservations = observationsByNode.get(identityNode.canonicalId) ?? [];
    const isParent = identityNode.kind === 'ParentGoal';
    const approvedScope = isParent
      ? `${LOCAL_READONLY_SCOPE} Completion standard: ${COMPLETION_STANDARD}`
      : `Evidence-backed ${identityNode.kind} projection contributing to the parent goal; parent DONE requires separate parent acceptance evidence.`;
    const approvalGates = defaultApprovalGates(identityNode).map((gate) => {
      if (gate.gate === 'Parent acceptance evidence' && hasObservation(nodeObservations, 'parent_acceptance')) return { ...gate, status: 'approved' };
      return gate;
    });
    return validateGoalContract({
      canonicalId: identityNode.canonicalId,
      originalGoal: FULL_PARENT_GOAL,
      approvedScope,
      doneCriteria: doneCriteriaFor(identityNode),
      nonDoneIfMissing: NON_DONE_IF_MISSING,
      approvalGates,
      scopeReductions: scopeReductionLedger(identityNode),
      parentAcceptanceRequired: isParent,
    });
  }).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

export function goalContractConstants() {
  return { fullParentGoal: FULL_PARENT_GOAL, completionStandard: COMPLETION_STANDARD, requiredOutcomes: REQUIRED_OUTCOMES, nonDoneIfMissing: NON_DONE_IF_MISSING };
}
