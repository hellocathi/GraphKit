import { edgeRoute } from '../core/edge-route.js';
import type { GraphEdge, PositionedGraphNode } from '../core/types.js';

export function edgePath(edge: GraphEdge, source: PositionedGraphNode, target: PositionedGraphNode, interactive?: 'straight' | 'orthogonal'): string {
  const route = edgeRoute(edge, source, target, interactive);
  if (route.kind === 'polyline') {
    return route.points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  }
  const [a, b, c, d] = route.points;
  if (route.kind === 'orthogonal') return `M${a.x},${a.y} H${b.x} V${c.y} H${d.x}`;
  return `M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
}
