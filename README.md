# GraphKit

React + SVG / D3 graph rendering and a standalone Dagre layout API. Coordinates are node centers. Keep node and edge IDs stable. Supply node dimensions before layout.

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

Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Use `npm pack --dry-run` to inspect the release and `npm pack` to create a tarball for local consumers. Before a registry release, confirm the real package scope, ownership, license, version, and release approval.

The independent playground uses the tarball and demonstrates a basic DAG, drag and connect, and worker layout. After packing, run `cd examples/playground && pnpm install && pnpm dev`. The same consumer supports `pnpm build`.
