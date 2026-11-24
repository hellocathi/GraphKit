import type { edgeRoute } from '../core/edge-route.js';
import type { PositionedGraphNode } from '../core/types.js';

export function drawEdge(context: CanvasRenderingContext2D, route: ReturnType<typeof edgeRoute>) {
  const { points } = route;
  const first = points[0];
  context.beginPath();
  context.moveTo(first.x, first.y);
  if (route.kind === 'cubic') {
    const [, b, c, d] = route.points;
    context.bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y);
  } else {
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y);
  }
  context.stroke();

  const end = points[points.length - 1];
  for (let i = points.length - 2; i >= 0; i--) {
    const dx = end.x - points[i].x;
    const dy = end.y - points[i].y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const ux = dx / length;
    const uy = dy / length;
    context.beginPath();
    context.moveTo(end.x, end.y);
    context.lineTo(end.x - ux * 8 + uy * 4, end.y - uy * 8 - ux * 4);
    context.lineTo(end.x - ux * 8 - uy * 4, end.y - uy * 8 + ux * 4);
    context.closePath();
    context.fill();
    break;
  }
}

export function drawDefaultNode(context: CanvasRenderingContext2D, node: PositionedGraphNode) {
  const { width, height } = node;
  context.beginPath();
  context.roundRect(-width / 2, -height / 2, width, height, 8);
  context.fillStyle = '#fff';
  context.fill();
  context.strokeStyle = '#a8bad7';
  context.stroke();
  if (width > 12 && height >= 14) {
    context.fillStyle = '#172b4d';
    context.font = '14px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(node.label ?? node.id, 0, 0, width - 12);
  }
}
