const STATUS_REASON = {
  TRIAGE: 'Raw Hermes TRIAGE capture is preserved as an idea, not execution approval.',
  TODO: 'Allowlisted source, plan, or contract evidence exists, but execution/final proof is not established.',
  RUNNING: 'Fresh explicit execution evidence is present.',
  REVIEW: 'Output, self-report, conflict, or mapping evidence needs verifier or human review.',
  BLOCKED: 'Required source evidence failed or a blocker prevents safe progress.',
  LANDED: 'Integration/landing evidence exists, but final proof is still separate.',
  RESIDUE: 'Cleanup, dirty, unpushed, stale, or residue evidence prevents false DONE.',
  DONE: 'Final proof and parent/final acceptance are present with no blocking residue/conflict.',
};

const SOURCE_KIND_TO_DOMAIN = {
  Git: 'Git',
  GJC: 'GJC',
  OMH: 'OMH',
  Hermes: 'Hermes',
  HermesTriage: 'HermesTriage',
  DiscordAnchor: 'DiscordAnchor',
  GitHub: 'GitHub',
  Deploy: 'Deploy',
  Kanban: 'Kanban',
};

const STATUS_RULES = [
  ['BLOCKED', 'reader_error_or_blocked_source', ['reader_error', 'blocked', 'source_missing']],
  ['RESIDUE', 'residue_or_dirty_local_state', ['residue', 'git_dirty', 'git_unpushed']],
  ['REVIEW', 'source_conflict_or_identity_ambiguity', ['conflict']],
  ['DONE', 'final_proof_with_parent_acceptance', ['final_proof', 'parent_acceptance']],
  ['LANDED', 'landed_without_final_contract_proof', ['git_landed']],
  ['REVIEW', 'reviewable_output_or_self_report', ['review_needed', 'artifact_present', 'verifier_receipt', 'self_report']],
  ['RUNNING', 'fresh_execution_evidence', ['execution_active']],
  ['TODO', 'allowlisted_source_or_plan_present', ['source_discovered', 'plan_present', 'approval_boundary']],
  ['TRIAGE', 'raw_triage_capture_only', ['triage_item']],
];

function has(observations, ...types) {
  return observations.some((observation) => types.includes(observation.observationType));
}

function unique(values) {
  return [...new Set(values)];
}

function baseStatusFor(observations) {
  if (has(observations, 'reader_error', 'blocked', 'source_missing')) return 'BLOCKED';
  if (has(observations, 'residue', 'git_dirty', 'git_unpushed')) return 'RESIDUE';
  if (has(observations, 'conflict')) return 'REVIEW';
  if (has(observations, 'final_proof') && has(observations, 'parent_acceptance')) return 'REVIEW';
  if (has(observations, 'git_landed')) return 'LANDED';
  if (has(observations, 'review_needed', 'artifact_present', 'verifier_receipt', 'self_report')) return 'REVIEW';
  if (has(observations, 'execution_active')) return 'RUNNING';
  if (has(observations, 'source_discovered', 'plan_present', 'approval_boundary')) return 'TODO';
  if (has(observations, 'triage_item')) return 'TRIAGE';
  return 'BLOCKED';
}

function hasBlockingApprovalGate(goalContract) {
  return (goalContract?.approvalGates ?? []).some((gate) => gate.status === 'blocked' && !String(gate.gate).includes('Read-only UI boundary'));
}

function hasContractForDone(goalContract) {
  return Boolean(goalContract?.doneCriteria?.length && goalContract?.nonDoneIfMissing?.length && goalContract?.scopeReductions?.length);
}

function statusFor(observations, anchor = {}, identityNode, goalContract, freshness = 'fresh') {
  if (has(observations, 'reader_error', 'blocked', 'source_missing')) return 'BLOCKED';
  if (hasBlockingApprovalGate(goalContract) || has(observations, 'approval_blocked')) return 'BLOCKED';
  if (has(observations, 'residue', 'git_dirty', 'git_unpushed')) return 'RESIDUE';
  if (has(observations, 'conflict') || identityNode?.mappingStatus === 'conflict' || identityNode?.mappingStatus === 'needs_mapping') return 'REVIEW';
  if (freshness === 'stale' && (has(observations, 'final_proof') || has(observations, 'parent_acceptance'))) return 'REVIEW';
  if (hasContractForDone(goalContract) && has(observations, 'final_proof') && (!goalContract?.parentAcceptanceRequired || has(observations, 'parent_acceptance'))) return 'DONE';
  if (has(observations, 'git_landed')) return 'LANDED';
  if (has(observations, 'review_needed', 'artifact_present', 'verifier_receipt', 'self_report')) return 'REVIEW';
  if (has(observations, 'execution_active')) return 'RUNNING';
  if (has(observations, 'source_discovered', 'plan_present', 'approval_boundary') || hasContractForDone(goalContract)) return 'TODO';
  if (has(observations, 'triage_item')) return 'TRIAGE';
  return baseStatusFor(observations);
}

