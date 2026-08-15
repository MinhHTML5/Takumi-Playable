// test/loop.test.js
//
// Unit tests for the pure fixed-timestep frame-delta splitter (T4, CF-04). Run
// via `npm test` (equivalently `node --test`).
//
// Proves the frame-delta binding cannot skip a brick, headlessly: sub-steps sum
// to the input delta (within a small epsilon), every sub-step is ≤ maxStep,
// non-positive deltas (zero AND negative) yield [], a delta at or below maxStep
// yields a single-element array, a large spike (tab-defocus catch-up) splits
// into the expected count of bounded sub-steps, and — using the real config —
// the chosen maxStepSeconds guarantees per-tick bomb travel stays below one row
// height (the CF-04 safety guarantee). Specific-value assertions, no truthiness.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixedSteps } from '../src/render/loop.js';
import defaultLoop from '../src/render/loop.js';
import config from '../src/core/config.js';

const EPS = 1e-9;

// Sum a list of sub-steps (kept explicit so failures show intent).
function sum(steps) {
  return steps.reduce((a, b) => a + b, 0);
}

test('exports the loop API (named and default)', () => {
  assert.equal(typeof fixedSteps, 'function', 'fixedSteps must be a function');
  assert.equal(
    defaultLoop.fixedSteps,
    fixedSteps,
    'default.fixedSteps must match the named export',
  );
});

test('non-positive deltas return an empty array', () => {
  assert.deepEqual(fixedSteps(0, 0.05), [], 'dt = 0 must return []');
  assert.deepEqual(fixedSteps(-0.01, 0.05), [], 'small negative dt must return []');
  assert.deepEqual(fixedSteps(-5, 0.05), [], 'large negative dt must return []');
});

test('a delta at or below maxStep returns a single-element array', () => {
  const maxStep = 0.05;

  const below = fixedSteps(0.02, maxStep);
  assert.equal(below.length, 1, 'a sub-maxStep delta yields one sub-step');
  assert.equal(below[0], 0.02, 'the single sub-step equals the delta');

  const equal = fixedSteps(maxStep, maxStep);
  assert.equal(equal.length, 1, 'a delta exactly equal to maxStep yields one sub-step');
  assert.equal(equal[0], maxStep, 'the single sub-step equals maxStep');
});

test('a delta just above maxStep splits into two bounded sub-steps', () => {
  const maxStep = 0.05;
  const dt = 0.06; // just over one maxStep → ceil(0.06/0.05) = 2 sub-steps
  const steps = fixedSteps(dt, maxStep);

  assert.equal(steps.length, 2, 'ceil(0.06 / 0.05) must be 2 sub-steps');
  for (const s of steps) {
    assert.ok(s <= maxStep + EPS, `each sub-step (${s}) must be ≤ maxStep`);
  }
  assert.ok(Math.abs(sum(steps) - dt) <= EPS, 'sub-steps must sum to the input delta');
});

test('a large spike delta splits into the expected count of bounded sub-steps', () => {
  const maxStep = 0.05;
  const dt = 0.5; // a 500ms tab-defocus catch-up frame
  const steps = fixedSteps(dt, maxStep);

  // ceil(0.5 / 0.05) = 10 near-equal sub-steps.
  assert.equal(steps.length, 10, 'a 0.5s spike must split into 10 sub-steps at maxStep 0.05');
  for (const s of steps) {
    assert.ok(s <= maxStep + EPS, `each sub-step (${s}) must be ≤ maxStep`);
    assert.ok(s > 0, 'each sub-step must be a positive duration');
  }
  assert.ok(Math.abs(sum(steps) - dt) <= EPS, 'sub-steps must sum to the input delta');
});

test('sub-steps sum to the input delta across a range of deltas', () => {
  const maxStep = 0.05;
  for (const dt of [0.001, 0.05, 0.051, 0.083, 0.12, 0.333, 0.5, 1.0, 2.5]) {
    const steps = fixedSteps(dt, maxStep);
    assert.ok(steps.length >= 1, `dt ${dt} must produce at least one sub-step`);
    assert.ok(
      Math.abs(sum(steps) - dt) <= EPS,
      `sub-steps for dt ${dt} must sum to the delta (got ${sum(steps)})`,
    );
    for (const s of steps) {
      assert.ok(s <= maxStep + EPS, `each sub-step for dt ${dt} must be ≤ maxStep (got ${s})`);
    }
  }
});

test('CF-04: config.loop.maxStepSeconds bounds per-tick bomb travel below one row', () => {
  // The whole point of the splitter: even the largest single tick cannot move
  // the bomb more than one row height, preserving point-overlap collision.
  assert.equal(typeof config.loop, 'object', 'config.loop block must exist');
  assert.ok(config.loop.maxStepSeconds > 0, 'config.loop.maxStepSeconds must be > 0');

  const travelPerTick = config.bomb.fallSpeed * config.loop.maxStepSeconds;
  assert.ok(
    travelPerTick < config.grid.rowHeight,
    `per-tick bomb travel (${travelPerTick}) must stay below rowHeight (${config.grid.rowHeight})`,
  );
  // Pin the accepted first-pass numbers: 900 * 0.05 = 45 < 120.
  assert.equal(travelPerTick, 45, 'expected first-pass travel-per-tick of 45 game units');
});
