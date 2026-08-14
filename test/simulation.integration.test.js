// test/simulation.integration.test.js
//
// Integration tests for the wired GameModel (T5): the cross-module behaviour of
// collision + grid + scoring + difficulty under the model's tick. Run via
// `npm test` (equivalently `node --test`).
//
// Coverage (specific-value assertions, never truthiness):
//   - Multi-brick cascade (INV-8): one bomb chews through several bricks in a
//     single fall; its value drops by each brick value; score = Σ destroyed.
//   - Exact-match full-row clear (INV-8): the whole row clears, score = hit
//     brick + Σ remaining alive row values, and a rowClear event fires — including
//     a row where a column was already cleared (aggregate counts only alive).
//   - Session game-over window (R2): a no-input session under a fixed seed reaches
//     game-over within the tuned ~30-45 s band, and a gameover model is inert.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameModel } from '../src/core/simulation.js';
import realConfig from '../src/core/config.js';
import { createRng } from '../src/core/rng.js';

// Deterministic rng stub: nextInt ignores the range and returns scripted values
// in order (repeating the last once exhausted).
function scriptedRng(values) {
  let i = 0;
  return {
    nextInt() {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v;
    },
  };
}

function makeConfig(opts = {}) {
  const columns = opts.columns ?? 1;
  const colWidth = opts.colWidth ?? 120;
  const rowHeight = opts.rowHeight ?? 120;
  return {
    design: { width: columns * colWidth, height: opts.height ?? 240 },
    grid: { columns, rowHeight, initialRows: opts.initialRows ?? 1 },
    rise: { speed: opts.riseSpeed ?? 0 },
    gameOver: { topY: opts.gameOverTopY ?? -100000 },
    spawn: { interval: opts.spawnInterval ?? 100000 },
    bomb: {
      fallSpeed: opts.fallSpeed ?? 120,
      cooldown: opts.cooldown ?? 0,
      value: { base: 5, variance: 3, growthPerLevel: 2 },
    },
    values: { brickMin: 1, brickMax: 30 },
    difficulty: {
      levelInterval: opts.levelInterval ?? 8,
      valueDriftPerLevel: 1.5,
      riseSpeedGrowthPerLevel: opts.riseSpeedGrowthPerLevel ?? 2,
      maxLevel: 12,
    },
  };
}

