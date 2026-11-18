import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { calculateDagreLayout } from '@your-scope/graphkit/layout';
import type { LayoutInput, LayoutResult } from '@your-scope/graphkit/layout';
import { GraphCanvas } from '@your-scope/graphkit/react';
import type { GraphCanvasRef, GraphEdge, PositionedGraphNode } from '@your-scope/graphkit/react';
import '@your-scope/graphkit/styles.css';

const sample: LayoutInput = {
  nodes: ['Read', 'Validate', 'Write'].map(id => ({ id, width: 116, height: 44 })),
  edges: [
    { id: 'read', source: 'Read', target: 'Validate' },
    { id: 'write', source: 'Validate', target: 'Write' },
  ],
  options: { direction: 'LR' },
};
const initial = calculateDagreLayout(sample);
type Mode = 'basic' | 'drag' | 'worker';

function Playground() {
  const [mode, setMode] = useState<Mode>('basic');
  const [graph, setGraph] = useState<{ nodes: PositionedGraphNode[]; edges: GraphEdge[] }>(initial);
  const [error, setError] = useState('');
  const canvas = useRef<GraphCanvasRef>(null);
  useEffect(() => {
    setError('');
    if (mode !== 'worker') {
      setGraph(initial);
      return;
    }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<LayoutResult>) => setGraph(data);
    worker.onerror = e => setError(e.message);
    worker.postMessage({ ...sample, options: { direction: 'TB' } });
    return () => worker.terminate();
  }, [mode]);
  return <main style={{ fontFamily: 'system-ui', margin: '2rem auto', width: 'min(940px, 94vw)' }}>
    <h1>GraphKit playground</h1>
    <label>Mode <select value={mode} onChange={e => setMode(e.target.value as Mode)}>
      <option value="basic">Basic DAG</option><option value="drag">Drag and connect</option><option value="worker">Worker layout</option>
    </select></label>
    <button onClick={() => canvas.current?.fitView()}>Fit graph</button>
    {error && <p role="alert">{error}</p>}
    <div style={{ height: 480, border: '1px solid #d8e1f0', marginTop: 16, background: '#f6f9ff' }}>
      <GraphCanvas key={mode} ref={canvas} nodes={graph.nodes} edges={graph.edges} draggable={mode === 'drag'}
        connectable={mode === 'drag'} interactiveEdgeRouting="orthogonal"
        canConnect={({ source, target }) => source !== target && !graph.edges.some(e => e.source === source && e.target === target)}
        onConnect={({ source, target }) => setGraph(g => ({ ...g, edges: [...g.edges, { id: crypto.randomUUID(), source, target, type: 'bezier' }] }))}
        onNodeDragEnd={(id, position) => setGraph(g => ({ ...g, nodes: g.nodes.map(n => n.id === id ? { ...n, ...position } : n) }))} />
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Playground />);
