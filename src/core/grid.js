// src/core/grid.js
//
// The abstract-game-unit data model and pure helpers for bricks and rows
// (TDD §4.1 `grid.js`, §4.2 data model; phase plan T3). This module is pure
// data plus stateless helpers: NO motion stepping, NO spawn timing, NO
// collision resolution — those live in Phase 03's `simulation.js` /
// `collision.js`. It reads geometry from `config.grid` / `config.design`
// (read-only) and never imports a game engine or DOM (INV-1 core purity).
//
// Brick shape (augments the illustrative TDD §4.2 shape with a stable `row`
// id so the row-clear helper stays robust under later rising motion):
//   { id, row, col, value, y, alive, fadeInProgress }
// `row` is a stable logical identifier for the row a brick belongs to; `y` is
// its spatial position in game units (which later phases mutate as the stack
// rises). Keeping `row` independent of `y` lets `clearRow` target a row by its
// identity regardless of where it has drifted.

/**
 * Build a single brick.
 * @param {{ id:number, row:number, col:number, value:number, y:number }} spec
 * @returns {{ id:number, row:number, col:number, value:number, y:number, alive:boolean, fadeInProgress:number }}
 */
export function createBrick({ id, row, col, value, y }) {
  return { id, row, col, value, y, alive: true, fadeInProgress: 0 };
}

/**
 * Build one brick per column for a single row.
 * `values.length` must equal `config.grid.columns`; each brick gets `col =
 * index`, the shared `row` and `y`, and a sequential id starting at `startId`.
 * All bricks start alive.
 * @param {{ row:number, values:number[], y:number, startId:number, config:object }} spec
 * @returns {object[]} one brick per column, in column order
 */
export function createRow({ row, values, y, startId, config }) {
  const columns = config.grid.columns;
  if (!Array.isArray(values) || values.length !== columns) {
    throw new Error(
      `createRow: values.length (${Array.isArray(values) ? values.length : 'n/a'}) must equal config.grid.columns (${columns})`,
    );
  }
  return values.map((value, index) =>
    createBrick({ id: startId + index, row, col: index, value, y }),
  );
}

/**
 * X center of a column in game units:
 *   col * columnWidth + columnWidth / 2, where columnWidth = design.width / columns.
 * @param {number} col
 * @param {object} config
 * @returns {number}
 */
export function columnCenterX(col, config) {
  const columnWidth = config.design.width / config.grid.columns;
  return col * columnWidth + columnWidth / 2;
}

/**
 * The alive bricks belonging to `row`.
 * @param {object[]} bricks
 * @param {number} row
 * @returns {object[]}
 */
export function rowBricks(bricks, row) {
  return bricks.filter((brick) => brick.alive && brick.row === row);
}

/**
 * The alive bricks in `col`, sorted ascending by `y` (prep for the Phase 03
 * bomb cascade, which walks a column from the top down).
 * @param {object[]} bricks
 * @param {number} col
 * @returns {object[]}
 */
export function columnBricks(bricks, col) {
  return bricks
    .filter((brick) => brick.alive && brick.col === col)
    .sort((a, b) => a.y - b.y);
}

/**
 * Row-clear helper: mark every alive brick in `row` as not alive and report
 * the value removed. Pure — returns a new bricks collection (new objects for
 * the cleared bricks; other bricks are passed through untouched). Bricks in
 * other rows and already-dead bricks are left unchanged.
 * @param {object[]} bricks
 * @param {number} row
 * @returns {{ bricks:object[], cleared:object[], clearedValue:number }}
 */
export function clearRow(bricks, row) {
  const cleared = [];
  let clearedValue = 0;
  const nextBricks = bricks.map((brick) => {
    if (brick.alive && brick.row === row) {
      clearedValue += brick.value;
      const dead = { ...brick, alive: false };
      cleared.push(dead);
      return dead;
    }
    return brick;
  });
  return { bricks: nextBricks, cleared, clearedValue };
}

/**
 * Smallest `y` among alive bricks (closest to the top) — the later
 * game-over / danger metric. Returns `null` when no bricks are alive.
 * @param {object[]} bricks
 * @returns {number|null}
 */
export function topEdgeY(bricks) {
  let min = null;
  for (const brick of bricks) {
    if (brick.alive && (min === null || brick.y < min)) {
      min = brick.y;
    }
  }
  return min;
}
