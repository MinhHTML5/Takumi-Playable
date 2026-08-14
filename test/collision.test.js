// test/collision.test.js
//
// Unit tests for the single bomb↔brick resolver (T2, INV-8). Run via `npm test`
// (equivalently `node --test`).
//
// Covers every INV-8 outcome branch with SPECIFIC delta values (never a
// truthiness check): greater / lesser / exact and their full delta objects; the
// greater↔exact and lesser↔exact equality boundary (bomb one above / equal /
// one below the brick); and brick values at the [1,30] extremes. Also verifies
// the exports shape (named + default) and the negative-adjacent guarantees (a
// greater input never reports bombSurvives:false; a lesser input never destroys
// the brick).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveCollision } from '../src/core/collision.js';
import defaultCollision from '../src/core/collision.js';

test('exports the collision API (named and default)', () => {
  assert.equal(typeof resolveCollision, 'function', 'resolveCollision must be a function');
  assert.equal(
    defaultCollision.resolveCollision,
    resolveCollision,
    'default.resolveCollision must match the named export',
  );
});

test('greater (bomb > brick): brick destroyed, bomb survives with reduced value', () => {
  // bomb 10 vs brick 4 → survives with 6, scores the brick value 4.
  assert.deepEqual(resolveCollision(10, 4), {
    outcome: 'greater',
    brickDestroyed: true,
    bombSurvives: true,
    newBombValue: 6,
    brickRemainingValue: 0,
    triggersRowClear: false,
    scoreGained: 4,
  });
});

test('lesser (bomb < brick): brick survives with reduced value, bomb consumed', () => {
  // bomb 3 vs brick 8 → brick remains 5, scores the bomb value 3, bomb removed.
  assert.deepEqual(resolveCollision(3, 8), {
    outcome: 'lesser',
    brickDestroyed: false,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 5,
    triggersRowClear: false,
    scoreGained: 3,
  });
});

test('exact (bomb === brick): both destroyed, row clear triggered, scoreGained 0', () => {
  // Row-clear scoring is owned by simulation.js; scoreGained is 0 here on purpose.
  assert.deepEqual(resolveCollision(7, 7), {
    outcome: 'exact',
    brickDestroyed: true,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 0,
    triggersRowClear: true,
    scoreGained: 0,
  });
});

test('equality boundary: bomb one above / equal / one below the same brick', () => {
  const brick = 12;

  // One above → greater, survives with value 1, scores the brick value.
  assert.deepEqual(resolveCollision(brick + 1, brick), {
    outcome: 'greater',
    brickDestroyed: true,
    bombSurvives: true,
    newBombValue: 1,
    brickRemainingValue: 0,
    triggersRowClear: false,
    scoreGained: brick,
  });

  // Exactly equal → exact, whole-row clear, no score here.
  assert.deepEqual(resolveCollision(brick, brick), {
    outcome: 'exact',
    brickDestroyed: true,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 0,
    triggersRowClear: true,
    scoreGained: 0,
  });

  // One below → lesser, brick remains value 1, scores the bomb value.
  assert.deepEqual(resolveCollision(brick - 1, brick), {
    outcome: 'lesser',
    brickDestroyed: false,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 1,
    triggersRowClear: false,
    scoreGained: brick - 1,
  });
});

test('brick at the minimum value 1', () => {
  // bomb 1 vs brick 1 → exact.
  assert.deepEqual(resolveCollision(1, 1), {
    outcome: 'exact',
    brickDestroyed: true,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 0,
    triggersRowClear: true,
    scoreGained: 0,
  });

  // bomb 5 vs brick 1 → greater, survives with 4, scores 1.
  assert.deepEqual(resolveCollision(5, 1), {
    outcome: 'greater',
    brickDestroyed: true,
    bombSurvives: true,
    newBombValue: 4,
    brickRemainingValue: 0,
    triggersRowClear: false,
    scoreGained: 1,
  });
});

test('brick at the maximum value 30', () => {
  // bomb 30 vs brick 30 → exact.
  assert.deepEqual(resolveCollision(30, 30), {
    outcome: 'exact',
    brickDestroyed: true,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 0,
    triggersRowClear: true,
    scoreGained: 0,
  });

  // bomb 2 vs brick 30 → lesser, brick remains 28, scores 2.
  assert.deepEqual(resolveCollision(2, 30), {
    outcome: 'lesser',
    brickDestroyed: false,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 28,
    triggersRowClear: false,
    scoreGained: 2,
  });

  // bomb 30 vs brick 1 → greater, survives with 29, scores 1.
  assert.deepEqual(resolveCollision(30, 1), {
    outcome: 'greater',
    brickDestroyed: true,
    bombSurvives: true,
    newBombValue: 29,
    brickRemainingValue: 0,
    triggersRowClear: false,
    scoreGained: 1,
  });
});

test('negative-adjacent: a greater input never reports bombSurvives:false', () => {
  for (const [bomb, brick] of [[10, 4], [30, 1], [2, 1]]) {
    const r = resolveCollision(bomb, brick);
    assert.equal(r.outcome, 'greater', `bomb ${bomb} > brick ${brick} must be greater`);
    assert.equal(r.bombSurvives, true, 'a greater outcome must keep the bomb alive');
    assert.equal(r.brickDestroyed, true, 'a greater outcome must destroy the brick');
    assert.equal(r.triggersRowClear, false, 'a greater outcome must not clear a row');
  }
});

test('negative-adjacent: a lesser input never destroys the brick', () => {
  for (const [bomb, brick] of [[3, 8], [1, 30], [1, 2]]) {
    const r = resolveCollision(bomb, brick);
    assert.equal(r.outcome, 'lesser', `bomb ${bomb} < brick ${brick} must be lesser`);
    assert.equal(r.brickDestroyed, false, 'a lesser outcome must leave the brick alive');
    assert.equal(r.bombSurvives, false, 'a lesser outcome must consume the bomb');
    assert.ok(r.brickRemainingValue >= 1, 'a lesser reduction must never drop below 1 (INV-7)');
  }
});
