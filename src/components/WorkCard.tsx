import type { WorkNode } from '../domain/worknode';

interface WorkCardProps {
  node: WorkNode;
  selected: boolean;
  onSelect(node: WorkNode): void;
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

function shortLane(lane: WorkNode['executorLane']) {
  if (lane === 'Hermes direct') return 'Hermes';
  if (lane === 'GJC delegated') return 'GJC';
  return lane;
}

export function WorkCard({ node, selected, onSelect }: WorkCardProps) {
  const parent = node.parentGoalTitle ?? (node.kind === 'ParentGoal' ? 'Parent goal' : 'Standalone');
  const parentDepth = node.kind === 'ParentGoal' ? `Parent ${node.completionDepth === 'parent_done' ? 'accepted' : 'open'}` : node.completionDepth === 'child_done' ? 'Child complete' : undefined;
  const smallSignals = [
    needsChris(node) ? 'Needs Chris' : undefined,
    node.executionState === 'blocked' ? 'Blocked' : undefined,
    node.conflicts.length > 0 ? 'Conflict' : undefined,
    node.residueState.hasResidue ? 'Residue' : undefined,
    node.freshness === 'stale' ? 'Stale' : undefined,
    parentDepth,
    node.identityMapping?.mappingStatus === 'auto_discovered' ? 'Auto-discovered' : undefined,
    node.identityMapping?.mappingStatus === 'needs_mapping' ? 'Needs mapping' : undefined,
    node.identityMapping?.mappingStatus === 'conflict' ? 'Identity conflict' : undefined,
    node.goalContract ? 'Contract' : undefined,
    node.evidenceLinks.length > 0 ? `Evidence ${node.evidenceLinks.length}` : undefined,
  ].filter(Boolean);

  return (
    <button aria-pressed={selected} className={`work-card ${selected ? 'selected' : ''}`} onClick={() => onSelect(node)} type="button">
      <span className="work-card-title">{node.title}</span>
      <span className="card-meta">
        <span>{parent}</span>
        <span>{shortLane(node.executorLane)}</span>
      </span>
      <span className="work-card-description">{node.blocker ?? node.nextAction ?? node.statusReason}</span>
      {smallSignals.length > 0 ? (
        <span className="chips" aria-label="Signals">
          {smallSignals.map((signal) => (
            <span className="chip" key={signal}>{signal}</span>
          ))}
        </span>
      ) : null}
    </button>
  );
}
