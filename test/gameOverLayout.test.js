// test/gameOverLayout.test.js
//
// Unit tests for the pure game-over layout helper (T2/T3, Phase 06). Run via
// `npm test` (equivalently `node --test`). Proves the phase's real layout logic
// headlessly, independent of Phaser:
//   - title and score are horizontally centred at `config.design.width / 2`.
//   - the CTA rectangle uses the configured `cta.width`/`height` and its
//     `left/top/right/bottom` edges are consistent with its centre + size.
//   - the CTA rectangle lies fully within `[0, width] × [0, height]`.
//   - vertical order is top→bottom: title.y < score.y < cta.y.
//   - every returned coordinate/dimension is a finite number.
//   - determinism: two calls with the same config return deeply-equal objects.
//   - robustness: a cloned config with different design/cta dimensions re-centres.
// Imports the real config so the helper is tested against production tunables.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gameOverLayout } from '../src/render/gameOverLayout.js';
import defaultLayout from '../src/render/gameOverLayout.js';
import config from '../src/core/config.js';

// Deep-clone the tunables so a test can mutate a copy without touching the real
// config (JSON round-trip is sufficient — config is pure data).
function cloneConfig() {
  return JSON.parse(JSON.stringify(config));
}

// Collect every numeric leaf of the layout object for finiteness checks.
function numericLeaves(obj) {
  const out = [];
  for (const value of Object.values(obj)) {
    if (typeof value === 'number') out.push(value);
    else if (value && typeof value === 'object') out.push(...numericLeaves(value));
  }
  return out;
}

test('exports the layout API (named and default)', () => {
  assert.equal(typeof gameOverLayout, 'function', 'named export must be a function');
  assert.equal(typeof defaultLayout, 'object', 'default export must be a bundle object');
  assert.equal(defaultLayout.gameOverLayout, gameOverLayout,
    'default bundle must expose the same gameOverLayout function');
});

test('title and score are horizontally centred at design.width / 2', () => {
  const layout = gameOverLayout(config);
  const centreX = config.design.width / 2;
  assert.equal(layout.title.x, centreX, 'title.x must be the horizontal centre');
  assert.equal(layout.score.x, centreX, 'score.x must be the horizontal centre');
  assert.equal(layout.cta.x, centreX, 'cta.x must be the horizontal centre');
});

test('CTA rectangle uses configured cta.width/height with consistent edges', () => {
  const layout = gameOverLayout(config);
  const ctaCfg = config.gameOver.screen.cta;

  assert.equal(layout.cta.width, ctaCfg.width, 'cta.width must come from config');
  assert.equal(layout.cta.height, ctaCfg.height, 'cta.height must come from config');

  // Edges derived from centre + size.
  assert.equal(layout.cta.left, layout.cta.x - ctaCfg.width / 2, 'left = centreX - width/2');
  assert.equal(layout.cta.right, layout.cta.x + ctaCfg.width / 2, 'right = centreX + width/2');
  assert.equal(layout.cta.top, layout.cta.y - ctaCfg.height / 2, 'top = centreY - height/2');
  assert.equal(layout.cta.bottom, layout.cta.y + ctaCfg.height / 2, 'bottom = centreY + height/2');

  // Width/height are consistent with the edge span.
  assert.equal(layout.cta.right - layout.cta.left, ctaCfg.width, 'edge span matches width');
  assert.equal(layout.cta.bottom - layout.cta.top, ctaCfg.height, 'edge span matches height');
});

test('CTA rectangle lies fully within [0, width] × [0, height]', () => {
  const layout = gameOverLayout(config);
  const { width, height } = config.design;

  assert.ok(layout.cta.left >= 0, 'CTA left edge must be on-screen');
  assert.ok(layout.cta.top >= 0, 'CTA top edge must be on-screen');
  assert.ok(layout.cta.right <= width, 'CTA right edge must be on-screen');
  assert.ok(layout.cta.bottom <= height, 'CTA bottom edge must be on-screen');
});

test('vertical order is top→bottom (title.y < score.y < cta.y)', () => {
  const layout = gameOverLayout(config);
  assert.ok(layout.title.y < layout.score.y, 'title must sit above score');
  assert.ok(layout.score.y < layout.cta.y, 'score must sit above CTA');
});

test('every returned coordinate/dimension is a finite number', () => {
  const layout = gameOverLayout(config);
  for (const n of numericLeaves(layout)) {
    assert.ok(Number.isFinite(n), `layout value must be finite, got ${n}`);
  }
});

test('determinism: two calls with the same config are deeply equal', () => {
  assert.deepEqual(gameOverLayout(config), gameOverLayout(config),
    'same config in must yield deeply-equal layout out');
});

test('robustness: a cloned config with different design/cta dims re-centres', () => {
  const alt = cloneConfig();
  alt.design.width = 1000;
  alt.design.height = 2000;
  alt.gameOver.screen.cta.width = 500;
  alt.gameOver.screen.cta.height = 200;

  const layout = gameOverLayout(alt);

  assert.equal(layout.title.x, 500, 'title re-centres to new width/2');
  assert.equal(layout.score.x, 500, 'score re-centres to new width/2');
  assert.equal(layout.cta.x, 500, 'CTA re-centres to new width/2');
  assert.equal(layout.cta.width, 500, 'CTA picks up the new configured width');
  assert.equal(layout.cta.height, 200, 'CTA picks up the new configured height');
  assert.equal(layout.cta.left, 250, 'left = 500 - 500/2');
  assert.equal(layout.cta.right, 750, 'right = 500 + 500/2');

  // Still fully on-screen and correctly ordered under the alternate config.
  assert.ok(layout.cta.left >= 0 && layout.cta.right <= alt.design.width,
    'CTA stays within horizontal bounds under alt config');
  assert.ok(layout.cta.top >= 0 && layout.cta.bottom <= alt.design.height,
    'CTA stays within vertical bounds under alt config');
  assert.ok(layout.title.y < layout.score.y && layout.score.y < layout.cta.y,
    'vertical order preserved under alt config');
});
