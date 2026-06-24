import type { WorkNode } from '../domain/worknode';

interface WorkCardProps {
  node: WorkNode;
  selected: boolean;
  onSelect(node: WorkNode): void;
}

function needsChris(node: WorkNode) {
  return node.executionState === 'blocked' || node.approvalGates.some((gate) => gate.status === 'pending' || gate.status === 'blocked');
}

function shortLane(lane: WorkNode['executorLane']) {
  if (lane === 'Hermes direct') return 'Hermes';
  if (lane === 'GJC delegated') return 'GJC';
  return lane;
}

export function WorkCard({ node, selected, onSelect }: WorkCardProps) {
  const parent = node.parentGoalTitle ?? (node.kind === 'ParentGoal' ? 'Parent goal' : 'Standalone');
  const smallSignals = [
    needsChris(node) ? 'Needs Chris' : undefined,
    node.blocker ? 'Blocked' : undefined,
    node.conflicts.length > 0 ? 'Conflict' : undefined,
    node.residueState.hasResidue ? 'Residue' : undefined,
    node.evidenceLinks.length > 0 ? `Evidence ${node.evidenceLinks.length}` : undefined,
  ].filter(Boolean);

  return (
    <button className={`work-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(node)} type="button">
      <h3>{node.title}</h3>
      <div className="card-meta">
        <span>{parent}</span>
        <span>{shortLane(node.executorLane)}</span>
      </div>
      <p>{node.blocker ?? node.nextAction ?? node.statusReason}</p>
      {smallSignals.length > 0 ? (
        <div className="chips" aria-label="Signals">
          {smallSignals.map((signal) => (
            <span className="chip" key={signal}>{signal}</span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
