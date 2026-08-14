// test/difficulty.test.js
//
// Unit tests for the difficulty / value-scaling primitives (T2). Run via
// `npm test` (equivalently `node --test`).
//
// Covers: hard value bounds (INV-7 — every draw in [1,30] at elapsed 0 / mid /
// huge), upward drift (range bounds non-decreasing in elapsed and seeded
// sample-mean rising for both brick and bomb draws — R2), bomb range scaling
// upward, difficulty level capped at maxLevel, and determinism (same seed +
// elapsed => identical roll — INV-2). Randomness is seeded via createRng from
// src/core/rng.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../src/core/rng.js';
import {
  difficultyLevel,
  brickValueRange,
  bombValueRange,
  rollBrickValue,
  rollBombValue,
} from '../src/core/difficulty.js';
import defaultDifficulty from '../src/core/difficulty.js';
import { config } from '../src/core/config.js';

const N = 2000; // sample size for statistical / bounds checks

const BRICK_MIN = config.values.brickMin; // 1
const BRICK_MAX = config.values.brickMax; // 30

// A large elapsed value well past the level cap (maxLevel * levelInterval).
const HUGE = config.difficulty.levelInterval * config.difficulty.maxLevel * 1000;

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

test('exports the difficulty API (named and default)', () => {
  assert.equal(typeof difficultyLevel, 'function');
  assert.equal(typeof brickValueRange, 'function');
  assert.equal(typeof bombValueRange, 'function');
  assert.equal(typeof rollBrickValue, 'function');
  assert.equal(typeof rollBombValue, 'function');
  assert.equal(defaultDifficulty.difficultyLevel, difficultyLevel);
  assert.equal(defaultDifficulty.rollBrickValue, rollBrickValue);
});

test('difficultyLevel: floor(elapsed / levelInterval), non-negative', () => {
  const { levelInterval } = config.difficulty;
  assert.equal(difficultyLevel(0, config), 0);
  assert.equal(difficultyLevel(levelInterval - 0.001, config), 0);
  assert.equal(difficultyLevel(levelInterval, config), 1);
  assert.equal(difficultyLevel(levelInterval * 3.5, config), 3);
  // Defensive: negative elapsed floors to level 0, never negative.
  assert.equal(difficultyLevel(-100, config), 0);
});

test('difficultyLevel: capped at config.difficulty.maxLevel', () => {
  const { levelInterval, maxLevel } = config.difficulty;
  assert.equal(difficultyLevel(levelInterval * maxLevel, config), maxLevel);
  assert.equal(difficultyLevel(levelInterval * (maxLevel + 50), config), maxLevel);
  assert.equal(difficultyLevel(HUGE, config), maxLevel);
});

test('INV-7 hard bound: rollBrickValue is always an integer in [1,30]', () => {
  for (const elapsed of [0, 40, HUGE]) {
    const rng = createRng(1234 + elapsed);
    for (let i = 0; i < N; i++) {
      const v = rollBrickValue(elapsed, rng, config);
      assert.ok(Number.isInteger(v), `brick value must be integer (got ${v})`);
      assert.ok(
        v >= BRICK_MIN && v <= BRICK_MAX,
        `brick value out of [1,30] at elapsed ${elapsed} (got ${v})`,
      );
    }
  }
});

test('INV-7 hard bound: rollBombValue is always an integer in [1,30]', () => {
  for (const elapsed of [0, 40, HUGE]) {
    const rng = createRng(4321 + elapsed);
    for (let i = 0; i < N; i++) {
      const v = rollBombValue(elapsed, rng, config);
      assert.ok(Number.isInteger(v), `bomb value must be integer (got ${v})`);
      assert.ok(
        v >= BRICK_MIN && v <= BRICK_MAX,
        `bomb value out of [1,30] at elapsed ${elapsed} (got ${v})`,
      );
    }
  }
});

