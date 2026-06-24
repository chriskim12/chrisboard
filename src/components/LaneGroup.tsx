import type { WorkNode, WorkStatus } from '../domain/worknode';
import { WorkCard } from './WorkCard';

interface LaneGroupProps {
  title: string;
  statuses: readonly WorkStatus[];
  nodes: readonly WorkNode[];
  selectedId?: string;
  onSelect(node: WorkNode): void;
}

export function LaneGroup({ title, statuses, nodes, selectedId, onSelect }: LaneGroupProps) {
  return (
    <section className="lane-group">
      <h2>{title}</h2>
      {statuses.map((status) => {
        const laneNodes = nodes.filter((node) => node.canonicalStatus === status);
        return (
          <section className="lane" key={status}>
            <div className="lane-head">
              <h3>{status}</h3>
              <em>{laneNodes.length}</em>
            </div>
            {laneNodes.map((node) => (
              <WorkCard key={node.id} node={node} selected={node.id === selectedId} onSelect={onSelect} />
            ))}
          </section>
        );
      })}
    </section>
  );
}
