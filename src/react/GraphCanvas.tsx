import { drag } from 'd3-drag';
import { pointer, select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { forwardRef, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { ForwardedRef, ReactElement, ReactNode, RefAttributes } from 'react';
import { createPortal } from 'react-dom';
import { type GraphEdge, type GraphNode, type Point, type PositionedGraphNode, validateGraph } from '../core/types.js';
import { edgePath } from './edges.js';

export interface Viewport extends Point { zoom: number }
export interface ConnectRequest { source: string; target: string; sourcePort?: string; targetPort?: string }
export interface LayoutAnchor { revision: number; nodeId: string; oldPosition: Point }
export interface GraphCanvasRef {
  getViewport(): Viewport;
  setViewport(next: Viewport): void;
  fitView(padding?: number): void;
  focusNode(nodeId: string): void;
  preserveNodeScreenPosition(nodeId: string, oldPosition: Point, newPosition: Point): void;
}
export interface GraphCanvasProps<T = unknown, E = unknown> {
  nodes: PositionedGraphNode<T>[];
  edges: GraphEdge<E>[];
  nodeTypes?: Record<string, (props: { node: GraphNode<T> }) => ReactNode>;
  minZoom?: number;
  maxZoom?: number;
  draggable?: boolean;
  connectable?: boolean;
  interactiveEdgeRouting?: 'straight' | 'orthogonal';
  onNodeClick?: (id: string) => void;
  onNodeContextMenu?: (args: { nodeId: string; clientX: number; clientY: number; nativeEvent: MouseEvent | KeyboardEvent }) => void;
  onNodeDrag?: (id: string, position: Point) => void;
  onNodeDragEnd?: (id: string, position: Point) => void;
  canConnect?: (request: ConnectRequest) => boolean;
  onConnect?: (request: ConnectRequest) => void;
  onViewportChange?: (viewport: Viewport) => void;
  layoutAnchor?: LayoutAnchor;
}

const dimensions = (element: SVGSVGElement) => element.getBoundingClientRect();
const shift = ({ x, y }: Point) => `translate(${x},${y})`;

function Canvas<T, E>(props: GraphCanvasProps<T, E>, ref: ForwardedRef<GraphCanvasRef>) {
  const { nodes, edges, nodeTypes, minZoom = 0.15, maxZoom = 4, layoutAnchor } = props;
  const svg = useRef<SVGSVGElement>(null);
  const scene = useRef<SVGGElement>(null);
  const nodeLayer = useRef<SVGGElement>(null);
  const edgeLayer = useRef<SVGGElement>(null);
  const preview = useRef<SVGPathElement>(null);
  const arrow = `gk-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const live = useRef(props);
  const positioned = useRef(new Map<string, PositionedGraphNode<T>>());
  const dragged = useRef(new Map<string, { position: Point; routes: Map<string, GraphEdge<E>['points']> }>());
  const lastAnchor = useRef<number | undefined>(undefined);
  const behavior = useRef(zoom<SVGSVGElement, unknown>());
  const [hosts, setHosts] = useState<Map<string, Element>>(new Map());

  function setViewport({ x, y, zoom: scale }: Viewport) {
    if (!svg.current) return;
    if (![x, y, scale].every(Number.isFinite) || scale <= 0) throw new Error('Invalid viewport');
    select(svg.current).call(behavior.current.transform, zoomIdentity.translate(x, y).scale(Math.min(maxZoom, Math.max(minZoom, scale))));
  }

  function getViewport(): Viewport {
    const { x, y, k } = svg.current ? zoomTransform(svg.current) : zoomIdentity;
    return { x, y, zoom: k };
  }

  function preserveNodeScreenPosition(id: string, old: Point, next: Point) {
    if (!positioned.current.has(id)) return;
    const viewport = getViewport();
    setViewport({ x: viewport.x + viewport.zoom * (old.x - next.x), y: viewport.y + viewport.zoom * (old.y - next.y), zoom: viewport.zoom });
  }

  function center(at: Point, scale: number) {
    const { width, height } = dimensions(svg.current!);
    const k = Math.min(maxZoom, Math.max(minZoom, scale));
    setViewport({ x: width / 2 - at.x * k, y: height / 2 - at.y * k, zoom: k });
  }

  useImperativeHandle(ref, () => ({
    getViewport, setViewport, preserveNodeScreenPosition,
    fitView(padding = 48) {
      const graph = [...positioned.current.values()];
      if (!graph.length || !svg.current) return;
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      function include(x: number, y: number) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      for (const n of graph) {
        include(n.x - n.width / 2, n.y - n.height / 2);
        include(n.x + n.width / 2, n.y + n.height / 2);
      }
      for (const e of live.current.edges) for (const p of e.points ?? []) include(p.x, p.y);
      const { width, height } = dimensions(svg.current);
      center({ x: (left + right) / 2, y: (top + bottom) / 2 },
        Math.min((width - 2 * padding) / Math.max(1, right - left), (height - 2 * padding) / Math.max(1, bottom - top)));
    },
    focusNode(id) {
      const node = positioned.current.get(id);
      if (node && svg.current) center(node, getViewport().zoom);
    },
  }));

  useLayoutEffect(() => { live.current = props; });
  useLayoutEffect(() => {
    const root = svg.current!;
    const camera = behavior.current
      .scaleExtent([minZoom, maxZoom])
      .extent(() => { const { width, height } = dimensions(root); return [[0, 0], [width, height]]; })
      .filter(e => e.type === 'wheel' ? !e.target.closest?.('[data-no-zoom]') : !e.button && !e.target.closest?.('.gk-node'))
      .on('zoom', ({ transform }) => {
        scene.current?.setAttribute('transform', transform.toString());
        live.current.onViewportChange?.({ x: transform.x, y: transform.y, zoom: transform.k });
      });
    select(root).call(camera);
    return () => { select(root).on('.zoom', null); };
  }, [minZoom, maxZoom]);

  useLayoutEffect(() => {
    validateGraph(nodes, edges);
    for (const n of nodes) if (![n.x, n.y].every(Number.isFinite)) throw new Error(`Invalid position for node ${n.id}`);
    for (const e of edges) if (e.points?.some(p => ![p.x, p.y].every(Number.isFinite))) throw new Error(`Invalid points for edge ${e.id}`);
    const graph = new Map(nodes.map(n => [n.id, { ...n }]));
    positioned.current = graph;
    for (const [id, entry] of dragged.current) {
      const node = graph.get(id);
      if (!node || node.x !== entry.position.x || node.y !== entry.position.y) dragged.current.delete(id);
    }
    const paths = select(edgeLayer.current!).selectAll<SVGPathElement, GraphEdge<E>>('path')
      .data(edges, e => e.id).join('path').attr('data-edge-id', e => e.id).attr('marker-end', `url(#${arrow})`)
      .attr('d', e => {
        const stale = [e.source, e.target].some(id => {
          const routes = dragged.current.get(id)?.routes;
          return routes?.has(e.id) && routes.get(e.id) === e.points;
        });
        return edgePath(e, graph.get(e.source)!, graph.get(e.target)!,
          stale ? props.interactiveEdgeRouting ?? 'straight' : undefined);
      });
    const adjacent = new Map<string, Set<SVGPathElement>>();
    paths.each(function (e) {
      for (const id of [e.source, e.target]) {
        let paths = adjacent.get(id);
        if (!paths) adjacent.set(id, paths = new Set());
        paths.add(this);
      }
    });
    const groups = select(nodeLayer.current!).selectAll<SVGGElement, PositionedGraphNode<T>>('g.gk-node')
      .data([...graph.values()], n => n.id).join('g').attr('class', 'gk-node')
      .attr('data-node-id', n => n.id).attr('transform', shift)
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', n => n.label ?? n.id)
      .on('click', (e: MouseEvent, n) => {
        if (!(e.target as Element).closest('[data-no-drag]')) live.current.onNodeClick?.(n.id);
      })
      .on('keydown', (e: KeyboardEvent, n) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); live.current.onNodeClick?.(n.id); }
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          const r = (e.currentTarget as Element).getBoundingClientRect();
          live.current.onNodeContextMenu?.({ nodeId: n.id, clientX: r.x, clientY: r.bottom, nativeEvent: e });
        }
      })
      .on('contextmenu', (e: MouseEvent, n) => {
        if (!live.current.onNodeContextMenu) return;
        e.preventDefault();
        live.current.onNodeContextMenu({ nodeId: n.id, clientX: e.clientX, clientY: e.clientY, nativeEvent: e });
      });
    const nextHosts = new Map<string, Element>();
    groups.each(function (n) {
      const group = select(this);
      const custom = !!(n.type && nodeTypes?.[n.type]);
      group.selectAll('rect.gk-default').data(custom ? [] : [n]).join('rect').attr('class', 'gk-default')
        .attr('rx', 10).attr('x', -n.width / 2).attr('y', -n.height / 2).attr('width', n.width).attr('height', n.height);
      group.selectAll(':scope > text').data(custom ? [] : [n]).join('text').attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central').text(n.label ?? n.id);
      const foreign = group.selectAll(':scope > foreignObject').data(custom ? [n] : []).join('foreignObject')
        .attr('x', -n.width / 2).attr('y', -n.height / 2).attr('width', n.width).attr('height', n.height);
      const host = foreign.selectAll<HTMLDivElement, unknown>(':scope > .gk-html').data([n]).join('xhtml:div').attr('class', 'gk-html').node();
      if (host instanceof this.ownerDocument.defaultView!.Element) nextHosts.set(n.id, host);
      group.selectAll('circle.gk-port').data(props.connectable ? [n] : []).join('circle')
        .attr('class', 'gk-port').attr('data-no-drag', '').attr('data-port', 'out').attr('cx', n.width / 2).attr('r', 6).raise();
    });
    setHosts(previous => previous.size === nextHosts.size && [...nextHosts].every(([id, host]) => previous.get(id) === host) ? previous : nextHosts);

    groups.call(drag<SVGGElement, PositionedGraphNode<T>, PositionedGraphNode<T>>()
      .container(() => scene.current!)
      .filter((e, n) => !e.button && live.current.draggable !== false && n.draggable !== false && !e.target.closest?.('[data-no-drag]'))
      .on('drag', function (e, n) {
        if (positioned.current !== graph) return;
        const { x, y } = e;
        Object.assign(n, { x, y });
        select(this).attr('transform', shift(n));
        for (const path of adjacent.get(n.id) ?? []) {
          const edge = select<SVGPathElement, GraphEdge<E>>(path).datum();
          path.setAttribute('d', edgePath(edge, graph.get(edge.source)!, graph.get(edge.target)!,
            live.current.interactiveEdgeRouting ?? 'straight'));
        }
        live.current.onNodeDrag?.(n.id, { x, y });
      })
      .on('end', (_, n) => {
        if (positioned.current !== graph) return;
        const position = { x: n.x, y: n.y };
        if (n.x !== nodes.find(node => node.id === n.id)?.x || n.y !== nodes.find(node => node.id === n.id)?.y) {
          const routes = new Map<string, GraphEdge<E>['points']>();
          for (const path of adjacent.get(n.id) ?? []) {
            const edge = select<SVGPathElement, GraphEdge<E>>(path).datum();
            routes.set(edge.id, edge.points);
          }
          dragged.current.set(n.id, { position, routes });
        }
        live.current.onNodeDragEnd?.(n.id, position);
      }));

    if (layoutAnchor && lastAnchor.current !== layoutAnchor.revision) {
      lastAnchor.current = layoutAnchor.revision;
      const next = graph.get(layoutAnchor.nodeId);
      if (next) preserveNodeScreenPosition(next.id, layoutAnchor.oldPosition, next);
    }
  }, [nodes, edges, nodeTypes, layoutAnchor, props.connectable, arrow]);

  return <svg ref={svg} className="gk-canvas" aria-label="Graph"
    onPointerDown={e => {
      const port = (e.target as Element).closest('[data-port]');
      const source = port?.closest('[data-node-id]')?.getAttribute('data-node-id');
      if (!source || e.button !== 0 || !live.current.connectable) return;
      const root = e.currentTarget;
      const pointerId = e.pointerId;
      root.setPointerCapture(pointerId);
      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        const node = positioned.current.get(source);
        if (!node) return;
        const [x, y] = pointer(event, scene.current);
        preview.current?.setAttribute('d', `M${node.x + node.width / 2},${node.y} L${x},${y}`);
      };
      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerup', finish);
        root.removeEventListener('lostpointercapture', finish);
        preview.current?.removeAttribute('d');
        if (event.type !== 'pointerup') return;
        const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-node-id]');
        const target = hit?.getAttribute('data-node-id');
        if (!target || !root.contains(hit ?? null) || !positioned.current.has(source) || !positioned.current.has(target)) return;
        const request = { source, target, sourcePort: 'out' };
        if (live.current.canConnect?.(request) !== false) live.current.onConnect?.(request);
      };
      root.addEventListener('pointermove', move);
      root.addEventListener('pointerup', finish);
      root.addEventListener('lostpointercapture', finish);
      move(e.nativeEvent);
    }}>
    <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" /></marker></defs>
    <g ref={scene}>
      <g ref={edgeLayer} className="gk-edges" />
      <g ref={nodeLayer} />
      <g className="gk-interactions"><path ref={preview} /></g>
    </g>
    {nodes.map(node => {
      const Type = node.type ? nodeTypes?.[node.type] : undefined;
      const host = hosts.get(node.id);
      return Type && host ? createPortal(<Type node={node} />, host, node.id) : null;
    })}
  </svg>;
}

export const GraphCanvas = forwardRef(Canvas) as <T = unknown, E = unknown>(
  props: GraphCanvasProps<T, E> & RefAttributes<GraphCanvasRef>,
) => ReactElement;
