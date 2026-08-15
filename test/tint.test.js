// test/tint.test.js
//
// Unit tests for the pure value→tint mapping (T2, INV-7). Run via `npm test`
// (equivalently `node --test`).
//
// Proves INV-7's tint half headlessly, independent of Phaser: endpoint fidelity
// (min → config.tint.low, max → config.tint.high), monotonic green→red across
// the whole [1,30] value range (red non-decreasing, green non-increasing),
// clamping of out-of-range inputs to the endpoints, and that every returned RGB
// channel is an integer in [0,255]. Specific-value assertions, no truthiness.
// Imports the real config so the mapping is tested against production tunables.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { valueToTint } from '../src/render/tint.js';
import defaultTint from '../src/render/tint.js';
import config from '../src/core/config.js';

// Split a packed 0xRRGGBB integer into channels for per-channel assertions.
function channels(color) {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

test('exports the tint API (named and default)', () => {
  assert.equal(typeof valueToTint, 'function', 'valueToTint must be a function');
  assert.equal(
    defaultTint.valueToTint,
    valueToTint,
    'default.valueToTint must match the named export',
  );
});

test('endpoints map exactly to the configured tint colours', () => {
  assert.equal(
    valueToTint(config.values.brickMin, config),
    config.tint.low,
    'brickMin must map to config.tint.low',
  );
  assert.equal(
    valueToTint(config.values.brickMax, config),
    config.tint.high,
    'brickMax must map to config.tint.high',
  );
});

test('monotonic green→red across the full [1,30] value range (INV-7)', () => {
  const { brickMin, brickMax } = config.values;
  let prev = channels(valueToTint(brickMin, config));

  for (let v = brickMin + 1; v <= brickMax; v++) {
    const cur = channels(valueToTint(v, config));
    assert.ok(
      cur.r >= prev.r,
      `red channel must be non-decreasing at value ${v} (was ${prev.r}, now ${cur.r})`,
    );
    assert.ok(
      cur.g <= prev.g,
      `green channel must be non-increasing at value ${v} (was ${prev.g}, now ${cur.g})`,
    );
    prev = cur;
  }
});

test('red strictly increases and green strictly decreases end to end', () => {
  // Sanity beyond monotonic: the endpoints genuinely differ in the expected
  // direction, so the mapping is not degenerate/flat.
  const lo = channels(valueToTint(config.values.brickMin, config));
  const hi = channels(valueToTint(config.values.brickMax, config));
  assert.ok(hi.r > lo.r, 'red must be greater at the max than at the min');
  assert.ok(hi.g < lo.g, 'green must be smaller at the max than at the min');
});

test('out-of-range inputs clamp to the endpoint colours', () => {
  const { brickMin, brickMax } = config.values;
  // Below min → low endpoint; above max → high endpoint.
  assert.equal(valueToTint(brickMin - 5, config), config.tint.low, 'below min clamps to low');
  assert.equal(valueToTint(-100, config), config.tint.low, 'far below min clamps to low');
  assert.equal(valueToTint(brickMax + 5, config), config.tint.high, 'above max clamps to high');
  assert.equal(valueToTint(999, config), config.tint.high, 'far above max clamps to high');
});

test('every channel is an integer in [0,255] across the range and beyond', () => {
  for (let v = config.values.brickMin - 3; v <= config.values.brickMax + 3; v++) {
    const c = channels(valueToTint(v, config));
    for (const [name, ch] of [['r', c.r], ['g', c.g], ['b', c.b]]) {
      assert.ok(Number.isInteger(ch), `${name} channel must be an integer at value ${v}`);
      assert.ok(ch >= 0 && ch <= 255, `${name} channel must be within [0,255] at value ${v}`);
    }
  }
});

test('the returned value is a whole 24-bit integer colour', () => {
  const mid = Math.round((config.values.brickMin + config.values.brickMax) / 2);
  const color = valueToTint(mid, config);
  assert.ok(Number.isInteger(color), 'the tint must be an integer');
  assert.ok(color >= 0 && color <= 0xffffff, 'the tint must fit in 24 bits');
});
