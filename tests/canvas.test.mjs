import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createCanvasGraph } from '../dist/canvas/index.js';

test('Canvas batches drawing, maps CSS pixels to nodes and disposes browser resources', () => {
  const dom = new JSDOM('<canvas></canvas>', { pretendToBeVisual: true });
  const { window } = dom;
  const canvas = window.document.querySelector('canvas');
  const frames = new Map();
  let nextFrame = 0;
  let width = 320;
  let resize;
  let disconnected = false;
  window.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  window.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  window.cancelAnimationFrame = id => frames.delete(id);
  function paintFrame() {
    assert.equal(frames.size, 1);
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
  }

  Object.defineProperty(window, 'devicePixelRatio', { value: 2 });
  canvas.getBoundingClientRect = () => ({ left: 20, top: 10, width, height: 200 });
  const calls = [];
  const context = new Proxy({}, {
    get: (_, name) => (...args) => calls.push([name, ...args]),
  });
  canvas.getContext = () => context;
  const captured = new Set();
  canvas.setPointerCapture = id => captured.add(id);
  canvas.hasPointerCapture = id => captured.has(id);
  canvas.releasePointerCapture = id => captured.delete(id);
  function pointer(type, x, y) {
    canvas.dispatchEvent(new window.PointerEvent(type, { pointerId: 1, clientX: x + 20, clientY: y + 10 }));
  }
  const clicks = [];
  const moves = [];
  const graph = createCanvasGraph(canvas, {
    drawNode: (_, node) => calls.push(['node', node.id]),
    onNodeClick: node => clicks.push(node.id),
    onNodeMove: (...move) => moves.push(move),
  });
  const a = { id: 'a', x: 20, y: 30, width: 20, height: 20 };
  const b = { ...a, id: 'b', x: 100 };
  const c = { ...b, id: 'c' };
  try {
    graph.setGraph({
      nodes: [a, b, c],
      edges: [{ id: 'ab', source: 'a', target: 'b', points: [{ x: 30, y: 30 }, { x: 90, y: 30 }] }],
    });
    graph.setViewport({ x: 10, y: 20, zoom: 2 });
    graph.invalidate();
    paintFrame();

    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 400);
    assert.deepEqual(calls.slice(0, 3), [
      ['setTransform', 1, 0, 0, 1, 0, 0], ['clearRect', 0, 0, 640, 400], ['setTransform', 4, 0, 0, 4, 20, 40],
    ]);
    assert.equal(graph.pickNode({ x: 210, y: 80 }), 'c');
    assert.deepEqual(graph.screenToGraph({ x: 50, y: 80 }), { x: 20, y: 30 });

    pointer('pointerdown', 210, 80);
    pointer('pointerup', 210, 80);
    assert.deepEqual(clicks, ['c']);
    pointer('pointerdown', 50, 80);
    pointer('pointermove', 65, 95);
    pointer('pointerup', 70, 100);
    assert.deepEqual(moves, [['a', { x: 30, y: 40 }]]);
    assert.equal(a.x, 20);
    assert.equal(graph.pickNode({ x: 80, y: 110 }), 'a');
    assert.equal(captured.size, 0);

    calls.length = 0;
    paintFrame();
    const firstPath = calls.find(call => call[0] === 'moveTo');
    assert.notDeepEqual(firstPath, ['moveTo', 30, 30], 'a completed drag reroutes stale Dagre points');

    pointer('pointerdown', 70, 100);
    pointer('pointermove', 100, 140);
    pointer('pointercancel', 100, 140);
    assert.equal(graph.pickNode({ x: 70, y: 100 }), 'a');
    assert.equal(moves.length, 1);

    pointer('pointerdown', 300, 180);
    pointer('pointermove', 310, 190);
    pointer('pointerup', 310, 190);
    assert.deepEqual(graph.getViewport(), { x: 20, y: 30, zoom: 2 });
    const cursor = { x: 150, y: 100 };
    const before = graph.screenToGraph(cursor);
    canvas.dispatchEvent(new window.WheelEvent('wheel', { clientX: 170, clientY: 110, deltaY: -50 }));
    assert.ok(graph.getViewport().zoom > 2);
    assert.ok(Math.abs(graph.screenToGraph(cursor).x - before.x) < 1e-9);

    width = 250;
    resize();
    paintFrame();
    assert.equal(canvas.width, 500);

    graph.invalidate();
    graph.destroy();
    assert.equal(frames.size, 0);
    assert.equal(disconnected, true);
    pointer('pointerdown', 1, 1);
    assert.equal(captured.size, 0);
  } finally {
    graph.destroy();
    dom.window.close();
  }
});
