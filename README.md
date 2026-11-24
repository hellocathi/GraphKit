# GraphKit

GraphKit provides two graph renderers and a standalone Dagre layout API. Both renderers accept positioned data. Coordinates are node centers. Keep node and edge IDs stable and supply node dimensions before layout.

| Engine | Import | Rendering and interaction |
| --- | --- | --- |
| React + SVG | `@your-scope/graphkit/react` | `<GraphCanvas>` renders SVG elements and React node portals. Includes keyboard activation, connection ports, and anchored relayout. |
| Canvas 2D | `@your-scope/graphkit/canvas` | `createCanvasGraph(canvas, options)` paints pixels with the Canvas 2D API. Includes coordinate hit testing, node dragging, pan, and wheel zoom. |

## React + SVG

```tsx
import { calculateDagreLayout } from '@your-scope/graphkit/layout';
import { GraphCanvas } from '@your-scope/graphkit/react';
import '@your-scope/graphkit/styles.css';

const graph = calculateDagreLayout({
  nodes: [{ id: 'start', width: 120, height: 40 }, { id: 'end', width: 120, height: 40 }],
  edges: [{ id: 'start-end', source: 'start', target: 'end' }],
});

export function Example() {
  return <section style={{ height: 480 }}><GraphCanvas nodes={graph.nodes} edges={graph.edges} /></section>;
}
```

For production, call the layout entry from a worker you own. The React entry accepts already positioned data. Use a stable `nodeTypes` component registry for custom cards and `data-no-drag` for controls. Persist final positions in `onNodeDragEnd`. Supply new edge routes as new points arrays. Edge types are `dagre`, `straight`, `orthogonal`, and `bezier`. Enable `connectable` to expose output handles, validate with `canConnect`, and save connections in `onConnect`.

Use `getViewport`, `setViewport`, `fitView` and `focusNode` on a ref. For anchored layout, submit new nodes and edges with `layoutAnchor: { revision, nodeId, oldPosition }` in one render. Revisions must identify distinct layout commits.

## Canvas 2D

Use a dedicated canvas with a CSS-defined width and height. The engine sets the drawing buffer size for the device pixel ratio. Apply borders or padding to the wrapper so pointer coordinates stay relative to the drawing area.

```html
<canvas id="graph" aria-label="Graph" style="display: block; width: 100%; height: 480px"></canvas>
```

```ts
import { createCanvasGraph } from '@your-scope/graphkit/canvas';
import { calculateDagreLayout } from '@your-scope/graphkit/layout';

const canvas = document.querySelector<HTMLCanvasElement>('#graph')!;
const graph = createCanvasGraph(canvas, {
  onNodeMove(id, position) {
    console.log(id, position);
  },
});
graph.setGraph(calculateDagreLayout({
  nodes: [{ id: 'start', width: 120, height: 40 }, { id: 'end', width: 120, height: 40 }],
  edges: [{ id: 'start-end', source: 'start', target: 'end' }],
}));
graph.fit();

// Call graph.destroy() when the canvas is removed.
```

- `setGraph({ nodes, edges })` replaces the graph with positioned data. A completed drag updates the engine's copy and reports the new graph coordinates through `onNodeMove`. When replacing the graph, provide fresh Dagre route points for moved nodes or omit the old points.
- `getViewport()`, `setViewport({ x, y, zoom })`, and `fit(padding?)` control the camera. `screenToGraph(point)` converts canvas-relative CSS pixels to graph coordinates, and `pickNode(point)` returns the topmost node ID at those screen coordinates.
- Supply `drawNode(context, node)` to paint a custom node around the local origin. Call `invalidate()` when external drawing state changes. The canvas redraws on the next animation frame.
- The Canvas API uses drawing callbacks and rectangular node hit areas. Use the SVG API for embedded React controls, per-node keyboard interaction, and interactive connection ports.

## Development

Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Use `npm pack --dry-run` to inspect the release and `npm pack` to create a tarball for local consumers. Before a registry release, confirm the real package scope, ownership, license, version, and release approval.

The independent playground uses the tarball and lets you switch between SVG and Canvas 2D and try a basic DAG, graph interactions, and worker layout. After packing, run `cd examples/playground && pnpm install && pnpm dev`. The same consumer supports `pnpm build`.
