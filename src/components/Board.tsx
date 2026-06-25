import { useMemo, useState } from 'react';
import type { WorkNode } from '../domain/worknode';
import { WORK_STATUSES } from '../domain/worknode';
import { deriveCompletionDepth } from '../judgement/worknodeJudgement';
import { DetailPanel } from './DetailPanel';
import { LaneGroup } from './LaneGroup';

interface BoardProps {
  nodes: readonly WorkNode[];
}

function needsChris(node: WorkNode) {
  return node.executionState === 'blocked' ||
    node.conflicts.length > 0 ||
    node.residueState.hasResidue ||
    node.freshness === 'stale' ||
    node.identityMapping?.mappingStatus === 'needs_mapping' ||
    node.identityMapping?.mappingStatus === 'conflict' ||
    node.approvalGates.some((gate) => gate.status === 'pending' || gate.status === 'blocked') ||
    (node.goalContract?.approvalGates ?? []).some((gate) => gate.status === 'pending' || gate.status === 'blocked');
}

function interventionReason(node: WorkNode) {
  if (node.executionState === 'blocked') return node.blocker ?? 'Blocked evidence path';
  if (node.conflicts.length > 0) return node.conflicts[0].summary;
  if (node.residueState.hasResidue) return node.residueState.summary;
  if (node.freshness === 'stale') return 'Generated projection is stale';
  if (node.identityMapping?.mappingStatus === 'needs_mapping' || node.identityMapping?.mappingStatus === 'conflict') return `Identity mapping ${node.identityMapping.mappingStatus}`;
  const gate = node.approvalGates.find((candidate) => candidate.status === 'pending' || candidate.status === 'blocked');
  const contractGate = node.goalContract?.approvalGates.find((candidate) => candidate.status === 'pending' || candidate.status === 'blocked');
  return gate ? `${gate.label}: ${gate.status}` : contractGate ? `${contractGate.gate}: ${contractGate.status}` : node.nextAction ?? node.statusReason;
}

export function Board({ nodes }: BoardProps) {
  const judgedNodes = useMemo(() => {
    return nodes.map((node) => {
      const children = nodes.filter((candidate) => candidate.kind === 'ChildWork' && candidate.parentGoalId === node.id);
      return { ...node, completionDepth: node.completionDepth === 'unknown' ? deriveCompletionDepth(node, children) : node.completionDepth };
    });
  }, [nodes]);

  const interventionNodes = judgedNodes.filter(needsChris);
  const [selectedId, setSelectedId] = useState(interventionNodes[0]?.id ?? judgedNodes.find((node) => node.realSource)?.id ?? judgedNodes[0]?.id);
  const selected = judgedNodes.find((node) => node.id === selectedId) ?? judgedNodes[0];

  const needsChrisCount = interventionNodes.length;
  const blockedCount = judgedNodes.filter((node) => node.executionState === 'blocked').length;
  const residueCount = judgedNodes.filter((node) => node.residueState.hasResidue || node.canonicalStatus === 'RESIDUE').length;
  const conflictCount = judgedNodes.filter((node) => node.conflicts.length > 0).length;
  const staleCount = judgedNodes.filter((node) => node.freshness === 'stale').length;
  const approvalCount = judgedNodes.filter((node) => node.approvalGates.some((gate) => gate.status === 'pending' || gate.status === 'blocked' || gate.status === 'not_requested') || (node.goalContract?.approvalGates ?? []).some((gate) => gate.status === 'pending' || gate.status === 'blocked')).length;

  return (
    <main className="layout">
      <section className="board-shell" aria-label="Chrisboard board">
        <section className="focus-strip" aria-label="Needs Chris focus queue">
          <div>
            <h2>Needs Chris</h2>
            <p>Intervention-first projection from discovered local sources.</p>
          </div>
          <div className="focus-list">
            {interventionNodes.slice(0, 5).map((node) => (
              <button className="focus-item" key={node.id} onClick={() => setSelectedId(node.id)} type="button">
                <b>{node.title}</b>
                <span>{interventionReason(node)}</span>
              </button>
            ))}
            {interventionNodes.length === 0 ? <span className="focus-empty">No urgent local intervention signal.</span> : null}
          </div>
        </section>
        <div className="board-tools" aria-label="Board signals">
          <span>{judgedNodes.length} cards</span>
          {needsChrisCount > 0 ? <span className="signal hot">Needs Chris {needsChrisCount}</span> : null}
          {blockedCount > 0 ? <span className="signal">Blocked {blockedCount}</span> : null}
          {conflictCount > 0 ? <span className="signal">Conflict {conflictCount}</span> : null}
          {residueCount > 0 ? <span className="signal">Residue {residueCount}</span> : null}
          {staleCount > 0 ? <span className="signal">Stale {staleCount}</span> : null}
          {approvalCount > 0 ? <span className="signal">Approval gate {approvalCount}</span> : null}
        </div>
        <div className="lanes">
          {WORK_STATUSES.map((status) => (
            <LaneGroup
              key={status}
              status={status}
              nodes={judgedNodes}
              selectedId={selected?.id}
              onSelect={(node) => setSelectedId(node.id)}
            />
          ))}
        </div>
      </section>
      {selected ? <DetailPanel node={selected} /> : null}
    </main>
  );
}
