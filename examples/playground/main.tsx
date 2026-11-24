import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCanvasGraph } from '@your-scope/graphkit/canvas';
import type { CanvasGraph, CanvasGraphData } from '@your-scope/graphkit/canvas';
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
type Engine = 'svg' | 'canvas';

function CanvasDemo({ graph, draggable }: { graph: CanvasGraphData; draggable: boolean }) {
  const element = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CanvasGraph>(null);
  const [picked, setPicked] = useState('');
  useEffect(() => {
    const instance = createCanvasGraph(element.current!, {
      draggable,
      onNodeClick: node => setPicked(node.id),
      onNodeMove: (id, position) => setPicked(`${id} (x: ${Math.round(position.x)}, y: ${Math.round(position.y)})`),
      drawNode(context, node) {
        context.beginPath();
        context.roundRect(-node.width / 2, -node.height / 2, node.width, node.height, 8);
        context.fillStyle = '#17456a';
        context.fill();
        context.fillStyle = '#fff';
        context.font = '14px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(node.label ?? node.id, 0, 0, node.width - 12);
      },
    });
    engine.current = instance;
    return () => instance.destroy();
  }, [draggable]);
  useEffect(() => {
    engine.current?.setGraph(graph);
    engine.current?.fit();
    setPicked('');
  }, [graph, draggable]);
  return <>
    <button onClick={() => engine.current?.fit()}>Fit graph</button>
    <output style={{ marginLeft: 12 }}>{picked}</output>
    <div style={sceneStyle}>
      <canvas ref={element} aria-label="Canvas graph" style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  </>;
}

const sceneStyle = { height: 480, border: '1px solid #d8e1f0', marginTop: 16, background: '#f6f9ff' };

function Playground() {
  const [engine, setEngine] = useState<Engine>('svg');
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
    <label>Engine <select value={engine} onChange={e => setEngine(e.target.value as Engine)}>
      <option value="svg">React + SVG</option><option value="canvas">Canvas 2D</option>
    </select></label>{' '}
    <label>Mode <select value={mode} onChange={e => setMode(e.target.value as Mode)}>
      <option value="basic">Basic DAG</option><option value="drag">{engine === 'svg' ? 'Drag and connect' : 'Drag nodes'}</option><option value="worker">Worker layout</option>
    </select></label>
    {error && <p role="alert">{error}</p>}
    {engine === 'canvas' ? <CanvasDemo graph={graph} draggable={mode === 'drag'} /> : <>
      <button onClick={() => canvas.current?.fitView()}>Fit graph</button>
      <div style={sceneStyle}>
        <GraphCanvas key={mode} ref={canvas} nodes={graph.nodes} edges={graph.edges} draggable={mode === 'drag'}
          connectable={mode === 'drag'} interactiveEdgeRouting="orthogonal"
          canConnect={({ source, target }) => source !== target && !graph.edges.some(e => e.source === source && e.target === target)}
          onConnect={({ source, target }) => setGraph(g => ({ ...g, edges: [...g.edges, { id: crypto.randomUUID(), source, target, type: 'bezier' }] }))}
          onNodeDragEnd={(id, position) => setGraph(g => ({ ...g, nodes: g.nodes.map(n => n.id === id ? { ...n, ...position } : n) }))} />
      </div>
    </>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Playground />);
