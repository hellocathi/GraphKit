import type { GraphEdge, Point, PositionedGraphNode } from './types.js';

type EdgeRoute =
  | { kind: 'polyline'; points: Point[] }
  | { kind: 'orthogonal' | 'cubic'; points: [Point, Point, Point, Point] };

function boundary(node: PositionedGraphNode, toward: Point): Point {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const distance = Math.max(node.width ? Math.abs(dx) / (node.width / 2) : Infinity,
    node.height ? Math.abs(dy) / (node.height / 2) : Infinity);
  return distance ? { x: node.x + dx / distance, y: node.y + dy / distance } : node;
}

export function edgeRoute(
  edge: GraphEdge,
  source: PositionedGraphNode,
  target: PositionedGraphNode,
  interactive?: 'straight' | 'orthogonal',
): EdgeRoute {
  const type = interactive ?? edge.type ?? 'dagre';
  if (type === 'dagre' && edge.points?.length) return { kind: 'polyline', points: edge.points };
  if (source.id === target.id) {
    const x = source.x + source.width / 2;
    const y = source.y - source.height / 2;
    return { kind: 'cubic', points: [
      { x, y: source.y }, { x: x + 55, y: source.y }, { x: source.x, y: y - 55 }, { x: source.x, y },
    ] };
  }
  if (type === 'orthogonal') {
    const direction = target.x >= source.x ? 1 : -1;
    const start = source.x + direction * source.width / 2;
    const end = target.x - direction * target.width / 2;
    const mid = (start + end) / 2;
    return { kind: 'orthogonal', points: [
      { x: start, y: source.y }, { x: mid, y: source.y }, { x: mid, y: target.y }, { x: end, y: target.y },
    ] };
  }
  const a = boundary(source, target);
  const b = boundary(target, source);
  if (type === 'bezier') {
    const mid = (a.x + b.x) / 2;
    return { kind: 'cubic', points: [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b] };
  }
  return { kind: 'polyline', points: [a, b] };
}
