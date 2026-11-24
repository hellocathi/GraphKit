import type { GraphEdge, Point, PositionedGraphNode } from '../core/types.js';

export interface CanvasGraphData<T = unknown, E = unknown> {
  nodes: readonly PositionedGraphNode<T>[];
  edges: readonly GraphEdge<E>[];
}

export interface CanvasViewport extends Point {
  zoom: number;
}

export interface CanvasGraphOptions<T = unknown> {
  minZoom?: number;
  maxZoom?: number;
  draggable?: boolean;
  /** The context origin is the node center. Each call gets its own drawing state. */
  drawNode?: (context: CanvasRenderingContext2D, node: Readonly<PositionedGraphNode<T>>) => void;
  onNodeClick?: (node: Readonly<PositionedGraphNode<T>>, event: PointerEvent) => void;
  onNodeMove?: (id: string, position: Point) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}

export interface CanvasGraph<T = unknown, E = unknown> {
  setGraph(graph: CanvasGraphData<T, E>): void;
  getViewport(): CanvasViewport;
  setViewport(viewport: CanvasViewport): void;
  fit(padding?: number): void;
  /** Screen coordinates are CSS pixels relative to the canvas content area. */
  screenToGraph(point: Point): Point;
  /** Returns the ID of the topmost node whose bounds contain the screen point. */
  pickNode(point: Point): string | undefined;
  invalidate(): void;
  destroy(): void;
}
