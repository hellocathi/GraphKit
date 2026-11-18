import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDagreLayout } from '../dist/layout/index.js';

const nodes = ['a', 'b', 'c'].map(id => Object.freeze({ id, width: 120, height: 42 }));
const edges = [
  { id: 'a1', source: 'a', target: 'c' },
  { id: 'a2', source: 'a', target: 'c' },
  { id: 'b1', source: 'b', target: 'c' },
];

test('empty graph and malformed data', () => {
  assert.equal(calculateDagreLayout({ nodes: [], edges: [] }).bounds.width, 0);
  assert.throws(() => calculateDagreLayout({ nodes: [nodes[0]], edges }), /endpoint/);
  assert.throws(() => calculateDagreLayout({ nodes: [nodes[0], nodes[0]], edges: [] }), /duplicate/);
  assert.throws(() => calculateDagreLayout({ nodes: [{ ...nodes[0], width: NaN }], edges: [] }), /dimensions/);
});

test('multi-parent DAG and parallel edges preserve IDs, dimensions and direction', () => {
  for (const [direction, axis, sign] of [['LR', 'x', 1], ['RL', 'x', -1], ['TB', 'y', 1], ['BT', 'y', -1]]) {
    const result = calculateDagreLayout({ nodes, edges, options: { direction } });
    assert.ok((result.nodes[2][axis] - result.nodes[0][axis]) * sign > 0);
    assert.equal(result.nodes[0].width, 120);
    assert.deepEqual(result.edges.map(edge => edge.id), edges.map(edge => edge.id));
    assert.notDeepEqual(result.edges[0].points, result.edges[1].points);
  }
});

test('single node and chain fit bounds without mutating frozen inputs', () => {
  const single = calculateDagreLayout({ nodes: [nodes[0]], edges: [] });
  assert.equal(single.bounds.width, 120);
  assert.equal(single.nodes[0].x, 60);
  const chain = Object.freeze([
    Object.freeze({ id: 'ab', source: 'a', target: 'b' }),
    Object.freeze({ id: 'bc', source: 'b', target: 'c' }),
  ]);
  const result = calculateDagreLayout({ nodes: Object.freeze(nodes), edges: chain });
  assert.ok(result.nodes[0].x < result.nodes[1].x && result.nodes[1].x < result.nodes[2].x);
  assert.ok(result.bounds.width >= 360);
  assert.equal(chain[0].points, undefined);
});
