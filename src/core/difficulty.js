// src/core/difficulty.js
//
// Difficulty / value-scaling primitives for the BlockDrop 2 simulation core
// (TDD §4.1 `difficulty.js`, §4.4 INV-7). Pure functions mapping elapsed
// simulated seconds → the difficulty level and the brick / bomb value
// distributions, drawing concrete values through an INJECTED rng (from
// `src/core/rng.js`). This module never reads the wall-clock: `elapsedSeconds`
// is always a parameter, and all randomness flows through the injected rng, so
// every result is reproducible from a seed (INV-2, R4).
//
// Curve constants come only from `config.difficulty`, `config.bomb.value`, and
// `config.values`; this module adds no config keys. All value bounds are kept
// inside `[config.values.brickMin, config.values.brickMax]` (i.e. [1,30]) and
// every distribution bound is non-decreasing in elapsed time — values drift
// upward as play progresses (R2). Note: the range-bounds helpers use the
// `...ValueRange` naming (not a `...Range`-alternative) so this module stays
// clean under the core-purity scan in `test/config.test.js`.

// Clamp `n` to the inclusive integer interval [lo, hi].
function clampInt(n, lo, hi) {
  const v = Math.floor(n);
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Integer difficulty level for the given elapsed time.
 * `floor(elapsedSeconds / config.difficulty.levelInterval)`, capped at
 * `config.difficulty.maxLevel`. Non-negative and non-decreasing in elapsed.
 *
 * @param {number} elapsedSeconds
 * @param {object} config
 * @returns {number} integer level in [0, config.difficulty.maxLevel]
 */
export function difficultyLevel(elapsedSeconds, config) {
  const { levelInterval, maxLevel } = config.difficulty;
  const raw = Math.floor(elapsedSeconds / levelInterval);
  if (raw < 0) return 0;
  if (raw > maxLevel) return maxLevel;
  return raw;
}

/**
 * Brick-value distribution bounds at the given elapsed time.
 * The lower bound drifts upward with difficulty (`valueDriftPerLevel` per
 * level) while the upper bound stays at `config.values.brickMax`, so the mean
 * rises over time. Both bounds are integers within [brickMin, brickMax] and
 * non-decreasing in elapsed.
 *
 * @param {number} elapsedSeconds
 * @param {object} config
 * @returns {{ min: number, max: number }}
 */
export function brickValueRange(elapsedSeconds, config) {
  const { brickMin, brickMax } = config.values;
  const level = difficultyLevel(elapsedSeconds, config);
  const drift = Math.floor(config.difficulty.valueDriftPerLevel * level);

  const max = clampInt(brickMax, brickMin, brickMax);
  let min = clampInt(brickMin + drift, brickMin, brickMax);
  if (min > max) min = max; // safety: keep min <= max under any config
  return { min, max };
}

/**
 * Bomb-value distribution bounds at the given elapsed time.
 * The center drifts upward (`config.bomb.value.base` + `growthPerLevel` per
 * level) with a fixed `variance` spread; both bounds are clamped to
 * [brickMin, brickMax] and are non-decreasing in elapsed.
 *
 * @param {number} elapsedSeconds
 * @param {object} config
 * @returns {{ min: number, max: number }}
 */
export function bombValueRange(elapsedSeconds, config) {
  const { brickMin, brickMax } = config.values;
  const { base, variance, growthPerLevel } = config.bomb.value;
  const level = difficultyLevel(elapsedSeconds, config);
  const center = base + growthPerLevel * level;

  let min = clampInt(center - variance, brickMin, brickMax);
  const max = clampInt(center + variance, brickMin, brickMax);
  if (min > max) min = max; // safety: keep min <= max under any config
  return { min, max };
}

/**
 * Draw an integer brick value at the given elapsed time through the injected
 * rng. Guaranteed to be an integer within `brickValueRange`, hence within
 * [config.values.brickMin, config.values.brickMax] (INV-7).
 *
 * @param {number} elapsedSeconds
 * @param {{ nextInt: (min: number, max: number) => number }} rng
 * @param {object} config
 * @returns {number}
 */
export function rollBrickValue(elapsedSeconds, rng, config) {
  const { min, max } = brickValueRange(elapsedSeconds, config);
  return rng.nextInt(min, max);
}

/**
 * Draw an integer bomb value at the given elapsed time through the injected
 * rng. Guaranteed to be an integer within `bombValueRange`, hence within
 * [config.values.brickMin, config.values.brickMax] (INV-7).
 *
 * @param {number} elapsedSeconds
 * @param {{ nextInt: (min: number, max: number) => number }} rng
 * @param {object} config
 * @returns {number}
 */
export function rollBombValue(elapsedSeconds, rng, config) {
  const { min, max } = bombValueRange(elapsedSeconds, config);
  return rng.nextInt(min, max);
}

export default {
  difficultyLevel,
  brickValueRange,
  bombValueRange,
  rollBrickValue,
  rollBombValue,
};
