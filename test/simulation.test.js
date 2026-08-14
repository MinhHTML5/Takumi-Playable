// test/simulation.test.js
//
// Unit + contract tests for the GameModel orchestrator (T4). Run via `npm test`
// (equivalently `node --test`).
//
// Coverage (specific-value assertions, never truthiness):
//   - INV-5: dropBomb refused on active bomb / cooldown, accepted at cooldown 0.
//   - Tick mechanics: rise distance, spawn-after-interval with remainder carry,
//     difficulty-level recompute.
//   - INV-8 single-step outcomes at the model level: greater / lesser / exact.
//   - INV-4: score monotonic non-decrease and equal to the cumulative removed.
//   - INV-7: brick values observed via getState() stay within [1,30].
//   - INV-6: reset() yields the initial structural state (== a fresh model).
//   - Contract (TDD §4.3): getState() shape + non-aliasing, dropBomb boolean,
//     consumeEvents() drains, event objects carry a documented `type`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameModel } from '../src/core/simulation.js';
import defaultSimulation from '../src/core/simulation.js';
import realConfig from '../src/core/config.js';
import { createRng } from '../src/core/rng.js';

// A deterministic rng stub whose nextInt(min,max) ignores the range and returns
// scripted values in order (repeating the last once exhausted). Lets a test pin
// exact brick / bomb values regardless of the difficulty range.
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

// A minimal, fully-specified config for hand-constructed scenarios. Defaults:
// one column, one seeded row (top-edge y = height - rowHeight = 120), no rise,
// no spawning, no game-over interference. columnWidth = colWidth.
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
      cooldown: opts.cooldown ?? 0.5,
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

// ---------------------------------------------------------------------------
// Exports / construction
// ---------------------------------------------------------------------------

test('exports GameModel (named and default)', () => {
  assert.equal(typeof GameModel, 'function', 'GameModel must be a class/function');
  assert.equal(defaultSimulation.GameModel, GameModel, 'default.GameModel must match named export');
});

