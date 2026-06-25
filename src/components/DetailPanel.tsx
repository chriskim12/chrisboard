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
  const missingEvidence = node.policyDecision?.missingEvidence ?? [];
  const scopeReductions = node.goalContract?.scopeReductions ?? [];
  const contractGates = node.goalContract?.approvalGates ?? [];

  return (
    <aside className="detail-panel">
      <div className="detail-head">
        <StatusChip status={node.canonicalStatus} />
        <span>{kindLabel[node.kind]} · {node.freshness ?? 'unknown freshness'}</span>
      </div>
      <h2>{node.title}</h2>
      <p>{node.blocker ?? node.nextAction ?? node.statusReason}</p>

      <section className="detail-section">
        <h3>Work</h3>
        <div className="kv"><span>Parent</span><b>{parentLabel(node)}</b></div>
        <div className="kv"><span>Executor</span><b>{node.executorLane}</b></div>
        <div className="kv"><span>State</span><b>{node.executionState}</b></div>
        <div className="kv"><span>Parent done</span><b>{node.completionDepth === 'parent_done' ? 'yes' : 'no'}</b></div>
        <div className="kv"><span>Identity</span><b>{node.identityMapping?.mappingStatus ?? 'unknown'}</b></div>
        <div className="kv"><span>Aliases</span><b>{node.identityMapping?.aliases?.length ?? 0}</b></div>
      </section>

      <section className="detail-section">
        <h3>Goal contract</h3>
        <div className="source-row">
          <b>Original parent goal</b>
          <small>{node.goalContract?.originalGoal ?? 'No goal contract linked; cannot infer Done.'}</small>
        </div>
        <div className="source-row">
          <b>Approved scope</b>
          <small>{node.goalContract?.approvedScope ?? 'missing'}</small>
        </div>
        <div className="source-row">
          <b>Done criteria</b>
          <small>{node.goalContract?.doneCriteria.join(' · ') ?? 'missing'}</small>
        </div>
        {scopeReductions.map((reduction) => (
          <div className="source-row" key={`${reduction.evidenceRef}-${reduction.delta}`}>
            <b>Scope reduction · approved by Chris: {reduction.approvedByChris ? 'yes' : 'no'}</b>
            <small>{reduction.delta} {reduction.userCanNoLongerExpect}</small>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h3>Decision trace</h3>
        <div className="kv"><span>Winning rule</span><b>{node.policyDecision?.winningRule ?? 'unknown'}</b></div>
        <div className="kv"><span>Confidence</span><b>{node.policyDecision?.confidence ?? 'unknown'}</b></div>
        <div className="kv"><span>Freshness</span><b>{node.policyDecision?.freshness ?? node.freshness ?? 'unknown'}</b></div>
        {node.policyDecision?.suppressedRules.length ? (
          <div className="source-row">
            <b>Suppressed lower rules</b>
            <small>{node.policyDecision.suppressedRules.join(', ')}</small>
          </div>
        ) : null}
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
          <div className="source-row" key={`${source.source}-${source.state}-${source.details}`}>
            <b>{source.source}: {source.state}</b>
            <small>{source.confidence}</small>
          </div>
        ))}
      </section>

      <section className="detail-section">
        <h3>Open items</h3>
        <ul>
          {missingEvidence.map((item) => <li key={item}>Missing: {item}</li>)}
          {node.conflicts.map((conflict) => <li key={conflict.summary}>{conflict.summary}</li>)}
          {node.residueState.hasResidue ? <li>{node.residueState.summary}</li> : null}
          {displayableApprovalGates.map((gate) => <li key={`${gate.label}-${gate.requiredBefore}`}>{gate.label}: {gate.status}</li>)}
          {contractGates.map((gate) => <li key={`${gate.gate}-${gate.requiredBefore}`}>{gate.gate}: {gate.status}</li>)}
          {missingEvidence.length === 0 && node.conflicts.length === 0 && !node.residueState.hasResidue && displayableApprovalGates.length === 0 && contractGates.length === 0 ? <li>None</li> : null}
        </ul>
      </section>
    </aside>
  );
}
