export type NodeId = string;
export type EdgeId = string;
export type Point = { x: number; y: number };
export type Bounds = Point & { width: number; height: number };
export interface LayoutNode { id: NodeId; width: number; height: number }
export interface LayoutEdge { id: EdgeId; source: NodeId; target: NodeId }
export interface GraphNode<T = unknown> extends LayoutNode {
  type?: string;
  x?: number;
  y?: number;
  label?: string;
  draggable?: boolean;
  data?: T;
}
export type PositionedGraphNode<T = unknown> = GraphNode<T> & Point;
export interface GraphEdge<T = unknown> extends LayoutEdge {
  points?: Point[];
  type?: 'dagre' | 'straight' | 'orthogonal' | 'bezier';
  data?: T;
}
export type LayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';
export interface DagreLayoutOptions {
  direction?: LayoutDirection;
  ranker?: 'longest-path' | 'network-simplex' | 'tight-tree';
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
  marginX?: number;
  marginY?: number;
}
export interface LayoutInput { nodes: LayoutNode[]; edges: LayoutEdge[]; options?: DagreLayoutOptions }
export interface PositionedNode extends LayoutNode, Point {}
export interface PositionedEdge extends LayoutEdge { points: Point[] }
export interface LayoutResult { nodes: PositionedNode[]; edges: PositionedEdge[]; bounds: Bounds }

export function validateGraph(nodes: readonly LayoutNode[], edges: readonly LayoutEdge[]): void {
  const ids = new Set<string>();
  for (const { id, width, height } of nodes) {
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error(`Invalid or duplicate node ID: ${id}`);
    if (![width, height].every(value => Number.isFinite(value) && value >= 0)) {
      throw new Error(`Invalid dimensions for node ${id}`);
    }
    ids.add(id);
  }
  const edgeIds = new Set<string>();
  for (const { id, source, target } of edges) {
    if (typeof id !== 'string' || !id || edgeIds.has(id)) throw new Error(`Invalid or duplicate edge ID: ${id}`);
    if (!ids.has(source) || !ids.has(target)) throw new Error(`Unknown endpoint for edge ${id}`);
    edgeIds.add(id);
  }
}
