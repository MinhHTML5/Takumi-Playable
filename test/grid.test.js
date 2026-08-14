// test/grid.test.js
//
// Unit tests for the pure grid data model + helpers (phase plan T3).
// Run via `npm test` (equivalently `node --test`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import config from '../src/core/config.js';
import {
  createBrick,
  createRow,
  columnCenterX,
  rowBricks,
  columnBricks,
  clearRow,
  topEdgeY,
} from '../src/core/grid.js';

test('createBrick produces the full brick shape, alive with no fade', () => {
  const brick = createBrick({ id: 7, row: 2, col: 3, value: 12, y: 400 });
  assert.deepEqual(brick, {
    id: 7,
    row: 2,
    col: 3,
    value: 12,
    y: 400,
    alive: true,
    fadeInProgress: 0,
  });
});

test('createRow yields columns bricks with correct cols, shared row/y, sequential ids, all alive', () => {
  const columns = config.grid.columns;
  const values = Array.from({ length: columns }, (_, i) => i + 1);
  const row = 4;
  const y = 960;
  const startId = 100;

  const bricks = createRow({ row, values, y, startId, config });

  assert.equal(bricks.length, columns, 'one brick per column');

  const ids = new Set();
  bricks.forEach((brick, index) => {
    assert.equal(brick.col, index, 'col equals column index');
    assert.equal(brick.row, row, 'shared row id');
    assert.equal(brick.y, y, 'shared y');
    assert.equal(brick.value, values[index], 'value taken from values[index]');
    assert.equal(brick.id, startId + index, 'sequential id from startId');
    assert.equal(brick.alive, true, 'brick starts alive');
    assert.equal(brick.fadeInProgress, 0, 'brick starts un-faded');
    ids.add(brick.id);
  });
  assert.equal(ids.size, columns, 'ids are unique');
});

test('createRow rejects a values array whose length differs from config.grid.columns', () => {
  const tooFew = Array.from({ length: config.grid.columns - 1 }, () => 1);
  assert.throws(
    () => createRow({ row: 0, values: tooFew, y: 0, startId: 0, config }),
    /must equal config\.grid\.columns/,
  );
});

test('rowBricks returns only alive bricks belonging to the row', () => {
  const bricks = [
    createBrick({ id: 0, row: 0, col: 0, value: 3, y: 0 }),
    createBrick({ id: 1, row: 0, col: 1, value: 4, y: 0 }),
    createBrick({ id: 2, row: 1, col: 0, value: 5, y: 120 }),
  ];

  let result = rowBricks(bricks, 0);
  assert.deepEqual(result.map((b) => b.id), [0, 1], 'both row-0 bricks returned');

  // Mark one row-0 brick not alive; it must be excluded afterwards.
  bricks[0].alive = false;
  result = rowBricks(bricks, 0);
  assert.deepEqual(result.map((b) => b.id), [1], 'dead brick excluded');

  assert.deepEqual(rowBricks(bricks, 1).map((b) => b.id), [2], 'other row untouched');
});

test('columnBricks returns only alive bricks in the column, sorted by y', () => {
  const bricks = [
    createBrick({ id: 0, row: 2, col: 1, value: 3, y: 240 }),
    createBrick({ id: 1, row: 0, col: 1, value: 4, y: 0 }),
    createBrick({ id: 2, row: 1, col: 1, value: 5, y: 120 }),
    createBrick({ id: 3, row: 0, col: 2, value: 6, y: 0 }),
  ];

  let result = columnBricks(bricks, 1);
  assert.deepEqual(result.map((b) => b.y), [0, 120, 240], 'sorted ascending by y');
  assert.deepEqual(result.map((b) => b.id), [1, 2, 0], 'sorted brick order');

  // A dead brick in the column is excluded.
  bricks[1].alive = false; // id 1, y 0
  result = columnBricks(bricks, 1);
  assert.deepEqual(result.map((b) => b.id), [2, 0], 'dead brick excluded, still sorted');

  assert.deepEqual(columnBricks(bricks, 2).map((b) => b.id), [3], 'other column untouched');
});

test('clearRow marks the row dead, sums only alive values, and leaves other rows intact', () => {
  const bricks = [
    createBrick({ id: 0, row: 0, col: 0, value: 10, y: 0 }),
    createBrick({ id: 1, row: 0, col: 1, value: 20, y: 0 }),
    createBrick({ id: 2, row: 1, col: 0, value: 5, y: 120 }),
  ];

  const { bricks: next, cleared, clearedValue } = clearRow(bricks, 0);

  assert.equal(clearedValue, 30, 'sum of the two alive row-0 values');
  assert.deepEqual(cleared.map((b) => b.id).sort(), [0, 1], 'both row-0 bricks reported cleared');
  assert.ok(cleared.every((b) => b.alive === false), 'cleared bricks are not alive');

  assert.deepEqual(rowBricks(next, 0).map((b) => b.id), [], 'no alive bricks left in row 0');
  assert.deepEqual(rowBricks(next, 1).map((b) => b.id), [2], 'row 1 untouched');

  // Purity: the input collection is not mutated in place.
  assert.equal(bricks[0].alive, true, 'clearRow does not mutate the input bricks');
});

test('clearRow sums only alive values when the row already has a dead brick', () => {
  const bricks = [
    createBrick({ id: 0, row: 0, col: 0, value: 10, y: 0 }),
    createBrick({ id: 1, row: 0, col: 1, value: 20, y: 0 }),
  ];
  bricks[1].alive = false; // pre-existing dead brick

  const { cleared, clearedValue } = clearRow(bricks, 0);

  assert.equal(clearedValue, 10, 'only the still-alive value is summed');
  assert.deepEqual(cleared.map((b) => b.id), [0], 'only the alive brick is cleared');
});

test('clearRow on an empty or all-dead row returns clearedValue 0', () => {
  assert.equal(clearRow([], 0).clearedValue, 0, 'empty collection clears nothing');

  const bricks = [createBrick({ id: 0, row: 0, col: 0, value: 9, y: 0 })];
  bricks[0].alive = false;
  const { cleared, clearedValue } = clearRow(bricks, 0);
  assert.equal(clearedValue, 0, 'all-dead row clears nothing');
  assert.deepEqual(cleared, [], 'nothing reported cleared');
});

test('topEdgeY returns the minimum alive y, or null when none are alive', () => {
  const bricks = [
    createBrick({ id: 0, row: 2, col: 0, value: 1, y: 500 }),
    createBrick({ id: 1, row: 0, col: 0, value: 1, y: 100 }),
    createBrick({ id: 2, row: 1, col: 0, value: 1, y: 300 }),
  ];
  assert.equal(topEdgeY(bricks), 100, 'smallest y among alive bricks');

  bricks[1].alive = false; // remove the current top
  assert.equal(topEdgeY(bricks), 300, 'next-smallest alive y after top removed');

  assert.equal(topEdgeY([]), null, 'empty collection has no top edge');

  const allDead = [createBrick({ id: 9, row: 0, col: 0, value: 1, y: 0 })];
  allDead[0].alive = false;
  assert.equal(topEdgeY(allDead), null, 'all-dead collection has no top edge');
});

test('columnCenterX maps col 0 and the last column to expected centers for 720x6', () => {
  // design.width 720, columns 6 => columnWidth 120, half 60.
  assert.equal(config.design.width, 720, 'precondition: 720-wide design');
  assert.equal(config.grid.columns, 6, 'precondition: 6 columns');

  assert.equal(columnCenterX(0, config), 60, 'column 0 center');
  assert.equal(columnCenterX(5, config), 660, 'last column (5) center');
});
