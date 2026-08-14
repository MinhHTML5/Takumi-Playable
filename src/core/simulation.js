// src/core/simulation.js
//
// The orchestrating GameModel (TDD §4.3) — the stateful, engine-free rules
// engine for BlockDrop 2. It exclusively owns and mutates all game state
// (INV-3) and advances it each tick, composing the Phase 02 primitives (rng,
// difficulty/value scaling, grid/row helpers, scoring) with the Phase 03
// single-interaction resolver (`resolveCollision`).
//
// Purity (INV-1): this module imports nothing from a game engine or the DOM and
// reads no wall-clock. All randomness flows through the injected `rng` (INV-2),
// and every timing value (`dtSeconds`) is passed in by the caller, so a session
// is fully reproducible from a seed.
//
// The render layer (Phase 04) holds a GameModel reference for READING only: it
// calls `dropBomb`, `tick`, `getState`, `consumeEvents`, and `reset`, and never
// mutates state directly. `getState()` returns frozen, non-aliasing snapshots so
// callers cannot reach past the API (INV-3).

import {
  createRow,
  clearRow,
  columnCenterX,
  columnBricks,
  topEdgeY,
} from './grid.js';
import { rollBrickValue, rollBombValue, difficultyLevel } from './difficulty.js';
import { createScore, addValue } from './scoring.js';
import { resolveCollision } from './collision.js';

