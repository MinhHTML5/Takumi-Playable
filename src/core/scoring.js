// src/core/scoring.js
//
// Monotonic score accumulation for the BlockDrop 2 simulation core
// (TDD §4.1, INV-4). Pure and self-contained: no dependency on the RNG,
// difficulty, or grid modules, and no engine/clock reads.
//
// INV-4 (monotonic non-decrease): the running total may only ever grow. A
// non-positive or non-finite delta (0, a negative number, NaN, undefined,
// Infinity coerced away) MUST leave the total unchanged — it can never drive
// the score down. Every operation returns a NEW state object; inputs are never
// mutated, so callers can keep prior snapshots safely.

// Coerce an arbitrary delta to the non-negative, finite amount to add.
// Negative, non-finite (NaN / ±Infinity), or missing deltas contribute 0,
// guaranteeing the total is monotonically non-decreasing.
function nonDecreasingDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/**
 * Create a fresh score state.
 *
 * @returns {{ total: number }} a new state with total 0.
 */
export function createScore() {
  return { total: 0 };
}

/**
 * Accumulate `delta` into the score, never decreasing the total.
 *
 * @param {{ total: number }} scoreState - prior state (not mutated).
 * @param {number} delta - amount to add; clamped so a non-positive or
 *   non-finite delta leaves the total unchanged (INV-4).
 * @returns {{ total: number }} a new state with the updated total.
 */
export function addValue(scoreState, delta) {
  return { total: scoreState.total + nonDecreasingDelta(delta) };
}

/**
 * Reset the score for a clean restart.
 *
 * @param {{ total: number }} _scoreState - prior state (not mutated).
 * @returns {{ total: number }} a new state with total 0.
 */
export function reset(_scoreState) {
  return { total: 0 };
}

export default { createScore, addValue, reset };
