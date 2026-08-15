// src/render/loop.js
//
// Pure fixed-timestep frame-delta splitter (TDD §4.3 collision-overlap note /
// CF-04). Engine-free: no Phaser, no DOM. Phaser hands the scene a variable
// per-frame delta; feeding it straight into `model.tick` would let a spiky delta
// (e.g. a tab-defocus catch-up frame) advance the falling bomb more than one row
// height in a single tick and skip a brick, breaking the accepted point-overlap
// collision constraint. `fixedSteps` splits any delta into bounded sub-steps so
// each `model.tick` advances at most `maxStep` of simulated time.
//
// With `maxStep = config.loop.maxStepSeconds` (0.05), per-tick bomb travel is
// `config.bomb.fallSpeed(900) * 0.05 = 45`, safely below `config.grid.rowHeight`
// (120) — preserving the constraint under any frame delta (CF-04).

/**
 * Split a frame delta into bounded, near-equal sub-steps (CF-04).
 *
 * The returned durations sum to `dtSeconds` (exactly, within float precision)
 * and each is `<= maxStep`:
 *   - `dtSeconds <= 0`            → `[]`   (no time to advance)
 *   - `0 < dtSeconds <= maxStep`  → `[dtSeconds]`  (already bounded)
 *   - `dtSeconds > maxStep`       → `ceil(dtSeconds / maxStep)` equal sub-steps
 *
 * Pure: reads only its arguments, owns no state, and never touches Phaser/DOM.
 *
 * @param {number} dtSeconds - the frame delta in seconds.
 * @param {number} maxStep - the maximum allowed sub-step duration in seconds.
 * @returns {number[]} the ordered sub-step durations (summing to `dtSeconds`).
 */
export function fixedSteps(dtSeconds, maxStep) {
  if (dtSeconds <= 0) {
    return [];
  }

  if (dtSeconds <= maxStep) {
    return [dtSeconds];
  }

  // Split into the fewest equal sub-steps each no larger than maxStep. Because
  // n >= dtSeconds / maxStep, the equal size dtSeconds / n is always <= maxStep,
  // and n copies sum back to dtSeconds exactly.
  const n = Math.ceil(dtSeconds / maxStep);
  const step = dtSeconds / n;
  return new Array(n).fill(step);
}

export default { fixedSteps };