// Clamp `n` to the inclusive integer interval [lo, hi].
function clampInt(n, lo, hi) {
  const v = Math.floor(n);
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// Read the additive game-over top boundary (config.gameOver.topY), defaulting
// to 0 (the very top of the playfield) when the tunable is absent.
function gameOverTopYOf(config) {
  if (config.gameOver && typeof config.gameOver.topY === 'number') {
    return config.gameOver.topY;
  }
  return 0;
}

// Number of seeded initial rows (config.grid.initialRows), defaulting to 4.
function initialRowsOf(config) {
  const n = config.grid.initialRows;
  return Number.isInteger(n) && n > 0 ? n : 4;
}

/**
 * The headless game model. Owns every piece of mutable simulation state and is
 * the single authority that mutates it (INV-3).
 */
export class GameModel {
  /**
   * @param {{ config: object, rng: { nextInt: (min:number,max:number)=>number } }} deps
   */
  constructor({ config, rng }) {
    if (!config) throw new Error('GameModel requires a config');
    if (!rng || typeof rng.nextInt !== 'function') {
      throw new Error('GameModel requires an rng with nextInt(min,max)');
    }
    this.config = config;
    this.rng = rng;

    // Geometry derived from config (read-only reads).
    this.columns = config.grid.columns;
    this.rowHeight = config.grid.rowHeight;
    this.playHeight = config.design.height;
    this.columnWidth = config.design.width / config.grid.columns;
    this.gameOverTopY = gameOverTopYOf(config);

    this.reset();
  }

  /**
   * Return the model to its initial structural state (INV-6): time 0, score 0,
   * no active bomb, `status: 'playing'`, empty event queue, and a freshly seeded
   * `initialRows` layout. Structurally equal to a freshly constructed model.
   * @returns {void}
   */
  reset() {
    this.time = 0;
    this.difficultyLevel = 0;
    this.cooldownRemaining = 0;
    this.spawnAccumulator = 0;
    this.status = 'playing';
    this.score = createScore();
    this.bomb = null;
    this.pendingEvents = [];
    this.nextBrickId = 0;
    this.nextRowId = 0;
    this.bricks = [];
    this._seedInitialRows();
  }

  // Seed `initialRows` bottom-anchored rows: the bottom row's top edge sits at
  // playHeight - rowHeight, each higher row one rowHeight above it.
  _seedInitialRows() {
    const rows = initialRowsOf(this.config);
    for (let i = 0; i < rows; i += 1) {
      // i = 0 is the topmost seeded row; i = rows-1 is the bottom row.
      const y = this.playHeight - this.rowHeight * (rows - i);
      this._spawnRowAt(y);
    }
  }

  // Append one full row (one brick per column) at top-edge `y`, drawing values
  // through the injected rng at the current time. Returns the new row's id.
  _spawnRowAt(y) {
    const values = [];
    for (let c = 0; c < this.columns; c += 1) {
      values.push(rollBrickValue(this.time, this.rng, this.config));
    }
    const row = this.nextRowId;
    const created = createRow({
      row,
      values,
      y,
      startId: this.nextBrickId,
      config: this.config,
    });
    this.nextRowId += 1;
    this.nextBrickId += created.length;
    for (const brick of created) this.bricks.push(brick);
    return { row, y };
  }

  /**
   * Attempt to drop a bomb at horizontal game-unit position `x`. Returns `false`
   * with NO state change when the model is not playing, the cooldown has not
   * expired, or a bomb is already active (INV-5). On success creates the single
   * active bomb at the top of the snapped column and starts the cooldown.
   * @param {number} x - horizontal position in game units (or a column center).
   * @returns {boolean} whether a bomb was dropped.
   */
  dropBomb(x) {
    if (this.status !== 'playing') return false;
    if (this.cooldownRemaining > 0) return false;
    if (this.bomb !== null) return false;

    const col = clampInt(x / this.columnWidth, 0, this.columns - 1);
    const value = rollBombValue(this.time, this.rng, this.config);
    this.bomb = {
      col,
      x: columnCenterX(col, this.config),
      y: 0,
      value,
    };
    this.cooldownRemaining = this.config.bomb.cooldown;
    return true;
  }

  /**
   * Advance the whole simulation by `dtSeconds`. A model in `gameover` ignores
   * further ticks. Order: time/difficulty, cooldown decay, spawn timer, rise,
   * bomb fall + collision cascade, game-over detection.
   * @param {number} dtSeconds - elapsed simulated seconds for this step.
   * @returns {void}
   */
  tick(dtSeconds) {
    if (this.status !== 'playing') return;
    const dt = dtSeconds;

    // (1) advance time and recompute the difficulty level.
    this.time += dt;
    this.difficultyLevel = difficultyLevel(this.time, this.config);

    // (2) decay the drop cooldown, floored at 0.
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);

    // (3) spawn timer: for each full interval of accumulated time, add a new
    //     bottom row and carry the remainder.
    this.spawnAccumulator += dt;
    const interval = this.config.spawn.interval;
    while (this.spawnAccumulator >= interval) {
      this.spawnAccumulator -= interval;
      const { row, y } = this._spawnRowAt(this.playHeight - this.rowHeight);
      this.pendingEvents.push({ type: 'spawn', row, y });
    }

    // (4) rise: move every alive brick toward the top (decreasing y).
    const riseSpeed =
      this.config.rise.speed +
      this.difficultyLevel * this.config.difficulty.riseSpeedGrowthPerLevel;
    const dy = riseSpeed * dt;
    if (dy !== 0) {
      for (const brick of this.bricks) {
        if (brick.alive) brick.y -= dy;
      }
    }

    // (5) bomb fall + collision cascade.
    this._advanceBomb(dt);

    // (6) game-over: after rising, if the topmost alive brick reached the top
    //     boundary, end the session once.
    const top = topEdgeY(this.bricks);
    if (top !== null && top <= this.gameOverTopY) {
      this.status = 'gameover';
      this.pendingEvents.push({ type: 'gameover', time: this.time });
    }
  }

  // Advance the active bomb (if any) and resolve every alive brick in its column
  // it now overlaps, top-down, via resolveCollision. Mutates state and appends
  // detonation events. No-op when no bomb is active.
  _advanceBomb(dt) {
    if (this.bomb === null) return;
    const bomb = this.bomb;
    bomb.y += this.config.bomb.fallSpeed * dt;

    // Alive bricks in the bomb's column, sorted top-down (ascending y), that the
    // bomb's point position now overlaps vertically.
    const inColumn = columnBricks(this.bricks, bomb.col);
    for (const brick of inColumn) {
      if (!brick.alive) continue;
      const overlaps =
        bomb.y >= brick.y && bomb.y <= brick.y + this.rowHeight;
      if (!overlaps) continue;

      const result = resolveCollision(bomb.value, brick.value);

      if (result.outcome === 'greater') {
        // Brick destroyed; bomb survives with reduced value and continues down
        // the column (may reach the next brick this same tick).
        brick.alive = false;
        this.score = addValue(this.score, result.scoreGained);
        bomb.value = result.newBombValue;
        this.pendingEvents.push({
          type: 'explosion',
          outcome: 'greater',
          col: bomb.col,
          row: brick.row,
          x: bomb.x,
          y: brick.y,
          value: result.scoreGained,
        });
        // keep cascading through remaining overlapped bricks.
        continue;
      }

      if (result.outcome === 'lesser') {
        // Brick survives with reduced value; bomb is consumed. Cascade ends.
        brick.value = result.brickRemainingValue;
        this.score = addValue(this.score, result.scoreGained);
        this.pendingEvents.push({
          type: 'explosion',
          outcome: 'lesser',
          col: bomb.col,
          row: brick.row,
          x: bomb.x,
          y: brick.y,
          value: result.scoreGained,
        });
        this.bomb = null;
        return;
      }

      // exact: clear the hit brick's entire row; score the whole-row value via
      // grid.clearRow (single source of truth). Bomb is consumed. Emit both an
      // explosion and a rowClear (the screen-shake trigger, INV-8).
      const { bricks: nextBricks, clearedValue } = clearRow(
        this.bricks,
        brick.row,
      );
      this.bricks = nextBricks;
      this.score = addValue(this.score, clearedValue);
      this.pendingEvents.push({
        type: 'explosion',
        outcome: 'exact',
        col: bomb.col,
        row: brick.row,
        x: bomb.x,
        y: brick.y,
        value: 0,
      });
      this.pendingEvents.push({
        type: 'rowClear',
        row: brick.row,
        y: brick.y,
        clearedValue,
      });
      this.bomb = null;
      return;
    }

    // Bomb past the bottom of the playfield with no terminal interaction: a miss.
    if (this.bomb !== null && bomb.y > this.playHeight) {
      this.bomb = null;
    }
  }

  /**
   * A frozen, non-aliasing snapshot of the model state for the render layer
   * (INV-3). Mutating the returned object (or its bricks/bomb) cannot change the
   * model — every nested object is a frozen copy.
   * @returns {Readonly<{ time:number, status:string, score:number,
   *   difficultyLevel:number, bricks:object[], bomb:(object|null),
   *   danger:{ topEdgeY:(number|null) } }>}
   */
  getState() {
    const bricks = this.bricks.map((b) =>
      Object.freeze({
        id: b.id,
        row: b.row,
        col: b.col,
        value: b.value,
        y: b.y,
        alive: b.alive,
        fadeInProgress: b.fadeInProgress,
      }),
    );
    const bomb =
      this.bomb === null
        ? null
        : Object.freeze({
            col: this.bomb.col,
            x: this.bomb.x,
            y: this.bomb.y,
            value: this.bomb.value,
          });
    return Object.freeze({
      time: this.time,
      status: this.status,
      score: this.score.total,
      difficultyLevel: this.difficultyLevel,
      bricks: Object.freeze(bricks),
      bomb,
      danger: Object.freeze({ topEdgeY: topEdgeY(this.bricks) }),
    });
  }

  /**
   * Drain and return the events accumulated since the last call. A subsequent
   * call with no intervening tick returns `[]`.
   * @returns {Array<{ type:string }>} the drained events.
   */
  consumeEvents() {
    const drained = this.pendingEvents;
    this.pendingEvents = [];
    return drained;
  }
}

export default { GameModel };