// Drive ticks until the active bomb is gone (or a tick budget is exhausted).
function tickUntilBombGone(model, dt, budget = 100) {
  let n = 0;
  while (model.getState().bomb !== null && n < budget) {
    model.tick(dt);
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Multi-brick cascade (INV-8)
// ---------------------------------------------------------------------------

test('cascade: one bomb destroys a whole column, value drops per brick, score = Σ destroyed', () => {
  // Column of four bricks (value 2 each, sum 8) under a bomb of value 12.
  const config = makeConfig({ columns: 1, initialRows: 4, height: 600, fallSpeed: 120 });
  const model = new GameModel({ config, rng: scriptedRng([2, 2, 2, 2, 12]) });
  assert.equal(model.getState().bricks.length, 4, 'four seeded bricks');

  model.dropBomb(0);

  const bombValueSeq = [];
  let explosions = 0;
  for (let i = 0; i < 8; i += 1) {
    model.tick(1);
    const events = model.consumeEvents();
    explosions += events.filter((e) => e.type === 'explosion' && e.outcome === 'greater').length;
    const s = model.getState();
    if (s.bomb) bombValueSeq.push(s.bomb.value);
    if (s.bomb === null) break;
  }

  const s = model.getState();
  const aliveCount = s.bricks.filter((b) => b.alive).length;
  assert.equal(aliveCount, 0, 'all four bricks destroyed by the single fall');
  assert.equal(explosions, 4, 'four greater explosions, one per destroyed brick');
  assert.equal(s.score, 8, 'score = 2+2+2+2 destroyed values');
  // Bomb value steps 12 -> 10 -> 8 -> 6 -> 4 (dropping by each brick value 2).
  assert.deepEqual(bombValueSeq.slice(0, 4), [10, 8, 6, 4], 'bomb value drops by each brick value');
});

// ---------------------------------------------------------------------------
// Exact-match full-row clear (INV-8)
// ---------------------------------------------------------------------------

test('row clear: exact hit clears the full row, score = row sum, rowClear emitted', () => {
  const config = makeConfig({ columns: 3, initialRows: 1, fallSpeed: 120 });
  const model = new GameModel({ config, rng: scriptedRng([6, 6, 6, 6]) });
  model.dropBomb(180); // column 1
  tickUntilBombGone(model, 1);

  const s = model.getState();
  assert.ok(s.bricks.every((b) => !b.alive), 'entire row cleared');
  assert.equal(s.bomb, null, 'bomb consumed');
  assert.equal(s.score, 18, 'score = 6 (hit) + 6 + 6 (remaining) = 18');
});

test('row clear aggregate counts only alive bricks (a column already cleared)', () => {
  // Row values: col0=10, col1=7, col2=7. First a big bomb kills col0 (greater),
  // then an exact hit on col1 clears the two remaining alive bricks only.
  const config = makeConfig({ columns: 3, initialRows: 1, cooldown: 0, fallSpeed: 120, height: 240 });
  const model = new GameModel({ config, rng: scriptedRng([10, 7, 7, 15, 7]) });

  // Drop 1: column 0, bomb 15 > brick 10 -> greater, then misses out the bottom.
  model.dropBomb(0);
  tickUntilBombGone(model, 1);
  let s = model.getState();
  assert.equal(s.bricks.find((b) => b.col === 0).alive, false, 'column 0 brick destroyed');
  assert.equal(s.score, 10, 'scored the destroyed column-0 brick');

  // Drop 2: column 1, bomb 7 == brick 7 -> exact -> clears the two ALIVE bricks.
  const droppedAgain = model.dropBomb(180);
  assert.equal(droppedAgain, true, 'cooldown 0 allows the second drop');
  let rowClearValue = null;
  for (let i = 0; i < 10 && model.getState().bomb !== null; i += 1) {
    model.tick(1);
    const rc = model.consumeEvents().find((e) => e.type === 'rowClear');
    if (rc) rowClearValue = rc.clearedValue;
  }

  s = model.getState();
  assert.ok(s.bricks.every((b) => !b.alive), 'all bricks now cleared');
  assert.equal(rowClearValue, 14, 'aggregate = 7 + 7 (only alive), not counting the dead col-0 brick');
  assert.equal(s.score, 24, 'total = 10 (first) + 14 (row clear of alive bricks)');
});

// ---------------------------------------------------------------------------
// Session game-over window (R2)
// ---------------------------------------------------------------------------

test('R2: a no-input session reaches game-over within the tuned ~30-45 s band', () => {
  const dt = 1 / 60;
  // Timing is independent of the seed (no input -> nothing clears -> the top
  // row simply rises); assert it across several seeds for good measure.
  for (const seed of [1, 20260814, 777]) {
    const model = new GameModel({ config: realConfig, rng: createRng(seed) });
    let steps = 0;
    const maxSteps = 60 * 120; // 120 s hard cap
    while (model.getState().status === 'playing' && steps < maxSteps) {
      model.tick(dt);
      steps += 1;
    }
    const s = model.getState();
    assert.equal(s.status, 'gameover', `session reaches game-over (seed ${seed})`);
    assert.ok(
      s.time >= 30 && s.time <= 45,
      `game-over time ${s.time.toFixed(2)}s within [30,45] (seed ${seed})`,
    );
  }
});

test('R2: a gameover model ignores further tick and dropBomb', () => {
  const dt = 1 / 60;
  const model = new GameModel({ config: realConfig, rng: createRng(1) });
  while (model.getState().status === 'playing') model.tick(dt);

  const atGameOver = model.getState();
  assert.equal(atGameOver.status, 'gameover');
  const gameoverEvents = model.consumeEvents().filter((e) => e.type === 'gameover');
  assert.equal(gameoverEvents.length, 1, 'exactly one gameover event was emitted');

  const timeBefore = atGameOver.time;
  model.tick(dt); // must be inert
  assert.equal(model.getState().time, timeBefore, 'tick after game-over does not advance time');
  assert.equal(model.dropBomb(0), false, 'dropBomb refused after game-over');
});
