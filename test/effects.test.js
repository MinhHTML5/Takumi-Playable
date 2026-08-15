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

import { dangerPulse, explosionParticleCount } from '../src/render/effects.js';
import defaultEffects from '../src/render/effects.js';
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
