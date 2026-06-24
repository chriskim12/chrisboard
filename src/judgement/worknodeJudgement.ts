import type { CompletionDepth, Conflict, SourceState, WorkNode } from '../domain/worknode';

export function deriveCompletionDepth(node: WorkNode, children: WorkNode[] = []): CompletionDepth {
  if (node.kind === 'StandaloneTask') {
    return node.canonicalStatus === 'DONE' ? 'parent_done' : 'unknown';
  }

  if (node.kind === 'ChildWork') {
    return node.canonicalStatus === 'DONE' ? 'child_done' : 'unknown';
  }

  const hasParentAcceptance = node.sourceStates.some(
    (source) => source.state.toLowerCase().includes('parent accepted') || source.state.toLowerCase().includes('parent verified'),
  );

  if (node.canonicalStatus === 'DONE' && hasParentAcceptance) {
    return 'parent_done';
  }

  if (children.some((child) => child.canonicalStatus === 'DONE')) {
    return 'parent_partial';
  }

  return 'unknown';
}

export function relationshipIssues(nodes: WorkNode[]): string[] {
  const ids = new Set(nodes.map((node) => node.id));
  return nodes.flatMap((node) => {
    if (node.kind === 'ParentGoal' && node.parentGoalId) {
      return [`${node.id}: ParentGoal must not carry parentGoalId`];
    }

    if (node.kind === 'ChildWork' && node.parentGoalId && !ids.has(node.parentGoalId)) {
      return [`${node.id}: ChildWork references missing parentGoalId ${node.parentGoalId}`];
    }

    if (node.kind === 'ChildWork' && !node.parentGoalId && !node.parentGoalTitle) {
      return [`${node.id}: ChildWork needs parentGoalId or explicit unknown-parent evidence`];
    }

    if (node.kind === 'StandaloneTask' && node.parentGoalId) {
      return [`${node.id}: StandaloneTask must not be forced under a fake parent`];
    }

    return [];
  });
}

export function sourceConflicts(sources: SourceState[]): Conflict[] {
  const normalized = new Set(sources.map((source) => source.state.trim().toLowerCase()).filter(Boolean));
  if (normalized.size <= 1) {
    return [];
  }

  return [
    {
      kind: 'source_conflict',
      summary: 'Source states disagree; canonical status is a dashboard judgement, not a writeback.',
      sources: sources.map((source) => source.source),
    },
  ];
}

export function readOnlyGateIssues(nodes: WorkNode[]): string[] {
  return nodes.flatMap((node) => {
    const gateIssues = node.approvalGates
      .filter((gate) => gate.status === 'approved' && gate.requiredBefore.toLowerCase().includes('write'))
      .map((gate) => `${node.id}: write gate ${gate.label} is incorrectly approved in v1`);

    const unsafeEvidence = node.evidenceLinks
      .filter((link) => !link.redacted)
      .map((link) => `${node.id}: evidence ${link.label} is not marked redacted`);

    return [...gateIssues, ...unsafeEvidence];
  });
}
