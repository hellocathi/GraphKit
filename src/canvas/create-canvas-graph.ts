import { edgeRoute } from '../core/edge-route.js';
import { type GraphEdge, type Point, type PositionedGraphNode, validateGraph } from '../core/types.js';
import { drawDefaultNode, drawEdge } from './draw.js';
import type { CanvasGraph, CanvasGraphData, CanvasGraphOptions, CanvasViewport } from './types.js';

interface Gesture<T> {
  pointerId: number;
  start: Point;
  node: PositionedGraphNode<T> | undefined;
  origin: Point;
  draggingNode: boolean;
  moved: boolean;
}

export function createCanvasGraph<T = unknown, E = unknown>(
  canvas: HTMLCanvasElement,
  options: CanvasGraphOptions<T> = {},
): CanvasGraph<T, E> {
  const { minZoom = 0.15, maxZoom = 4, drawNode = drawDefaultNode } = options;
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || minZoom <= 0 || minZoom > maxZoom) {
    throw new Error('Invalid canvas zoom range');
  }
  const ownerWindow = canvas.ownerDocument.defaultView;
  const drawingContext = canvas.getContext('2d');
  if (!ownerWindow || !drawingContext) throw new Error('Canvas 2D is unavailable');
  const view = ownerWindow;
  const context = drawingContext;

  const clampZoom = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom));
  let viewport: CanvasViewport = { x: 0, y: 0, zoom: clampZoom(1) };
  let nodes = new Map<string, PositionedGraphNode<T>>();
  let paintOrder: PositionedGraphNode<T>[] = [];
  let edges: GraphEdge<E>[] = [];
  const movedNodes = new Set<string>();
  let gesture: Gesture<T> | undefined;
  let frame: number | undefined;
  let destroyed = false;

  function routeFor(edge: GraphEdge<E>) {
    const dragging = gesture?.draggingNode && gesture.moved ? gesture.node?.id : undefined;
    const stale = edge.source === dragging || edge.target === dragging ||
      movedNodes.has(edge.source) || movedNodes.has(edge.target);
    return edgeRoute(edge, nodes.get(edge.source)!, nodes.get(edge.target)!,
      stale && (edge.type ?? 'dagre') === 'dagre' ? 'straight' : undefined);
  }

  function paint() {
    frame = undefined;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    // Keep the drawing buffer in device pixels and the viewport in CSS pixels.
    const dpr = view.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    const ratioX = pixelWidth / width;
    const ratioY = pixelHeight / height;
    context.setTransform(ratioX * viewport.zoom, 0, 0, ratioY * viewport.zoom,
      ratioX * viewport.x, ratioY * viewport.y);
    context.lineWidth = 1.5;
    context.strokeStyle = '#7388aa';
    context.fillStyle = '#7388aa';
    for (const edge of edges) drawEdge(context, routeFor(edge));
    for (const node of paintOrder) {
      context.save();
      try {
        context.translate(node.x, node.y);
        context.beginPath();
        drawNode(context, { ...node });
      } finally {
        context.restore();
      }
    }
  }

  function invalidate() {
    if (!destroyed && frame === undefined) frame = view.requestAnimationFrame(paint);
  }

  function setViewport(next: CanvasViewport) {
    if (![next.x, next.y, next.zoom].every(Number.isFinite) || next.zoom <= 0) {
      throw new Error('Invalid canvas viewport');
    }
    const zoom = clampZoom(next.zoom);
    if (viewport.x === next.x && viewport.y === next.y && viewport.zoom === zoom) return;
    viewport = { x: next.x, y: next.y, zoom };
    invalidate();
    options.onViewportChange?.({ ...viewport });
  }

  function screenToGraph({ x, y }: Point): Point {
    return { x: (x - viewport.x) / viewport.zoom, y: (y - viewport.y) / viewport.zoom };
  }

  function hitNode(screen: Point) {
    const { x, y } = screenToGraph(screen);
    for (let i = paintOrder.length - 1; i >= 0; i--) {
      const node = paintOrder[i];
      if (Math.abs(node.x - x) <= node.width / 2 && Math.abs(node.y - y) <= node.height / 2) return node;
    }
  }

  function screenPoint(event: MouseEvent): Point {
    const { left, top } = canvas.getBoundingClientRect();
    return { x: event.clientX - left, y: event.clientY - top };
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || gesture) return;
    const start = screenPoint(event);
    const node = hitNode(start);
    const draggingNode = !!node && options.draggable !== false && node.draggable !== false;
    gesture = {
      pointerId: event.pointerId,
      start,
      node,
      origin: draggingNode ? { x: node.x, y: node.y } : { x: viewport.x, y: viewport.y },
      draggingNode,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const { x, y } = screenPoint(event);
    const dx = x - gesture.start.x;
    const dy = y - gesture.start.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;
    if (gesture.draggingNode && gesture.node) {
      gesture.node.x = gesture.origin.x + dx / viewport.zoom;
      gesture.node.y = gesture.origin.y + dy / viewport.zoom;
      invalidate();
    } else if (!gesture.node) {
      setViewport({ x: gesture.origin.x + dx, y: gesture.origin.y + dy, zoom: viewport.zoom });
    }
  }

  function clearGesture() {
    const active = gesture;
    gesture = undefined;
    if (active && canvas.hasPointerCapture(active.pointerId)) canvas.releasePointerCapture(active.pointerId);
    return active;
  }

  function pointerUp(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return;
    pointerMove(event);
    const active = clearGesture();
    const node = active?.node;
    if (!active || !node) return;
    if (active.draggingNode && active.moved && (node.x !== active.origin.x || node.y !== active.origin.y)) {
      movedNodes.add(node.id);
      options.onNodeMove?.(node.id, { x: node.x, y: node.y });
    } else if (!active.moved && hitNode(screenPoint(event)) === node) {
      options.onNodeClick?.({ ...node }, event);
    }
    if (active.draggingNode && active.moved) invalidate();
  }

  function pointerCancel(event: PointerEvent) {
    if (gesture?.pointerId !== event.pointerId) return;
    const active = clearGesture();
    if (active?.draggingNode && active.node && active.moved) {
      Object.assign(active.node, active.origin);
      invalidate();
    }
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (gesture) return;
    const screen = screenPoint(event);
    const graph = screenToGraph(screen);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const zoom = clampZoom(viewport.zoom * Math.exp(-event.deltaY * unit * 0.002));
    setViewport({ x: screen.x - graph.x * zoom, y: screen.y - graph.y * zoom, zoom });
  }

  function setGraph(graph: CanvasGraphData<T, E>) {
    validateGraph(graph.nodes, graph.edges);
    for (const node of graph.nodes) {
      if (![node.x, node.y].every(Number.isFinite)) throw new Error(`Invalid position for node ${node.id}`);
    }
    for (const edge of graph.edges) {
      if (edge.points?.some(p => ![p.x, p.y].every(Number.isFinite))) throw new Error(`Invalid points for edge ${edge.id}`);
    }

    clearGesture();
    paintOrder = graph.nodes.map(node => ({ ...node }));
    nodes = new Map(paintOrder.map(node => [node.id, node]));
    edges = graph.edges.map(edge => ({ ...edge, points: edge.points?.map(p => ({ ...p })) }));
    movedNodes.clear();
    invalidate();
  }

  function fit(padding = 48) {
    if (!Number.isFinite(padding) || padding < 0) throw new Error('Invalid canvas padding');
    const { width, height } = canvas.getBoundingClientRect();
    if (!paintOrder.length || !width || !height) return;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    function include(x: number, y: number) {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }

    for (const node of paintOrder) {
      include(node.x - node.width / 2, node.y - node.height / 2);
      include(node.x + node.width / 2, node.y + node.height / 2);
    }
    for (const edge of edges) {
      for (const { x, y } of routeFor(edge).points) include(x, y);
    }
    const zoom = clampZoom(Math.min(
      (width - padding * 2) / Math.max(1, right - left),
      (height - padding * 2) / Math.max(1, bottom - top),
    ));
    setViewport({ x: (width - (left + right) * zoom) / 2, y: (height - (top + bottom) * zoom) / 2, zoom });
  }

  const listeners = new view.AbortController();
  const { signal } = listeners;
  canvas.addEventListener('pointerdown', pointerDown, { signal });
  canvas.addEventListener('pointermove', pointerMove, { signal });
  canvas.addEventListener('pointerup', pointerUp, { signal });
  canvas.addEventListener('pointercancel', pointerCancel, { signal });
  canvas.addEventListener('lostpointercapture', pointerCancel, { signal });
  canvas.addEventListener('wheel', wheel, { passive: false, signal });
  view.addEventListener('resize', invalidate, { signal });
  const resize = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(invalidate) : undefined;
  resize?.observe(canvas);
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  invalidate();

  return {
    setGraph, setViewport, fit, screenToGraph, invalidate,
    getViewport: () => ({ ...viewport }),
    pickNode: point => hitNode(point)?.id,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.abort();
      resize?.disconnect();
      clearGesture();
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      canvas.style.touchAction = previousTouchAction;
      nodes.clear();
      paintOrder = [];
      edges = [];
      movedNodes.clear();
    },
  };
}
