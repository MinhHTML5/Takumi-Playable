// test/restart.integration.test.js
//
// Restart-equivalence integration test (T4) proving the INV-6 clean-restart
// contract for the TWO mechanisms the game-over → Play-CTA flow actually uses.
// Run via `npm test` (equivalently `node --test`).
//
// This is additive to and distinct from the `simulation.test.js` INV-6 unit test
// (which only covers `reset()` under an *identical* seed). Here a full session is
// driven to `status: 'gameover'` with no input, and then BOTH restart paths are
// asserted to yield the canonical initial state:
//
//   (A) Re-construction — what `GameScene.create()` does on the CTA restart:
//       build a BRAND-NEW `GameModel` with the same config and a DIFFERENT seed.
//       The contract is STRUCTURAL: values need not match the played-out session
//       (different seed), but the shape must be the canonical initial state.
//   (B) Reset — call `reset()` on the played-out model.
//
// Canonical initial state (TDD §4.4 INV-6/INV-7): status 'playing', time 0,
// score 0, no bomb, difficultyLevel 0, a full `initialRows * columns` brick
// layout with every brick alive and every brick value ∈ [brickMin, brickMax].

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameModel } from '../src/core/simulation.js';
import realConfig from '../src/core/config.js';
import { createRng } from '../src/core/rng.js';

// Drive a model to game-over with NO input (bricks simply rise to the top),
// mirroring the R2 drive-to-game-over approach in simulation.integration.test.js.
// Returns the number of steps taken. Fails loudly if the session never ends
// within the hard cap (so a broken drive can never silently pass the test).
function driveToGameOver(model, dt = 1 / 60, maxSteps = 60 * 120) {
  let steps = 0;
  while (model.getState().status === 'playing' && steps < maxSteps) {
    model.tick(dt);
    steps += 1;
  }
  assert.equal(
    model.getState().status,
    'gameover',
    `session must reach game-over within ${maxSteps} steps (drive precondition)`,
  );
  return steps;
}

// Assert that `state` (a getState() snapshot) is the canonical initial state for
// `config`. Shared by both restart paths so the two assertions cannot drift.
function assertCanonicalInitialState(state, config, label) {
  const columns = config.grid.columns;
  const initialRows = config.grid.initialRows;
  const expectedBricks = initialRows * columns;

  assert.equal(state.status, 'playing', `${label}: status === 'playing'`);
  assert.equal(state.time, 0, `${label}: time === 0`);
  assert.equal(state.score, 0, `${label}: score === 0`);
  assert.equal(state.bomb, null, `${label}: bomb === null`);
  assert.equal(state.difficultyLevel, 0, `${label}: difficultyLevel === 0`);
  assert.equal(
    state.bricks.length,
    expectedBricks,
    `${label}: bricks.length === initialRows(${initialRows}) * columns(${columns}) = ${expectedBricks}`,
  );
  assert.ok(state.bricks.length > 0, `${label}: a non-empty brick layout was seeded`);
  assert.ok(
    state.bricks.every((b) => b.alive),
    `${label}: every seeded brick is alive`,
  );
  assert.ok(
    state.bricks.every(
      (b) => b.value >= config.values.brickMin && b.value <= config.values.brickMax,
    ),
    `${label}: every brick value ∈ [${config.values.brickMin}, ${config.values.brickMax}] (INV-7)`,
  );
}

// ---------------------------------------------------------------------------
// (A) Re-construction path — the mechanism GameScene.create() uses on restart.
// ---------------------------------------------------------------------------

test('INV-6 restart (re-construction): a fresh model with a DIFFERENT seed after game-over is the canonical initial state', () => {
  const playedOut = new GameModel({ config: realConfig, rng: createRng(20260815) });
  driveToGameOver(playedOut);

  // Precondition: the session genuinely played out (not an already-lost start).
  const ended = playedOut.getState();
  assert.equal(ended.status, 'gameover', 'precondition: prior session is over');
  assert.ok(ended.time > 0, 'precondition: prior session advanced simulated time');

  // Restart by RE-CONSTRUCTION with a DIFFERENT seed (what the CTA does).
  const restarted = new GameModel({ config: realConfig, rng: createRng(99999) });
  const fresh = restarted.getState();

  assertCanonicalInitialState(fresh, realConfig, 're-construction');

  // The contract is structural, not value-identical: a different seed may (and
  // typically does) produce a different brick-value layout than the played-out
  // session — that difference must NOT fail the contract. We assert only the
  // canonical shape above; here we confirm the fresh session is a clean start
  // regardless of the previous session's outcome.
  assert.notEqual(
    fresh.status,
    ended.status,
    'a re-constructed session is playing, not carrying the prior gameover status',
  );
});

// ---------------------------------------------------------------------------
// (B) Reset path — reset() on the played-out model.
// ---------------------------------------------------------------------------

test('INV-6 restart (reset): reset() on a played-out model restores the canonical initial state', () => {
  const model = new GameModel({ config: realConfig, rng: createRng(4242) });
  driveToGameOver(model);
  assert.equal(model.getState().status, 'gameover', 'precondition: session is over before reset');

  model.reset();
  const afterReset = model.getState();

  assertCanonicalInitialState(afterReset, realConfig, 'reset');
});

// ---------------------------------------------------------------------------
// Both mechanisms converge on the same canonical initial STRUCTURE.
// ---------------------------------------------------------------------------

test('INV-6 restart: re-construction and reset yield structurally equal initial state (count, aliveness, bounds, scalars)', () => {
  const model = new GameModel({ config: realConfig, rng: createRng(777) });
  driveToGameOver(model);

  const reconstructed = new GameModel({ config: realConfig, rng: createRng(1234) }).getState();
  model.reset();
  const afterReset = model.getState();

  // Both are the canonical initial state.
  assertCanonicalInitialState(reconstructed, realConfig, 're-construction');
  assertCanonicalInitialState(afterReset, realConfig, 'reset');

  // Scalar state matches exactly across the two mechanisms.
  assert.equal(reconstructed.status, afterReset.status, 'status matches across mechanisms');
  assert.equal(reconstructed.time, afterReset.time, 'time matches across mechanisms');
  assert.equal(reconstructed.score, afterReset.score, 'score matches across mechanisms');
  assert.equal(reconstructed.bomb, afterReset.bomb, 'bomb (null) matches across mechanisms');
  assert.equal(
    reconstructed.difficultyLevel,
    afterReset.difficultyLevel,
    'difficultyLevel matches across mechanisms',
  );
  assert.equal(
    reconstructed.bricks.length,
    afterReset.bricks.length,
    'brick count matches across mechanisms',
  );
});
