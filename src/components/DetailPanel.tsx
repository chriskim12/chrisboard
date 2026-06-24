import type { WorkNode } from '../domain/worknode';
import { StatusChip } from './StatusChip';

interface DetailPanelProps {
  node: WorkNode;
}

export function DetailPanel({ node }: DetailPanelProps) {
  const parentLabel =
    node.kind === 'ParentGoal' ? 'self' : node.kind === 'ChildWork' ? (node.parentGoalTitle ?? 'unknown/provisional') : 'none';
  return (
    <aside className="detail-panel">
      <StatusChip status={node.canonicalStatus} />
      <h2>{node.title}</h2>
      <p>{node.kind} · {node.executionState}</p>
      <div className="callout">Parent Done: <b>{node.completionDepth === 'parent_done' ? 'Yes' : 'No'}</b></div>

      <section className="detail-section">
        <h3>Work identity</h3>
        <div className="kv"><span>Parent</span><b>{parentLabel}</b></div>
        <div className="kv"><span>Child/current task</span><b>{node.childScope ?? node.title}</b></div>
        <div className="kv"><span>Executor lane</span><b>{node.executorLane}</b></div>
        <div className="kv"><span>Next/blocker</span><b>{node.blocker ?? node.nextAction ?? 'unknown/provisional'}</b></div>
      </section>

      <section className="detail-section">
        <h3>Evidence</h3>
        {node.evidenceLinks.map((link) => (
          <div className="source-row" key={`${link.label}-${link.localPath ?? link.url ?? link.kind}`}>
            <b>{link.label}</b>
            <small>{link.kind} · {link.redacted ? 'redacted' : 'not redacted'}</small>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h3>Source states</h3>
        {node.sourceStates.map((source) => (
          <div className="source-row" key={`${source.source}-${source.state}`}>
            <b>{source.source}: {source.state}</b>
            <small>{source.confidence} · {source.details}</small>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h3>Conflicts / residue / gates</h3>
        <ul>
          {node.conflicts.map((conflict) => <li key={conflict.summary}>{conflict.summary}</li>)}
          <li>Residue: {node.residueState.summary}</li>
          {node.approvalGates.map((gate) => <li key={gate.label}>{gate.label}: {gate.status}</li>)}
        </ul>
      </section>

      {node.realSource ? (
        <section className="detail-section real-source">
          <h3>Real source allowlist</h3>
          <p><b>{node.realSource.sourceName}</b></p>
          <p>{node.realSource.allowlistedPath}</p>
          <p>{node.realSource.redaction}</p>
        </section>
      ) : null}
    </aside>
  );
}
