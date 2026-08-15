// test/effects.test.js
//
// Unit tests for the pure game-feel helpers (T1/T2, TDD §7 / §4.3). Run via
// `npm test` (equivalently `node --test`). Proves the phase's only real logic
// headlessly, independent of Phaser:
//   - dangerPulse: stays within the configured [minAlpha,maxAlpha] /
//     [minScaleY,maxScaleY] bands over a time sweep, sits at mid-band at t=0
//     (sin 0 ⇒ u=0.5), and repeats with period 1/frequencyHz.
//   - explosionParticleCount: exact per-outcome counts, budget-cap enforcement
//     (R5) via a cloned config with an inflated count, integer type, and 0 for
//     an unknown outcome.
// Specific-value and property assertions; imports the real config so the helpers
// are tested against production tunables.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dangerPulse,
  explosionParticleCount,
  screenShake,
  shockwaveScale,
  shockwaveAlpha,
  outcomeTint,
} from '../src/render/effects.js';
import defaultEffects from '../src/render/effects.js';
import { valueToTint } from '../src/render/tint.js';
import config from '../src/core/config.js';

// Deep-clone the tunables so a test can mutate a copy without touching the real
// config (JSON round-trip is sufficient — config is pure data).
function cloneConfig() {
  return JSON.parse(JSON.stringify(config));
}

const EPS = 1e-9;

test('exports the effects API (named and default)', () => {
  assert.equal(typeof dangerPulse, 'function', 'dangerPulse must be a function');
  assert.equal(
    typeof explosionParticleCount,
    'function',
    'explosionParticleCount must be a function',
  );
  assert.equal(defaultEffects.dangerPulse, dangerPulse, 'default.dangerPulse must match named');
  assert.equal(
    defaultEffects.explosionParticleCount,
    explosionParticleCount,
    'default.explosionParticleCount must match named',
  );
  for (const [name, fn] of [
    ['screenShake', screenShake],
    ['shockwaveScale', shockwaveScale],
    ['shockwaveAlpha', shockwaveAlpha],
    ['outcomeTint', outcomeTint],
  ]) {
    assert.equal(typeof fn, 'function', `${name} must be a function`);
    assert.equal(defaultEffects[name], fn, `default.${name} must match named`);
  }
});

test('dangerPulse sits at the mid-band at t=0 (sin 0 ⇒ u=0.5)', () => {
  const p = config.effects.dangerPulse;
  const midAlpha = (p.minAlpha + p.maxAlpha) / 2;
  const midScaleY = (p.minScaleY + p.maxScaleY) / 2;

  const out = dangerPulse(0, config);
  assert.ok(Math.abs(out.alpha - midAlpha) < EPS, `alpha at t=0 must equal mid-band ${midAlpha}`);
  assert.ok(
    Math.abs(out.scaleY - midScaleY) < EPS,
    `scaleY at t=0 must equal mid-band ${midScaleY}`,
  );
});

test('dangerPulse stays within the configured alpha/scaleY bands over a time sweep', () => {
  const p = config.effects.dangerPulse;
  // Sweep several full periods at fine resolution to hit the extrema.
  const period = 1 / p.frequencyHz;
  const steps = 500;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * period * 3;
    const { alpha, scaleY } = dangerPulse(t, config);
    assert.ok(
      alpha >= p.minAlpha - EPS && alpha <= p.maxAlpha + EPS,
      `alpha ${alpha} out of [${p.minAlpha}, ${p.maxAlpha}] at t=${t}`,
    );
    assert.ok(
      scaleY >= p.minScaleY - EPS && scaleY <= p.maxScaleY + EPS,
      `scaleY ${scaleY} out of [${p.minScaleY}, ${p.maxScaleY}] at t=${t}`,
    );
    assert.ok(alpha >= 0, `alpha must never be negative (was ${alpha})`);
    assert.ok(scaleY >= 0, `scaleY must never be negative (was ${scaleY})`);
  }
});

test('dangerPulse reaches both band extremes over a period', () => {
  const p = config.effects.dangerPulse;
  const freq = p.frequencyHz;
  // u=1 (max) when sin=1 ⇒ 2π·f·t = π/2 ⇒ t = 1/(4f).
  const tMax = 1 / (4 * freq);
  // u=0 (min) when sin=-1 ⇒ 2π·f·t = 3π/2 ⇒ t = 3/(4f).
  const tMin = 3 / (4 * freq);

  const atMax = dangerPulse(tMax, config);
  const atMin = dangerPulse(tMin, config);

  assert.ok(Math.abs(atMax.alpha - p.maxAlpha) < EPS, 'alpha must reach maxAlpha at peak');
  assert.ok(Math.abs(atMax.scaleY - p.maxScaleY) < EPS, 'scaleY must reach maxScaleY at peak');
  assert.ok(Math.abs(atMin.alpha - p.minAlpha) < EPS, 'alpha must reach minAlpha at trough');
  assert.ok(Math.abs(atMin.scaleY - p.minScaleY) < EPS, 'scaleY must reach minScaleY at trough');
});

test('dangerPulse repeats with period 1/frequencyHz', () => {
  const period = 1 / config.effects.dangerPulse.frequencyHz;
  for (const t of [0, 0.13, 0.5, 1.7, 3.25]) {
    const base = dangerPulse(t, config);
    for (const k of [1, 2, 5]) {
      const shifted = dangerPulse(t + k * period, config);
      assert.ok(
        Math.abs(shifted.alpha - base.alpha) < 1e-6,
        `alpha must repeat every period (t=${t}, k=${k})`,
      );
      assert.ok(
        Math.abs(shifted.scaleY - base.scaleY) < 1e-6,
        `scaleY must repeat every period (t=${t}, k=${k})`,
      );
    }
  }
});