function executionStateFor(status, freshness) {
  if (freshness === 'stale') return 'stale';
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
  if (['reader_error', 'source_missing'].includes(observation.observationType)) {
    return {
      kind: 'evidence_missing',
      summary: observation.summary,
      sources: [SOURCE_KIND_TO_DOMAIN[observation.sourceKind]],
    };
  }
  return null;
}

function latestObservationTime(observations) {
  const times = observations
    .map((observation) => Date.parse(observation.observedAt))
    .filter((value) => Number.isFinite(value));
  return times.length > 0 ? Math.max(...times) : null;
}

function freshnessFor(observations, generatedAt = new Date().toISOString()) {
  if (observations.length === 0) return 'unknown';
  const latest = latestObservationTime(observations);
  const now = Date.parse(generatedAt);
  if (!latest || !Number.isFinite(now)) return 'unknown';
  return now - latest > 24 * 60 * 60 * 1000 ? 'stale' : 'fresh';
}

function winningRuleFor(status, observations, identityNode, goalContract, freshness) {
  if (status === 'DONE') return 'final_proof_with_contract_and_parent_acceptance';
  if (freshness === 'stale') return 'stale_source_observation_requires_refresh';
  if (status === 'REVIEW' && (identityNode?.mappingStatus === 'conflict' || identityNode?.mappingStatus === 'needs_mapping')) return 'identity_mapping_requires_review';
  if (status === 'BLOCKED' && hasBlockingApprovalGate(goalContract)) return 'hard_approval_gate_blocks_progress';
  const matched = STATUS_RULES.find(([candidateStatus, , types]) => candidateStatus === status && types.some((type) => has(observations, type)));
  return matched?.[1] ?? 'fail_closed_no_matching_evidence';
}

function suppressedRulesFor(status, observations, identityNode, goalContract, freshness) {
  const winningRule = winningRuleFor(status, observations, identityNode, goalContract, freshness);
  const winningIndex = STATUS_RULES.findIndex(([candidateStatus, rule]) => candidateStatus === status && rule === winningRule);
  if (winningIndex < 0) return [];
  return STATUS_RULES
    .slice(Math.max(0, winningIndex + 1))
    .filter(([, , types]) => types.some((type) => has(observations, type)))
    .map(([, rule]) => rule);
}

function missingEvidenceFor(status, anchor, observations, freshness, identityNode, goalContract) {
  const missing = [];
  if (!hasContractForDone(goalContract)) missing.push('goal contract with Done criteria, non-done rules, and scope reduction accounting');
  if (!identityNode || identityNode.mappingStatus === 'needs_mapping') missing.push('canonical identity mapping');
  if (identityNode?.mappingStatus === 'conflict') missing.push('identity conflict resolution');
  if (status !== 'DONE') missing.push('final proof and contract/parent acceptance evidence');
  if ((anchor.kind === 'ParentGoal' || goalContract?.parentAcceptanceRequired) && !has(observations, 'parent_acceptance')) missing.push('parent acceptance evidence');
  if (freshness !== 'fresh') missing.push('fresh source observation inside freshness TTL');
  if (observations.length === 0) missing.push('allowlisted source observation');
  return unique(missing);
}

function confidenceFor(observations, freshness, conflicts) {
  if (freshness !== 'fresh' || conflicts.length > 0 || observations.some((observation) => observation.confidence === 'low')) return 'low';
  if (observations.some((observation) => observation.confidence === 'medium')) return 'medium';
  return 'high';
}

function nextActionFor(status, freshness, conflicts, residueObservations) {
  if (freshness === 'stale') return 'Refresh the local read model before trusting this projection.';
  if (status === 'BLOCKED') return 'Resolve the missing evidence, reader error, or approval blocker before proceeding.';
  if (status === 'RESIDUE') return `Clear residue before any DONE claim: ${residueObservations.map((observation) => observation.summary).join('; ')}`;
  if (conflicts.length > 0) return 'Resolve source conflict or identity ambiguity before accepting the projection.';
  if (status === 'TRIAGE') return 'Decide whether to admit this TRIAGE item into an approved goal contract.';
  if (status === 'TODO') return 'Review discovered source/plan evidence and map it to an approved goal contract.';
  if (status === 'REVIEW') return 'Independently verify the output evidence and record final proof if accepted.';
  if (status === 'RUNNING') return 'Monitor execution evidence and wait for verifier output.';
  if (status === 'LANDED') return 'Collect final proof and parent acceptance before marking the parent outcome done.';
  return 'No local implementation action remains.';
}

