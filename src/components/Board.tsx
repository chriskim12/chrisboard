import { useMemo, useState } from 'react';
import type { WorkNode } from '../domain/worknode';
import { WORK_STATUSES } from '../domain/worknode';
import { deriveCompletionDepth } from '../judgement/worknodeJudgement';
import { DetailPanel } from './DetailPanel';
import { LaneGroup } from './LaneGroup';

interface BoardProps {
  nodes: readonly WorkNode[];
}

export function Board({ nodes }: BoardProps) {
  const judgedNodes = useMemo(() => {
    return nodes.map((node) => {
      const children = nodes.filter((candidate) => candidate.kind === 'ChildWork' && candidate.parentGoalId === node.id);
      return { ...node, completionDepth: deriveCompletionDepth(node, children) };
    });
  }, [nodes]);

  const [selectedId, setSelectedId] = useState(judgedNodes.find((node) => node.realSource)?.id ?? judgedNodes[0]?.id);
  const selected = judgedNodes.find((node) => node.id === selectedId) ?? judgedNodes[0];

  const realCount = judgedNodes.filter((node) => node.realSource).length;
  const waitingCount = judgedNodes.filter((node) => node.canonicalStatus === 'WAITING' || node.executionState === 'blocked').length;
  const parentPartialCount = judgedNodes.filter((node) => node.completionDepth === 'parent_partial').length;
  const residueCount = judgedNodes.filter((node) => node.residueState.hasResidue || node.canonicalStatus === 'RESIDUE').length;

  return (
    <main className="layout">
      <section className="board-shell" aria-label="Chrisboard read-only WorkNode board">
        <div className="focus-row">
          <div className="focus-card hot"><strong>{realCount}</strong><span>real read-only WorkNodes</span></div>
          <div className="focus-card"><strong>{waitingCount}</strong><span>waiting / blocked</span></div>
          <div className="focus-card"><strong>{parentPartialCount}</strong><span>parent not done</span></div>
          <div className="focus-card"><strong>{residueCount}</strong><span>residue</span></div>
        </div>
        <div className="status-vocabulary" aria-label="Exact status vocabulary">
          {WORK_STATUSES.join(' → ')}
        </div>
        <div className="lanes">
          <LaneGroup title="Plan" statuses={['TRIAGE', 'TODO']} nodes={judgedNodes} selectedId={selected?.id} onSelect={(node) => setSelectedId(node.id)} />
          <LaneGroup title="Active" statuses={['DOING', 'WAITING']} nodes={judgedNodes} selectedId={selected?.id} onSelect={(node) => setSelectedId(node.id)} />
          <LaneGroup title="Close" statuses={['REVIEW', 'DONE', 'RESIDUE']} nodes={judgedNodes} selectedId={selected?.id} onSelect={(node) => setSelectedId(node.id)} />
        </div>
      </section>
      {selected ? <DetailPanel node={selected} /> : null}
    </main>
  );
}