test('explosionParticleCount returns the exact per-outcome counts', () => {
  const e = config.effects.explosion;
  assert.equal(explosionParticleCount('greater', config), e.countGreater, 'greater → countGreater');
  assert.equal(explosionParticleCount('lesser', config), e.countLesser, 'lesser → countLesser');
  assert.equal(explosionParticleCount('exact', config), e.countExact, 'exact → countExact');
});

test('explosionParticleCount clamps to the particle budget when a count exceeds it (R5)', () => {
  const cfg = cloneConfig();
  const cap = cfg.particles.maxConcurrent;
  // Inflate a per-outcome count above the budget; the helper must return the cap.
  cfg.effects.explosion.countExact = cap + 500;
  assert.equal(
    explosionParticleCount('exact', cfg),
    cap,
    'an inflated count must be clamped to particles.maxConcurrent',
  );
  // A count exactly at the cap passes through unchanged.
  cfg.effects.explosion.countGreater = cap;
  assert.equal(explosionParticleCount('greater', cfg), cap, 'a count at the cap is returned as-is');
});

test('explosionParticleCount returns 0 for an unknown / non-collision outcome', () => {
  for (const outcome of ['gameover', 'spawn', 'rowClear', '', undefined, null]) {
    assert.equal(
      explosionParticleCount(outcome, config),
      0,
      `unknown outcome ${String(outcome)} must burst nothing`,
    );
  }
});

// ---------------------------------------------------------------------------
// FR-2 — two-tier screen shake
// ---------------------------------------------------------------------------

test('screenShake returns the configured params for each kind', () => {
  assert.deepEqual(
    screenShake('rowClear', config),
    { durationMs: config.effects.shake.durationMs, intensity: config.effects.shake.intensity },
    'rowClear → the heavier row-clear shake',
  );
  assert.deepEqual(
    screenShake('hit', config),
    { durationMs: config.effects.hitShake.durationMs, intensity: config.effects.hitShake.intensity },
    'hit → the lighter hit shake',
  );
});

test('FR-2: the hit shake is distinctly weaker and shorter than the row-clear shake', () => {
  const hit = screenShake('hit', config);
  const rowClear = screenShake('rowClear', config);
  assert.ok(hit.intensity < rowClear.intensity, 'hit intensity must be weaker than row-clear');
  assert.ok(hit.durationMs < rowClear.durationMs, 'hit shake must be shorter than row-clear');
  assert.ok(hit.intensity > 0 && hit.durationMs > 0, 'the hit shake still actually fires');
});

test('screenShake returns a zeroed no-op for an unknown kind', () => {
  assert.deepEqual(screenShake('nope', config), { durationMs: 0, intensity: 0 });
});

// ---------------------------------------------------------------------------
// FR-3 — expanding shockwave ring + per-outcome tint
// ---------------------------------------------------------------------------

test('shockwaveScale grows from startScale to endScale over the lifetime', () => {
  const s = config.effects.shockwave;
  assert.equal(shockwaveScale(0, config), s.startScale, 'at progress 0 → startScale');
  assert.equal(shockwaveScale(1, config), s.endScale, 'at progress 1 → endScale');
  // Monotonically non-decreasing across the sweep.
  let prev = -Infinity;
  for (let i = 0; i <= 20; i++) {
    const v = shockwaveScale(i / 20, config);
    assert.ok(v >= prev, `scale non-decreasing at ${i / 20}`);
    prev = v;
  }
  // Clamped outside [0,1].
  assert.equal(shockwaveScale(-1, config), s.startScale, 'clamps below 0');
  assert.equal(shockwaveScale(2, config), s.endScale, 'clamps above 1');
});

test('shockwaveAlpha fades from startAlpha to 0 over the lifetime', () => {
  const s = config.effects.shockwave;
  assert.equal(shockwaveAlpha(0, config), s.startAlpha, 'at progress 0 → startAlpha');
  assert.equal(shockwaveAlpha(1, config), 0, 'at progress 1 → fully transparent');
  let prev = Infinity;
  for (let i = 0; i <= 20; i++) {
    const v = shockwaveAlpha(i / 20, config);
    assert.ok(v <= prev, `alpha non-increasing at ${i / 20}`);
    assert.ok(v >= 0, 'alpha never negative');
    prev = v;
  }
});

test('outcomeTint: exact flashes red (tint.high); partial hits tint by value (INV-7)', () => {
  assert.equal(outcomeTint('exact', 12, config), config.tint.high, 'exact → high (red) endpoint');
  assert.equal(
    outcomeTint('greater', 12, config),
    valueToTint(12, config),
    'greater → value→tint of the gained value',
  );
  assert.equal(
    outcomeTint('lesser', 3, config),
    valueToTint(3, config),
    'lesser → value→tint of the gained value',
  );
});

test('explosionParticleCount always returns a non-negative integer', () => {
  const cfg = cloneConfig();
  // Fractional and negative configured counts still yield a clean integer ≥ 0.
  cfg.effects.explosion.countGreater = 7.9;
  cfg.effects.explosion.countLesser = -4;
  assert.equal(explosionParticleCount('greater', cfg), 7, 'fractional count is truncated');
  assert.equal(explosionParticleCount('lesser', cfg), 0, 'negative count clamps to 0');

  for (const outcome of ['greater', 'lesser', 'exact', 'unknown']) {
    const n = explosionParticleCount(outcome, config);
    assert.ok(Number.isInteger(n), `count for ${outcome} must be an integer`);
    assert.ok(n >= 0, `count for ${outcome} must be non-negative`);
    assert.ok(n <= config.particles.maxConcurrent, `count for ${outcome} must not exceed the cap`);
  }
});