test('constructor seeds initialRows x columns bricks, playing, score 0, no bomb', () => {
  const config = makeConfig({ columns: 3, initialRows: 2, height: 480 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  const s = model.getState();
  assert.equal(s.status, 'playing');
  assert.equal(s.time, 0);
  assert.equal(s.score, 0);
  assert.equal(s.bomb, null);
  assert.equal(s.difficultyLevel, 0);
  assert.equal(s.bricks.length, 6, 'initialRows(2) * columns(3) = 6 bricks');
  assert.ok(s.bricks.every((b) => b.alive), 'all seeded bricks alive');
});

test('constructor rejects a missing rng', () => {
  const config = makeConfig();
  assert.throws(() => new GameModel({ config, rng: null }), /rng/);
});

// ---------------------------------------------------------------------------
// INV-5 — cooldown / single active bomb
// ---------------------------------------------------------------------------

test('INV-5: dropBomb returns true once and creates exactly one bomb', () => {
  const config = makeConfig();
  const model = new GameModel({ config, rng: scriptedRng([5, 9]) });
  const dropped = model.dropBomb(0);
  assert.equal(dropped, true, 'first drop succeeds');
  const s = model.getState();
  assert.notEqual(s.bomb, null, 'a bomb is now active');
  assert.equal(s.bomb.value, 9, 'bomb takes the rolled value');
  assert.equal(s.bomb.y, 0, 'bomb starts at the top');
  assert.equal(s.bomb.col, 0, 'x snaps to column 0');
});

test('INV-5: dropBomb refused while a bomb is already active', () => {
  const config = makeConfig();
  const model = new GameModel({ config, rng: scriptedRng([5, 9, 9]) });
  assert.equal(model.dropBomb(0), true);
  assert.equal(model.dropBomb(0), false, 'second drop refused (bomb active)');
});

test('INV-5: dropBomb refused while cooldown > 0, accepted once it reaches 0', () => {
  // Small dt so the cooldown persists across several ticks; a large fallSpeed so
  // the first bomb resolves (lesser -> removed) on the first tick, isolating the
  // cooldown gate from the active-bomb gate.
  const config = makeConfig({ cooldown: 0.5, fallSpeed: 1500 });
  const model = new GameModel({ config, rng: scriptedRng([20, 5, 5]) });
  assert.equal(model.dropBomb(0), true);

  const dt = 0.1;
  model.tick(dt); // bomb (5) vs brick (20) -> lesser -> bomb removed; cooldown 0.4
  assert.equal(model.getState().bomb, null, 'bomb consumed by the lesser hit');
  assert.equal(model.dropBomb(0), false, 'still refused: cooldown has not expired');

  for (let i = 0; i < 5; i += 1) model.tick(dt); // cooldown floors at 0
  assert.equal(model.dropBomb(0), true, 'accepted once cooldown reaches 0');
});

// ---------------------------------------------------------------------------
// Tick mechanics
// ---------------------------------------------------------------------------

test('rise: alive bricks move up by riseSpeed * dt and difficultyLevel recomputes', () => {
  const config = makeConfig({ riseSpeed: 10 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  const y0 = model.getState().bricks[0].y;
  assert.equal(y0, 120, 'seeded brick top-edge y = height(240) - rowHeight(120)');
  model.tick(1); // level 0 -> riseSpeed 10 -> dy 10
  const s = model.getState();
  assert.equal(s.bricks[0].y, 110, 'brick rose by riseSpeed(10) * dt(1)');
  assert.equal(s.difficultyLevel, 0, 'still difficulty level 0 at t=1');
});

test('rise: riseSpeed grows with difficulty level', () => {
  // levelInterval 4 so t crosses to level 1 quickly; growth 2 -> riseSpeed 14.
  const config = makeConfig({ riseSpeed: 10, levelInterval: 4, riseSpeedGrowthPerLevel: 2, height: 100000 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  const y0 = model.getState().bricks[0].y;
  model.tick(5); // time 5 -> level floor(5/4)=1 -> riseSpeed 10 + 1*2 = 12 -> dy 60
  const s = model.getState();
  assert.equal(s.difficultyLevel, 1, 'difficulty level 1 at t=5 with levelInterval 4');
  assert.equal(s.bricks[0].y, y0 - 12 * 5, 'dy = (10 + 1*2) * 5 = 60');
});

test('spawn: a new bottom row appears after one full interval, remainder carried', () => {
  const config = makeConfig({ spawnInterval: 1 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  model.tick(0.5); // accumulator 0.5 < 1 -> no spawn
  assert.equal(model.getState().bricks.length, 1, 'no spawn before the interval');
  model.consumeEvents();

  model.tick(0.6); // accumulator 1.1 -> exactly one spawn, remainder 0.1
  const s = model.getState();
  assert.equal(s.bricks.length, 2, 'exactly one new row spawned (single crossing)');
  const spawnEvents = model.consumeEvents().filter((e) => e.type === 'spawn');
  assert.equal(spawnEvents.length, 1, 'one spawn event emitted');

  model.tick(0.85); // accumulator 0.1 + 0.85 = 0.95 < 1 -> still no second spawn
  assert.equal(model.getState().bricks.length, 2, 'remainder carried; no doubled spawn');
});

test('spawn: a dt spanning multiple intervals spawns one row per interval', () => {
  const config = makeConfig({ spawnInterval: 1 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  model.tick(2.5); // 2 full intervals -> 2 spawns, remainder 0.5
  assert.equal(model.getState().bricks.length, 3, '1 seeded + 2 spawned');
  const spawns = model.consumeEvents().filter((e) => e.type === 'spawn');
  assert.equal(spawns.length, 2, 'two spawn events');
});

// ---------------------------------------------------------------------------
// INV-8 — single-step collision outcomes at the model level
// ---------------------------------------------------------------------------

test('INV-8 greater: brick dies, bomb value reduced, bomb survives, score += brickValue', () => {
  const config = makeConfig(); // brick at y=120, bomb reaches it in one dt (fallSpeed 120)
  const model = new GameModel({ config, rng: scriptedRng([4, 10]) });
  model.dropBomb(0);
  model.tick(1);
  const s = model.getState();
  assert.equal(s.bricks[0].alive, false, 'hit brick destroyed');
  assert.notEqual(s.bomb, null, 'bomb survives the greater hit');
  assert.equal(s.bomb.value, 6, 'bomb value 10 - brick 4 = 6');
  assert.equal(s.score, 4, 'score += destroyed brick value 4');
});

test('INV-8 lesser: brick value reduced, bomb removed, score += bombValue', () => {
  const config = makeConfig();
  const model = new GameModel({ config, rng: scriptedRng([10, 4]) });
  model.dropBomb(0);
  model.tick(1);
  const s = model.getState();
  assert.equal(s.bricks[0].alive, true, 'brick survives the lesser hit');
  assert.equal(s.bricks[0].value, 6, 'brick value 10 - bomb 4 = 6');
  assert.equal(s.bomb, null, 'bomb consumed');
  assert.equal(s.score, 4, 'score += bomb value 4');
});

test('INV-8 exact: whole row cleared, bomb removed, rowClear emitted, score = row sum', () => {
  const config = makeConfig({ columns: 3, initialRows: 1 });
  const model = new GameModel({ config, rng: scriptedRng([5, 5, 5, 5]) });
  model.dropBomb(180); // x 180 -> column 1 (columnWidth 120)
  model.tick(1);
  const s = model.getState();
  assert.ok(s.bricks.every((b) => !b.alive), 'entire row cleared');
  assert.equal(s.bomb, null, 'bomb consumed by the exact hit');
  assert.equal(s.score, 15, 'score = 5 + 5 + 5 (hit brick + remaining row values)');
  const events = model.consumeEvents();
  const rowClears = events.filter((e) => e.type === 'rowClear');
  assert.equal(rowClears.length, 1, 'one rowClear (screen-shake trigger) emitted');
  assert.equal(rowClears[0].clearedValue, 15, 'rowClear reports the aggregate value');
});

test('INV-8: a bomb that exits the bottom with no interaction is a miss (no score)', () => {
  // Bomb in a column with no alive brick in its path: drop into an empty column.
  const config = makeConfig({ columns: 2, colWidth: 120, initialRows: 1 });
  const model = new GameModel({ config, rng: scriptedRng([8, 8, 30]) });
  // Kill column 0's brick first via a big bomb so a later drop there misses.
  model.dropBomb(0); // column 0, bomb value 30 -> greater on brick 8
  model.tick(1); // y=120: resolves greater, bomb survives value 22
  model.tick(1); // y=240: no alive brick in column 0's path
  model.tick(1); // y=360 > height 240: bomb exits the bottom -> miss
  const afterFirst = model.getState();
  assert.equal(afterFirst.bomb, null, 'first bomb gone (destroyed brick then missed out)');
  assert.equal(afterFirst.score, 8, 'scored the one destroyed brick');
  assert.equal(afterFirst.bricks.find((b) => b.col === 0).alive, false, 'column 0 brick dead');
});

// ---------------------------------------------------------------------------
// INV-4 — monotonic scoring across a scripted sequence
// ---------------------------------------------------------------------------

test('INV-4: score is monotonic and equals the cumulative value removed (cascade)', () => {
  // Single column of three bricks (value 3 each); bomb 10 chews through all
  // three across successive ticks: 10->7->4->1, scoring 3+3+3 = 9.
  const config = makeConfig({ columns: 1, initialRows: 3, height: 480 });
  const model = new GameModel({ config, rng: scriptedRng([3, 3, 3, 10]) });
  model.dropBomb(0);

  const scores = [];
  const bombValues = [];
  for (let i = 0; i < 5; i += 1) {
    model.tick(1);
    const s = model.getState();
    scores.push(s.score);
    bombValues.push(s.bomb ? s.bomb.value : null);
  }

  // Monotonic non-decrease.
  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(scores[i] >= scores[i - 1], `score non-decreasing at step ${i}`);
  }
  assert.equal(scores[scores.length - 1], 9, 'final score = 3+3+3 destroyed values');
  assert.deepEqual(bombValues.slice(0, 3), [7, 4, 1], 'bomb value drops by each brick value');
});

// ---------------------------------------------------------------------------
// INV-7 — value bounds through a real-config session
// ---------------------------------------------------------------------------

test('INV-7: every brick value observed via getState() stays within [1,30]', () => {
  const model = new GameModel({ config: realConfig, rng: createRng(4242) });
  const dt = 1 / 60;
  for (let i = 0; i < 600; i += 1) {
    if (i % 40 === 0) model.dropBomb((i % realConfig.grid.columns) * 120 + 1);
    model.tick(dt);
    for (const b of model.getState().bricks) {
      if (!b.alive) continue;
      assert.ok(b.value >= 1 && b.value <= 30, `brick value ${b.value} within [1,30]`);
    }
    if (model.getState().status !== 'playing') break;
  }
});

// ---------------------------------------------------------------------------
// INV-6 — clean reset
// ---------------------------------------------------------------------------

test('INV-6: reset() restores the initial structural state (== a fresh model)', () => {
  const config = makeConfig({ columns: 3, initialRows: 2, height: 480, riseSpeed: 20, cooldown: 0 });
  const rng = scriptedRng([4]);
  const model = new GameModel({ config, rng });

  // Churn the model: drop bombs, tick, mutate state.
  for (let i = 0; i < 10; i += 1) {
    model.dropBomb(0);
    model.tick(0.5);
  }
  assert.ok(model.getState().time > 0, 'precondition: model has advanced');

  model.reset();
  const s = model.getState();
  const fresh = new GameModel({ config, rng: scriptedRng([4]) }).getState();

  assert.equal(s.status, 'playing', 'status reset to playing');
  assert.equal(s.time, 0, 'time reset to 0');
  assert.equal(s.score, 0, 'score reset to 0');
  assert.equal(s.bomb, null, 'no active bomb after reset');
  assert.equal(s.difficultyLevel, 0, 'difficulty level reset');
  assert.equal(s.bricks.length, fresh.bricks.length, 'brick count == fresh model');
  assert.equal(s.bricks.length, 6, 'initialRows(2) * columns(3) = 6');
  assert.ok(s.bricks.every((b) => b.alive), 'all bricks alive after reset');
  assert.equal(s.danger.topEdgeY, fresh.danger.topEdgeY, 'top edge matches a fresh layout');
});

// ---------------------------------------------------------------------------
// Contract (TDD §4.3)
// ---------------------------------------------------------------------------

test('contract: getState() returns the documented shape', () => {
  const config = makeConfig({ columns: 2, initialRows: 1 });
  const model = new GameModel({ config, rng: scriptedRng([7, 7]) });
  const s = model.getState();
  for (const key of ['time', 'status', 'score', 'difficultyLevel', 'bricks', 'bomb', 'danger']) {
    assert.ok(key in s, `snapshot has "${key}"`);
  }
  assert.ok(Array.isArray(s.bricks), 'bricks is an array');
  assert.equal(s.bomb, null, 'bomb null when none active');
  assert.ok('topEdgeY' in s.danger, 'danger carries topEdgeY');
  const b = s.bricks[0];
  for (const key of ['id', 'row', 'col', 'value', 'y', 'alive']) {
    assert.ok(key in b, `brick snapshot has "${key}"`);
  }
});

test('contract: getState() does not alias internal state (frozen, copied)', () => {
  const config = makeConfig({ riseSpeed: 10 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  const snap1 = model.getState();
  assert.ok(Object.isFrozen(snap1), 'snapshot is frozen');
  assert.ok(Object.isFrozen(snap1.bricks[0]), 'brick snapshots are frozen');

  const yBefore = snap1.bricks[0].y;
  model.tick(1); // model advances; the old snapshot must be unaffected
  assert.equal(snap1.bricks[0].y, yBefore, 'prior snapshot unchanged after a tick');
  assert.notEqual(model.getState().bricks[0].y, yBefore, 'new snapshot reflects the change');
});

test('contract: dropBomb returns a boolean', () => {
  const config = makeConfig();
  const model = new GameModel({ config, rng: scriptedRng([5, 9]) });
  assert.equal(typeof model.dropBomb(0), 'boolean');
  assert.equal(typeof model.dropBomb(0), 'boolean');
});

test('contract: consumeEvents() drains and returns [] on a second call', () => {
  const config = makeConfig({ spawnInterval: 1 });
  const model = new GameModel({ config, rng: scriptedRng([4]) });
  model.tick(1.0); // emits a spawn event
  const first = model.consumeEvents();
  assert.ok(Array.isArray(first), 'returns an array');
  assert.ok(first.length >= 1, 'drains the accumulated events');
  const second = model.consumeEvents();
  assert.deepEqual(second, [], 'second call with no tick returns []');
});

test('contract: every emitted event carries a type in the documented set', () => {
  const allowed = new Set(['spawn', 'explosion', 'rowClear', 'gameover']);
  const config = makeConfig({ columns: 3, initialRows: 1, spawnInterval: 1 });
  const model = new GameModel({ config, rng: scriptedRng([5, 5, 5, 5]) });
  model.dropBomb(180);
  model.tick(1.0); // exact hit -> explosion + rowClear; interval crossing -> spawn
  const events = model.consumeEvents();
  assert.ok(events.length >= 1, 'events were emitted');
  for (const e of events) {
    assert.ok(allowed.has(e.type), `event type "${e.type}" is documented`);
  }
});
