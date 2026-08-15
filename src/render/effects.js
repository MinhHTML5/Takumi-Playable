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

import { valueToTint } from './tint.js';

// Linear interpolation between `a` (at t=0) and `b` (at t=1).
function lerp(a, b, t) {
  return a + t * (b - a);
}

// Clamp `t` to [0, 1] (progress guards for the shockwave curves).
function clamp01(t) {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
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

/**
 * Two-tier screen-shake parameters for a shake kind (BlockDrop-2 FR-2).
 *
 * `'rowClear'` → the heavier exact-match shake (`config.effects.shake`);
 * `'hit'` → the lighter, shorter shake fired on every bomb-hits-brick collision
 * (`config.effects.hitShake`). Any other kind yields a zeroed, no-op shake.
 * Returned as `{ durationMs, intensity }` — the exact args the render layer
 * passes to the camera shake.
 *
 * Pure: reads only its arguments, owns no state, and never touches Phaser/DOM.
 *
 * @param {string} kind - `'rowClear'` or `'hit'`.
 * @param {object} config - the tunables module (needs `effects.shake` /
 *   `effects.hitShake`).
 * @returns {{ durationMs: number, intensity: number }}
 */
export function screenShake(kind, config) {
  const e = config.effects;
  let s;
  switch (kind) {
    case 'rowClear':
      s = e.shake;
      break;
    case 'hit':
      s = e.hitShake;
      break;
    default:
      return { durationMs: 0, intensity: 0 };
  }
  return { durationMs: s.durationMs, intensity: s.intensity };
}

/**
 * Expanding-shockwave-ring scale at a normalized lifetime `progress` ∈ [0,1]
 * (BlockDrop-2 FR-3). Lerps `config.effects.shockwave.startScale` →
 * `endScale`. `progress` is clamped to [0,1] so out-of-range inputs sit at an
 * endpoint. Monotonically non-decreasing in `progress` (the ring only grows).
 *
 * @param {number} progress - elapsed / lifespan, in [0,1].
 * @param {object} config - the tunables module (needs `effects.shockwave`).
 * @returns {number} the ring scale at `progress`.
 */
export function shockwaveScale(progress, config) {
  const s = config.effects.shockwave;
  return lerp(s.startScale, s.endScale, clamp01(progress));
}

/**
 * Expanding-shockwave-ring alpha at a normalized lifetime `progress` ∈ [0,1]
 * (BlockDrop-2 FR-3). Fades `config.effects.shockwave.startAlpha` → 0 over the
 * lifetime, so the ring vanishes exactly as it finishes expanding. `progress`
 * is clamped to [0,1]. Monotonically non-increasing in `progress`.
 *
 * @param {number} progress - elapsed / lifespan, in [0,1].
 * @param {object} config - the tunables module (needs `effects.shockwave`).
 * @returns {number} the ring alpha at `progress`.
 */
export function shockwaveAlpha(progress, config) {
  const s = config.effects.shockwave;
  return lerp(s.startAlpha, 0, clamp01(progress));
}

/**
 * The tint colour for a collision effect (BlockDrop-2 FR-3). An `'exact'`
 * row-clear flashes the high (red) endpoint (`config.tint.high`); a partial
 * `'greater'`/`'lesser'` hit is coloured by the value gained via the monotonic
 * value→tint mapping (INV-7). Centralizes the tint decision shared by the
 * explosion sprite, particle burst, and shockwave ring so they always agree.
 *
 * Pure: reads only its arguments, owns no state, and never touches Phaser/DOM.
 *
 * @param {string} outcome - the collision outcome (`greater`/`lesser`/`exact`).
 * @param {number} value - the value gained by the hit (ignored for `exact`).
 * @param {object} config - the tunables module (needs `tint` and `values`).
 * @returns {number} an integer 0xRRGGBB colour.
 */
export function outcomeTint(outcome, value, config) {
  if (outcome === 'exact') return config.tint.high;
  return valueToTint(value, config);
}

export default {
  dangerPulse,
  explosionParticleCount,
  screenShake,
  shockwaveScale,
  shockwaveAlpha,
  outcomeTint,
};
