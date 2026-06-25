const STATUS_REASON = {
  TRIAGE: 'Raw Hermes TRIAGE capture is preserved as an idea, not execution approval.',
  TODO: 'Allowlisted plan/spec evidence exists, but execution/final proof is not established.',
  RUNNING: 'Fresh explicit execution evidence is present.',
  REVIEW: 'Output or self-report evidence exists and needs verifier or human review.',
  BLOCKED: 'Required source evidence failed or a blocker prevents safe progress.',
  LANDED: 'Integration/landing evidence exists, but final proof is still separate.',
  RESIDUE: 'Cleanup, dirty, unpushed, stale, or residue evidence prevents false DONE.',
  DONE: 'Final proof and parent/final acceptance are present with no blocking residue/conflict.',
};

const SOURCE_KIND_TO_DOMAIN = {
  Git: 'Git',
  GJC: 'GJC',
  OMH: 'OMH',
  HermesTriage: 'HermesTriage',
  DiscordAnchor: 'DiscordAnchor',
};

function has(observations, ...types) {
  return observations.some((observation) => types.includes(observation.observationType));
}

function unique(values) {
  return [...new Set(values)];
}

function statusFor(observations) {
  if (has(observations, 'triage_item')) return 'TRIAGE';
  if (has(observations, 'reader_error', 'blocked')) return 'BLOCKED';
  if (has(observations, 'residue', 'git_dirty', 'git_unpushed')) return 'RESIDUE';
  if (has(observations, 'conflict')) return 'REVIEW';
  if (has(observations, 'final_proof') && has(observations, 'parent_acceptance')) return 'DONE';
  if (has(observations, 'git_landed')) return 'LANDED';
  if (has(observations, 'review_needed', 'artifact_present', 'verifier_receipt', 'self_report')) return 'REVIEW';
  if (has(observations, 'execution_active')) return 'RUNNING';
  if (has(observations, 'plan_present', 'approval_boundary')) return 'TODO';
  return 'BLOCKED';
}

function executionStateFor(status) {
  if (status === 'RUNNING') return 'running';
  if (status === 'BLOCKED') return 'blocked';
  if (status === 'DONE' || status === 'LANDED') return 'completed';
  if (status === 'RESIDUE') return 'stale';
  return 'unknown';
}

function completionDepthFor(anchor, status, observations) {
  if (anchor.kind === 'ChildWork') return status === 'DONE' ? 'child_done' : 'unknown';
  if (anchor.kind === 'ParentGoal') {
    return status === 'DONE' && has(observations, 'parent_acceptance') ? 'parent_done' : 'unknown';
  }
  return status === 'DONE' ? 'parent_done' : 'unknown';
}

function conflictFromObservation(observation) {
  if (observation.observationType === 'conflict') {
    return {
      kind: 'source_conflict',
      summary: observation.summary,
      sources: [SOURCE_KIND_TO_DOMAIN[observation.sourceKind]],
    };
  }
  if (observation.observationType === 'reader_error') {
    return {
      kind: 'evidence_missing',
      summary: observation.summary,
      sources: [SOURCE_KIND_TO_DOMAIN[observation.sourceKind]],
    };
  }
  return null;
}

export function reconcileAnchor(anchor, observations, registryAnchors = []) {
  const status = statusFor(observations);
  const sourceKinds = unique(observations.map((observation) => SOURCE_KIND_TO_DOMAIN[observation.sourceKind]).filter(Boolean));
  const redactedPathLabels = unique(observations.map((observation) => observation.sourcePathLabel));
  const parent = anchor.parent_id ? registryAnchors.find((candidate) => candidate.id === anchor.parent_id) : undefined;
  const residueObservations = observations.filter((observation) => ['residue', 'git_dirty', 'git_unpushed'].includes(observation.observationType));
  const displayableObservations = observations.filter((observation) => observation.redaction !== 'verifier_only');
  const conflicts = observations.map(conflictFromObservation).filter(Boolean);

  return {
    id: anchor.id,
    kind: anchor.kind,
    title: anchor.title,
    ...(anchor.parent_id ? { parentGoalId: anchor.parent_id, parentGoalTitle: parent?.title ?? 'unknown' } : {}),
    canonicalStatus: status,
    statusReason: STATUS_REASON[status],
    completionDepth: completionDepthFor(anchor, status, observations),
    ...(anchor.thread_anchor ? { discordThread: { label: 'Thread/session anchor', localPath: String(anchor.thread_anchor) } } : {}),
    executorLane: observations.some((observation) => observation.sourceKind === 'GJC') ? 'GJC delegated' : 'unknown',
    executionState: executionStateFor(status),
    ...(status === 'BLOCKED' ? { blocker: observations.find((observation) => ['reader_error', 'blocked'].includes(observation.observationType))?.summary ?? STATUS_REASON.BLOCKED } : {}),
    nextAction: status === 'DONE' ? 'No local implementation action remains.' : 'Review source evidence and resolve the next conservative gate.',
    evidenceLinks: displayableObservations.slice(0, 6).map((observation) => ({
      label: observation.summary,
      kind: observation.sourceKind === 'HermesTriage' ? 'triage' : observation.sourceKind === 'Git' ? 'repo' : 'artifact',
      localPath: observation.sourcePathLabel,
      redacted: true,
    })),
    approvalGates: observations
      .filter((observation) => observation.observationType === 'approval_boundary')
      .map((observation) => ({
        label: 'Execution/control boundary',
        requiredBefore: observation.summary,
        status: 'not_requested',
      })),
    residueState: {
      hasResidue: residueObservations.length > 0,
      summary: residueObservations.length > 0 ? residueObservations.map((observation) => observation.summary).join('; ') : 'No residue evidence selected by reconciler.',
      items: residueObservations.map((observation) => observation.summary),
    },
    sourceStates: displayableObservations.map((observation) => ({
      source: SOURCE_KIND_TO_DOMAIN[observation.sourceKind],
      state: observation.observationType,
      observedAt: observation.observedAt,
      confidence: observation.confidence,
      details: observation.summary,
    })),
    conflicts,
    updatedAt: observations[0]?.observedAt,
    browserProvenance: {
      sourceKinds,
      redactedPathLabels,
      observationCount: observations.length,
      redaction: 'redacted',
    },
    realSource: {
      sourceName: 'Generated source-backed read model',
      allowlistedPath: redactedPathLabels.join(', '),
      redaction: 'Browser data contains redacted source labels only; raw paths/content remain verifier-side.',
    },
  };
}

export function reconcileWorkNodes(anchors, observations) {
  return anchors.map((anchor) => reconcileAnchor(anchor, observations.filter((observation) => observation.worknodeId === anchor.id), anchors));
}

export function statusForObservationsForTest(observations) {
  return statusFor(observations);
}
