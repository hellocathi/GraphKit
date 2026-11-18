import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, createRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphCanvas } from '../dist/react/index.js';

test('keyed SVG and portal state survive reorder and anchored relayout', async () => {
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.querySelector('main'));
  const ref = createRef();
  function Custom() {
    const [count, set] = useState(0);
    return h('div', null, h('div', null, h('button', { onClick: () => set(count + 1), 'data-no-drag': '' }, count)));
  }
  const nodeTypes = { custom: Custom };
  const a = { id: 'a', type: 'custom', x: 20, y: 30, width: 100, height: 32 };
  const b = { ...a, id: 'b', type: undefined, x: 180 };
  const edges = [{ id: 'ab', source: 'a', target: 'b' }];
  const draw = (nodes, layoutAnchor) => root.render(h(GraphCanvas, { ref, nodes, edges, nodeTypes, layoutAnchor }));
  try {
    await act(() => draw([a, b]));
    const group = document.querySelector('[data-node-id="a"]');
    const edge = document.querySelector('[data-edge-id="ab"]');
    const button = group.querySelector('button');
    assert.equal(button.namespaceURI, 'http://www.w3.org/1999/xhtml');
    await act(() => button.click());
    await act(() => ref.current.setViewport({ x: 10, y: 15, zoom: 2 }));
    await act(() => draw([b, { ...a, x: 40, y: 60 }], { revision: 1, nodeId: 'a', oldPosition: a }));
    assert.equal(document.querySelector('[data-node-id="a"]'), group);
    assert.equal(document.querySelector('[data-edge-id="ab"]'), edge);
    assert.equal(group.querySelector('button'), button);
    assert.equal(button.textContent, '1');
    assert.deepEqual(ref.current.getViewport(), { x: -30, y: -45, zoom: 2 });
    await act(() => draw([{ ...a, x: 40, y: 60 }, b], { revision: 1, nodeId: 'a', oldPosition: a }));
    assert.deepEqual(ref.current.getViewport(), { x: -30, y: -45, zoom: 2 });
    await act(() => root.render(h(GraphCanvas, { ref, nodes: [b], edges: [], nodeTypes })));
    assert.equal(document.querySelector('[data-node-id="a"]'), null);
    assert.equal(document.querySelector('[data-edge-id="ab"]'), null);
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});
