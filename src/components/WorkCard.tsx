import type { WorkNode } from '../domain/worknode';
import { StatusChip } from './StatusChip';

interface WorkCardProps {
  node: WorkNode;
  selected: boolean;
  onSelect(node: WorkNode): void;
}

const kindLabel = {
  ParentGoal: 'Parent',
  ChildWork: 'Child',
  StandaloneTask: 'Standalone',
};

export function WorkCard({ node, selected, onSelect }: WorkCardProps) {
  const chips = [
    node.executorLane,
    node.completionDepth.replace('_', ' '),
    node.residueState.hasResidue ? 'residue' : undefined,
    node.conflicts.length > 0 ? 'conflict' : undefined,
    node.realSource ? 'real read-only' : undefined,
  ].filter(Boolean);

  return (
    <button className={`work-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(node)} type="button">
      <div className="card-row">
        <span className="node-kind">{kindLabel[node.kind]}</span>
        <StatusChip status={node.canonicalStatus} />
      </div>
      <h3>{node.title}</h3>
      <p>{node.statusReason}</p>
      <div className="chips">
        {chips.map((chip) => (
          <span className="chip" key={chip}>{chip}</span>
        ))}
      </div>
    </button>
  );
}