test('brickValueRange: bounds within [1,30] and non-decreasing in elapsed', () => {
  let prev = brickValueRange(0, config);
  assert.ok(prev.min >= BRICK_MIN && prev.max <= BRICK_MAX, 'range within [1,30]');
  assert.ok(prev.min <= prev.max, 'min <= max');
  for (let elapsed = 0; elapsed <= HUGE; elapsed += config.difficulty.levelInterval) {
    const r = brickValueRange(elapsed, config);
    assert.ok(r.min >= BRICK_MIN && r.max <= BRICK_MAX, `range within [1,30] at ${elapsed}`);
    assert.ok(r.min <= r.max, `min <= max at ${elapsed}`);
    assert.ok(r.min >= prev.min, `brick min non-decreasing at ${elapsed}`);
    assert.ok(r.max >= prev.max, `brick max non-decreasing at ${elapsed}`);
    prev = r;
  }
});

test('bombValueRange: bounds within [1,30] and non-decreasing in elapsed (scales upward)', () => {
  let prev = bombValueRange(0, config);
  assert.ok(prev.min >= BRICK_MIN && prev.max <= BRICK_MAX, 'range within [1,30]');
  assert.ok(prev.min <= prev.max, 'min <= max');
  for (let elapsed = 0; elapsed <= HUGE; elapsed += config.difficulty.levelInterval) {
    const r = bombValueRange(elapsed, config);
    assert.ok(r.min >= BRICK_MIN && r.max <= BRICK_MAX, `range within [1,30] at ${elapsed}`);
    assert.ok(r.min <= r.max, `min <= max at ${elapsed}`);
    assert.ok(r.min >= prev.min, `bomb min non-decreasing at ${elapsed}`);
    assert.ok(r.max >= prev.max, `bomb max non-decreasing at ${elapsed}`);
    prev = r;
  }
  // The bomb range genuinely climbs from its starting point to the cap.
  const start = bombValueRange(0, config);
  const end = bombValueRange(HUGE, config);
  assert.ok(end.min > start.min, 'bomb min must climb over time');
  assert.ok(end.max > start.max, 'bomb max must climb over time');
});

test('upward drift (R2): seeded brick sample-mean is higher at later elapsed', () => {
  const t1 = 0;
  const t2 = config.difficulty.levelInterval * 6; // several levels later
  const rng1 = createRng(777);
  const rng2 = createRng(777);
  const mean1 = mean(Array.from({ length: N }, () => rollBrickValue(t1, rng1, config)));
  const mean2 = mean(Array.from({ length: N }, () => rollBrickValue(t2, rng2, config)));
  assert.ok(
    mean2 >= mean1,
    `brick sample-mean must not fall over time (t1=${mean1}, t2=${mean2})`,
  );
});

test('upward drift (R2): seeded bomb sample-mean is higher at later elapsed', () => {
  const t1 = 0;
  const t2 = config.difficulty.levelInterval * 6;
  const rng1 = createRng(888);
  const rng2 = createRng(888);
  const mean1 = mean(Array.from({ length: N }, () => rollBombValue(t1, rng1, config)));
  const mean2 = mean(Array.from({ length: N }, () => rollBombValue(t2, rng2, config)));
  assert.ok(
    mean2 >= mean1,
    `bomb sample-mean must not fall over time (t1=${mean1}, t2=${mean2})`,
  );
});

test('determinism (INV-2): same seed + elapsed => identical brick roll sequence', () => {
  const a = createRng(2024);
  const b = createRng(2024);
  for (let i = 0; i < N; i++) {
    const elapsed = i; // vary elapsed but keep both rngs in lockstep
    assert.equal(
      rollBrickValue(elapsed, a, config),
      rollBrickValue(elapsed, b, config),
      `brick roll ${i} must match for equal seeds`,
    );
  }
});

test('determinism (INV-2): same seed + elapsed => identical bomb roll sequence', () => {
  const a = createRng(2025);
  const b = createRng(2025);
  for (let i = 0; i < N; i++) {
    const elapsed = i;
    assert.equal(
      rollBombValue(elapsed, a, config),
      rollBombValue(elapsed, b, config),
      `bomb roll ${i} must match for equal seeds`,
    );
  }
});
