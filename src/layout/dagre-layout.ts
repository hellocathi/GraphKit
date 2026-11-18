import dagre from '@dagrejs/dagre';
const { graphlib, layout } = dagre;
import { type LayoutInput, type LayoutResult, validateGraph } from '../core/types.js';

export function calculateDagreLayout({ nodes, edges, options = {} }: LayoutInput): LayoutResult {
  validateGraph(nodes, edges);
  const { direction = 'LR', ranker, nodeSep, rankSep, edgeSep, marginX, marginY } = options;
  if (!['LR', 'RL', 'TB', 'BT'].includes(direction)) throw new Error(`Invalid direction: ${direction}`);
  if (ranker && !['longest-path', 'network-simplex', 'tight-tree'].includes(ranker)) throw new Error(`Invalid ranker: ${ranker}`);
  for (const [name, value] of Object.entries({ nodeSep, rankSep, edgeSep, marginX, marginY })) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid ${name}`);
  }
  if (!nodes.length) return { nodes: [], edges: [], bounds: { x: 0, y: 0, width: 0, height: 0 } };
  const graph = new graphlib.Graph({ multigraph: true });
  const settings = Object.fromEntries(Object.entries({
    rankdir: direction, ranker, nodesep: nodeSep, ranksep: rankSep, edgesep: edgeSep, marginx: marginX, marginy: marginY,
  }).filter(([, value]) => value !== undefined));
  graph.setGraph(settings);
  const names = new Map(nodes.map(({ id }, i) => [id, String(i)]));
  for (const { id, width, height } of nodes) graph.setNode(names.get(id)!, { width, height });
  for (const [i, { source, target }] of edges.entries()) {
    graph.setEdge(names.get(source)!, names.get(target)!, {}, String(i));
  }
  layout(graph);
  const { width, height } = graph.graph();
  return {
    nodes: nodes.map(({ id, width, height }) => {
      const { x, y } = graph.node(names.get(id)!);
      return { id, width, height, x, y };
    }),
    edges: edges.map(({ id, source, target }, i) => ({
      id, source, target, points: graph.edge(names.get(source)!, names.get(target)!, String(i)).points,
    })),
    bounds: { x: 0, y: 0, width, height },
  };
}
