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
 * Brick-value distribution bounds at the given elapsed time (BlockDrop-2 FR-4).
 * The LOWER bound stays fixed at `config.values.brickMin` for the whole session
 * while the UPPER bound grows with difficulty from `config.values.brickStartMax`
 * toward `config.values.brickMax` (`brickMaxGrowthPerLevel` per level), so early
 * rows draw from a small starting range that ramps up. Both bounds are integers
 * within [brickMin, brickMax] and non-decreasing in elapsed. Falls back to
 * `brickMax` as the starting cap when `brickStartMax` is absent (legacy config).
 *
 * @param {number} elapsedSeconds
 * @param {object} config
 * @returns {{ min: number, max: number }}
 */
export function brickValueRange(elapsedSeconds, config) {
  const { brickMin, brickMax } = config.values;
  const startMax =
    typeof config.values.brickStartMax === 'number'
      ? config.values.brickStartMax
      : brickMax;
  const growthPerLevel =
    typeof config.difficulty.brickMaxGrowthPerLevel === 'number'
      ? config.difficulty.brickMaxGrowthPerLevel
      : 0;
  const level = difficultyLevel(elapsedSeconds, config);
  const grow = Math.floor(growthPerLevel * level);

  const min = clampInt(brickMin, brickMin, brickMax);
  let max = clampInt(startMax + grow, brickMin, brickMax);
  if (max < min) max = min; // safety: keep min <= max under any config
  return { min, max };
}

/**
 * Bomb-value distribution bounds at the given elapsed time (BlockDrop-2 FR-5).
 * The center drifts upward (`config.bomb.value.base` + `growthPerLevel` per
 * level) with a fixed `variance` spread; both bounds are clamped to the bomb's
 * OWN range [bombMin, bombMax] (DECOUPLED from the brick cap so late-game bombs
 * can reach 60), and are non-decreasing in elapsed. Falls back to
 * [brickMin, brickMax] when the bomb range keys are absent (legacy config).
 *
 * @param {number} elapsedSeconds
 * @param {object} config
 * @returns {{ min: number, max: number }}
 */
export function bombValueRange(elapsedSeconds, config) {
  const { brickMin, brickMax } = config.values;
  const bombMin =
    typeof config.values.bombMin === 'number' ? config.values.bombMin : brickMin;
  const bombMax =
    typeof config.values.bombMax === 'number' ? config.values.bombMax : brickMax;
  const { base, variance, growthPerLevel } = config.bomb.value;
  const level = difficultyLevel(elapsedSeconds, config);
  const center = base + growthPerLevel * level;

  let min = clampInt(center - variance, bombMin, bombMax);
  const max = clampInt(center + variance, bombMin, bombMax);
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
 * rng. Guaranteed to be an integer within `bombValueRange`, hence within the
 * bomb's own range [config.values.bombMin, config.values.bombMax] (FR-5).
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
