// test/scoring.test.js
//
// Unit tests for monotonic score accumulation (T4, INV-4). Run via `npm test`
// (equivalently `node --test`).
//
// Covers: exports shape, positive-delta accumulation equals the running sum,
// monotonic non-decrease after every addValue (including negative / NaN /
// undefined / Infinity deltas leaving the total unchanged), zero delta is a
// no-op, and reset returns total 0 without mutating its input. Purity: every
// operation returns a new state object and never mutates the input.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createScore, addValue, reset } from '../src/core/scoring.js';
import defaultScoring from '../src/core/scoring.js';

test('exports the scoring API (named and default)', () => {
  assert.equal(typeof createScore, 'function', 'createScore must be a function');
  assert.equal(typeof addValue, 'function', 'addValue must be a function');
  assert.equal(typeof reset, 'function', 'reset must be a function');
  assert.equal(defaultScoring.createScore, createScore, 'default.createScore must match named');
  assert.equal(defaultScoring.addValue, addValue, 'default.addValue must match named');
  assert.equal(defaultScoring.reset, reset, 'default.reset must match named');
});

test('createScore starts at total 0', () => {
  assert.deepEqual(createScore(), { total: 0 }, 'a fresh score must have total 0');
});

test('accumulation over a positive-delta sequence equals the running sum', () => {
  const deltas = [5, 10, 1, 30, 7, 2, 100];
  let state = createScore();
  let runningSum = 0;
  for (const d of deltas) {
    state = addValue(state, d);
    runningSum += d;
    assert.equal(state.total, runningSum, `total must equal running sum after adding ${d}`);
  }
});

test('monotonic non-decrease: total never drops after any addValue (INV-4)', () => {
  // Interleave positive deltas with values that must be treated as 0.
  const deltas = [5, -3, 10, -100, 0, 7, -1, 4];
  let state = createScore();
  let prev = state.total;
  for (const d of deltas) {
    state = addValue(state, d);
    assert.ok(state.total >= prev, `total must never decrease (delta ${d}, was ${prev}, now ${state.total})`);
    prev = state.total;
  }
  // Only the positive deltas (5 + 10 + 7 + 4) should have accumulated.
  assert.equal(state.total, 26, 'negative and zero deltas must not change the total');
});

test('negative delta leaves the total unchanged', () => {
  const state = addValue(createScore(), 20);
  assert.equal(addValue(state, -5).total, 20, 'a negative delta must not decrease the total');
  assert.equal(addValue(state, -1e9).total, 20, 'a large negative delta must not decrease the total');
});

test('non-finite deltas (NaN / undefined / Infinity) leave the total unchanged', () => {
  const state = addValue(createScore(), 15);
  assert.equal(addValue(state, NaN).total, 15, 'NaN delta must be a no-op');
  assert.equal(addValue(state, undefined).total, 15, 'undefined delta must be a no-op');
  assert.equal(addValue(state, Infinity).total, 15, 'Infinity delta must be a no-op');
  assert.equal(addValue(state, -Infinity).total, 15, '-Infinity delta must be a no-op');
});

test('zero delta leaves the total unchanged', () => {
  const state = addValue(createScore(), 42);
  assert.equal(addValue(state, 0).total, 42, 'a zero delta must not change the total');
});

test('addValue does not mutate its input and returns a new object', () => {
  const before = addValue(createScore(), 8);
  const snapshot = before.total;
  const after = addValue(before, 12);
  assert.equal(before.total, snapshot, 'input state must not be mutated');
  assert.notEqual(after, before, 'addValue must return a new object');
  assert.equal(after.total, 20, 'new state must carry the accumulated total');
});

test('reset returns total 0 and does not mutate its input', () => {
  const state = addValue(createScore(), 99);
  const cleared = reset(state);
  assert.equal(cleared.total, 0, 'reset must return total 0');
  assert.equal(state.total, 99, 'reset must not mutate its input');
  assert.notEqual(cleared, state, 'reset must return a new object');
});
