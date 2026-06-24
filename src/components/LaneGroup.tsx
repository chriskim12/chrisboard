import type { WorkNode, WorkStatus } from '../domain/worknode';
import { WorkCard } from './WorkCard';

interface LaneGroupProps {
  status: WorkStatus;
  nodes: readonly WorkNode[];
  selectedId?: string;
  onSelect(node: WorkNode): void;
}

export function LaneGroup({ status, nodes, selectedId, onSelect }: LaneGroupProps) {
  const laneNodes = nodes.filter((node) => node.canonicalStatus === status);

  return (
    <section className="lane-group" aria-label={status}>
      <div className="lane-head">
        <h2>{status}</h2>
        <em>{laneNodes.length}</em>
      </div>
      <div className="lane-cards">
        {laneNodes.map((node) => (
          <WorkCard key={node.id} node={node} selected={node.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
