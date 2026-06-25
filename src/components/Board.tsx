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
  return node.executionState === 'blocked' || node.approvalGates.some((gate) => gate.status === 'pending' || gate.status === 'blocked');
}

export function Board({ nodes }: BoardProps) {
  const judgedNodes = useMemo(() => {
    return nodes.map((node) => {
      const children = nodes.filter((candidate) => candidate.kind === 'ChildWork' && candidate.parentGoalId === node.id);
      return { ...node, completionDepth: node.completionDepth === 'unknown' ? deriveCompletionDepth(node, children) : node.completionDepth };
    });
  }, [nodes]);

  const [selectedId, setSelectedId] = useState(judgedNodes.find(needsChris)?.id ?? judgedNodes.find((node) => node.realSource)?.id ?? judgedNodes[0]?.id);
  const selected = judgedNodes.find((node) => node.id === selectedId) ?? judgedNodes[0];

  const needsChrisCount = judgedNodes.filter(needsChris).length;
  const blockedCount = judgedNodes.filter((node) => node.executionState === 'blocked').length;
  const residueCount = judgedNodes.filter((node) => node.residueState.hasResidue || node.canonicalStatus === 'RESIDUE').length;

  return (
    <main className="layout">
      <section className="board-shell" aria-label="Chrisboard board">
        <div className="board-tools" aria-label="Board signals">
          <span>{judgedNodes.length} cards</span>
          {needsChrisCount > 0 ? <span className="signal hot">Needs Chris {needsChrisCount}</span> : null}
          {blockedCount > 0 ? <span className="signal">Blocked {blockedCount}</span> : null}
          {residueCount > 0 ? <span className="signal">Residue {residueCount}</span> : null}
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
