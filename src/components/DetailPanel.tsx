import type { WorkNode } from '../domain/worknode';
import { StatusChip } from './StatusChip';

interface DetailPanelProps {
  node: WorkNode;
}

const kindLabel = {
  ParentGoal: 'Parent',
  ChildWork: 'Child',
  StandaloneTask: 'Standalone',
};

function parentLabel(node: WorkNode) {
  if (node.kind === 'ParentGoal') return 'self';
  if (node.kind === 'ChildWork') return node.parentGoalTitle ?? 'unknown';
  return 'none';
}

export function DetailPanel({ node }: DetailPanelProps) {
  const displayableApprovalGates = node.approvalGates.filter((gate) => gate.status !== 'not_applicable');

  return (
    <aside className="detail-panel">
      <div className="detail-head">
        <StatusChip status={node.canonicalStatus} />
        <span>{kindLabel[node.kind]}</span>
      </div>
      <h2>{node.title}</h2>
      <p>{node.blocker ?? node.nextAction ?? node.statusReason}</p>

      <section className="detail-section">
        <h3>Work</h3>
        <div className="kv"><span>Parent</span><b>{parentLabel(node)}</b></div>
        <div className="kv"><span>Executor</span><b>{node.executorLane}</b></div>
        <div className="kv"><span>State</span><b>{node.executionState}</b></div>
        <div className="kv"><span>Parent done</span><b>{node.completionDepth === 'parent_done' ? 'yes' : 'no'}</b></div>
      </section>

      <section className="detail-section">
        <h3>Evidence</h3>
        {node.evidenceLinks.length > 0 ? node.evidenceLinks.map((link) => (
          <div className="source-row" key={`${link.label}-${link.localPath ?? link.url ?? link.kind}`}>
            <b>{link.label}</b>
            <small>{link.kind}{link.redacted ? ' · redacted' : ''}</small>
          </div>
        )) : <p>None recorded.</p>}
      </section>

      <section className="detail-section">
        <h3>Sources</h3>
        {node.sourceStates.map((source) => (
          <div className="source-row" key={`${source.source}-${source.state}`}>
            <b>{source.source}: {source.state}</b>
            <small>{source.confidence}</small>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h3>Open items</h3>
        <ul>
          {node.conflicts.map((conflict) => <li key={conflict.summary}>{conflict.summary}</li>)}
          {node.residueState.hasResidue ? <li>{node.residueState.summary}</li> : null}
          {displayableApprovalGates.map((gate) => <li key={gate.label}>{gate.label}: {gate.status}</li>)}
          {node.conflicts.length === 0 && !node.residueState.hasResidue && displayableApprovalGates.length === 0 ? <li>None</li> : null}
        </ul>
      </section>
    </aside>
  );
}
