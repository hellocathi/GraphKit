import type { GraphEdge, Point, PositionedGraphNode } from '../core/types.js';

function boundary(node: PositionedGraphNode, toward: Point): Point {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const distance = Math.max(node.width ? Math.abs(dx) / (node.width / 2) : Infinity,
    node.height ? Math.abs(dy) / (node.height / 2) : Infinity);
  return distance ? { x: node.x + dx / distance, y: node.y + dy / distance } : node;
}

export function edgePath(edge: GraphEdge, source: PositionedGraphNode, target: PositionedGraphNode, interactive?: 'straight' | 'orthogonal'): string {
  const type = interactive ?? edge.type ?? 'dagre';
  if (type === 'dagre' && edge.points?.length) {
    return edge.points.map(({ x, y }, i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  }
  if (source.id === target.id) {
    const x = source.x + source.width / 2;
    const y = source.y - source.height / 2;
    return `M${x},${source.y} C${x + 55},${source.y} ${source.x},${y - 55} ${source.x},${y}`;
  }
  const a = boundary(source, target);
  const b = boundary(target, source);
  const mid = (a.x + b.x) / 2;
  if (type === 'bezier') return `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
  if (type === 'orthogonal') {
    const left = target.x >= source.x ? 1 : -1;
    const start = source.x + left * source.width / 2;
    const end = target.x - left * target.width / 2;
    return `M${start},${source.y} H${(start + end) / 2} V${target.y} H${end}`;
  }
  return `M${a.x},${a.y} L${b.x},${b.y}`;
}
