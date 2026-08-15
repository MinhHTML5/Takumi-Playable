// src/render/effects.js
//
// Pure, Phaser/DOM-free game-feel helpers for the Phase 05 juice layer (TDD §7
// particle budget / §4.3 event-driven effects). Engine-free by design: no
// Phaser, no `window`, no `document` — it imports cleanly under plain Node and
// is unit-tested headlessly (isolating the phase's only real logic, R3). The
// Phaser-coupled scene wiring (GameScene) consumes these results at render time.
//
// Two helpers:
//   - `dangerPulse(timeSeconds, config)`: a deterministic sine oscillator that
//     maps elapsed time to the top danger line's `{ alpha, scaleY }`, both
//     lerped between their configured min/max endpoints as the pulse `u` sweeps
//     [0,1]. Continuous and repeatable with period `1 / frequencyHz`.
//   - `explosionParticleCount(outcome, config)`: maps a collision outcome to an
//     integer particle-burst count, clamped to the performance budget
//     `config.particles.maxConcurrent` (R5). Unknown outcomes burst nothing.
//
// Pure: each reads only its arguments, owns no state, and never touches
// Phaser/DOM.

// Linear interpolation between `a` (at t=0) and `b` (at t=1).
function lerp(a, b, t) {
  return a + t * (b - a);
}

/**
 * Continuous danger-line pulse (TDD §4.3 continuous effect).
 *
 * Computes `u = (sin(2π · frequencyHz · timeSeconds) + 1) / 2` ∈ [0,1] and
 * lerps `alpha` between `[minAlpha, maxAlpha]` and `scaleY` between
 * `[minScaleY, maxScaleY]` from `config.effects.dangerPulse`.
 *
 * Deterministic for a given `timeSeconds`; expects non-negative time. At
 * `timeSeconds = 0`, `sin(0) = 0` so `u = 0.5` and both outputs sit at their
 * mid-band. The pattern repeats with period `1 / frequencyHz`.
 *
 * @param {number} timeSeconds - elapsed simulated time (seconds, ≥ 0).
 * @param {object} config - the tunables module (needs `effects.dangerPulse`).
 * @returns {{ alpha: number, scaleY: number }} the pulsing line properties.
 */
export function dangerPulse(timeSeconds, config) {
  const p = config.effects.dangerPulse;
  const u = (Math.sin(2 * Math.PI * p.frequencyHz * timeSeconds) + 1) / 2;
  return {
    alpha: lerp(p.minAlpha, p.maxAlpha, u),
    scaleY: lerp(p.minScaleY, p.maxScaleY, u),
  };
}

/**
 * Budget-capped particle-burst count for a collision outcome (R5).
 *
 * Maps `'greater' → countGreater`, `'lesser' → countLesser`,
 * `'exact' → countExact` from `config.effects.explosion`; any other value
 * (e.g. a non-collision event such as `'gameover'`) yields `0`. The result is
 * clamped to `[0, config.particles.maxConcurrent]` so no single burst can
 * exceed the performance budget, and is always returned as an integer.
 *
 * @param {string} outcome - the collision outcome (`greater`/`lesser`/`exact`).
 * @param {object} config - the tunables module (needs `effects.explosion` and
 *   `particles.maxConcurrent`).
 * @returns {number} an integer particle count in `[0, maxConcurrent]`.
 */
export function explosionParticleCount(outcome, config) {
  const e = config.effects.explosion;

  let count;
  switch (outcome) {
    case 'greater':
      count = e.countGreater;
      break;
    case 'lesser':
      count = e.countLesser;
      break;
    case 'exact':
      count = e.countExact;
      break;
    default:
      count = 0;
  }

  const cap = config.particles.maxConcurrent;
  // Clamp to the [0, cap] budget, then coerce to an integer count.
  const clamped = count < 0 ? 0 : count > cap ? cap : count;
  return Math.trunc(clamped);
}

export default { dangerPulse, explosionParticleCount };