export function reconcileAnchor(anchor, observations, registryAnchors = [], options = {}) {
  const sortedObservations = [...observations].sort((a, b) => a.id.localeCompare(b.id));
  const identityNode = options.identityNode ?? options.identityById?.get(anchor.id);
  const goalContract = options.goalContract ?? options.goalContractsById?.get(anchor.id);
  const sourceKinds = unique(sortedObservations.map((observation) => SOURCE_KIND_TO_DOMAIN[observation.sourceKind]).filter(Boolean));
  const redactedPathLabels = unique(sortedObservations.map((observation) => observation.sourcePathLabel));
  const parent = anchor.parent_id ? registryAnchors.find((candidate) => candidate.id === anchor.parent_id) : undefined;
  const residueObservations = sortedObservations.filter((observation) => ['residue', 'git_dirty', 'git_unpushed'].includes(observation.observationType));
  const displayableObservations = sortedObservations.filter((observation) => observation.redaction !== 'verifier_only');
  const conflicts = sortedObservations.map(conflictFromObservation).filter(Boolean);
  const freshness = freshnessFor(sortedObservations, options.generatedAt);
  const status = statusFor(sortedObservations, anchor, identityNode, goalContract, freshness);
  const confidence = confidenceFor(sortedObservations, freshness, conflicts);
  const decisionTrace = {
    canonicalStatus: status,
    winningRule: winningRuleFor(status, sortedObservations, identityNode, goalContract, freshness),
    statusReason: STATUS_REASON[status],
    suppressedRules: suppressedRulesFor(status, sortedObservations, identityNode, goalContract, freshness),
    missingEvidence: missingEvidenceFor(status, anchor, sortedObservations, freshness, identityNode, goalContract),
    conflicts,
    confidence,
    freshness,
  };

  return {
    id: anchor.id,
    kind: anchor.kind,
    title: anchor.title,
    ...(anchor.parent_id ? { parentGoalId: anchor.parent_id, parentGoalTitle: parent?.title ?? 'unknown' } : {}),
    canonicalStatus: status,
    statusReason: STATUS_REASON[status],
    completionDepth: completionDepthFor(anchor, status, sortedObservations),
    ...(anchor.thread_anchor ? { discordThread: { label: 'Thread/session anchor', localPath: String(anchor.thread_anchor) } } : {}),
    executorLane: sortedObservations.some((observation) => observation.sourceKind === 'GJC') ? 'GJC delegated' : sortedObservations.some((observation) => observation.sourceKind === 'Hermes') ? 'Hermes direct' : 'unknown',
    executionState: executionStateFor(status, freshness),
    ...(status === 'BLOCKED' ? { blocker: sortedObservations.find((observation) => ['reader_error', 'blocked', 'source_missing'].includes(observation.observationType))?.summary ?? STATUS_REASON.BLOCKED } : {}),
    nextAction: nextActionFor(status, freshness, conflicts, residueObservations),
    evidenceLinks: displayableObservations.slice(0, 6).map((observation) => ({
      label: observation.summary,
      kind: observation.sourceKind === 'HermesTriage' ? 'triage' : observation.sourceKind === 'Git' ? 'repo' : observation.sourceKind === 'Hermes' ? 'session' : 'artifact',
      localPath: observation.sourcePathLabel,
      redacted: true,
    })),
    approvalGates: sortedObservations
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
    updatedAt: sortedObservations[0]?.observedAt,
    browserProvenance: {
      sourceKinds,
      redactedPathLabels,
      observationCount: sortedObservations.length,
      redaction: 'redacted',
    },
    freshness,
    policyDecision: decisionTrace,
    identityMapping: {
      mappingStatus: identityNode?.mappingStatus ?? (anchor.discovered_source_id ? 'auto_discovered' : 'needs_mapping'),
      sourceRefs: identityNode?.sourceRefs ?? unique(sortedObservations.map((observation) => observation.sourceId)),
      aliases: identityNode?.aliases ?? [],
    },
    realSource: {
      sourceName: anchor.discovered_source_id ? 'Auto-discovered source inventory projection' : 'Generated source-backed read model',
      allowlistedPath: redactedPathLabels.join(', '),
      redaction: 'Browser data contains redacted source labels only; raw paths/content remain verifier-side.',
    },
    ...(goalContract ? { goalContract } : {}),
  };
}

export function reconcileWorkNodes(anchors, observations, options = {}) {
  return [...anchors]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((anchor) => reconcileAnchor(anchor, observations.filter((observation) => observation.worknodeId === anchor.id), anchors, {
      ...options,
      identityNode: options.identityById?.get(anchor.id),
      goalContract: options.goalContractsById?.get(anchor.id),
    }));
}

export function statusForObservationsForTest(observations, options = {}) {
  const freshness = freshnessFor(observations, options.generatedAt);
  return statusFor(observations, options.anchor ?? {}, options.identityNode, options.goalContract, freshness);
}
