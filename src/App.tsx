import { useEffect, useState } from 'react';
import { localProofAdapter } from './adapters/localProofAdapter';
import { mockAdapter } from './adapters/mockAdapter';
import { loadReadOnlyWorkNodes } from './adapters/readOnlyAdapter';
import { Board } from './components/Board';
import type { WorkNode } from './domain/worknode';
import './styles.css';

export default function App() {
  const [nodes, setNodes] = useState<WorkNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReadOnlyWorkNodes([localProofAdapter, mockAdapter])
      .then((loaded) => setNodes(loaded))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Failed to load WorkNodes'));
  }, []);

  return (
    <div className="wrap">
      <header className="topbar">
        <div>
          <h1>Chrisboard</h1>
          <p>Local-only WorkNode dashboard proof. Read-only adapters; no mutation controls.</p>
        </div>
        <div className="mode-pill">Read-only preview</div>
      </header>
      {error ? <div className="error">{error}</div> : <Board nodes={nodes} />}
    </div>
  );
}
