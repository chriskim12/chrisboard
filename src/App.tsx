import { useEffect, useState } from 'react';
import { jsonWorkNodeAdapter } from './adapters/jsonWorkNodeAdapter';
import { loadReadOnlyWorkNodes } from './adapters/readOnlyAdapter';
import { Board } from './components/Board';
import type { WorkNode } from './domain/worknode';
import './styles.css';

export default function App() {
  const [nodes, setNodes] = useState<WorkNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReadOnlyWorkNodes([jsonWorkNodeAdapter])
      .then((loaded) => setNodes(loaded))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Failed to load WorkNodes'));
  }, []);

  return (
    <div className="wrap">
      <header className="topbar">
        <h1>Chrisboard</h1>
      </header>
      {error ? <div className="error">{error}</div> : <Board nodes={nodes} />}
    </div>
  );
}
