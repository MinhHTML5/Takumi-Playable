// src/scenes/GameScene.js
//
// Phase 04 GameScene: the thin model↔Phaser adapter that makes the headless
// simulation visible and playable (TDD §4.1 Render/Input Layer, §4.3 GameModel
// API). It owns NO game rules — it constructs one GameModel, advances it with a
// fixed-timestep split of Phaser's variable frame delta (CF-04), and each frame
// reconciles a set of sprites to a READ-ONLY snapshot from `model.getState()`
// (INV-3). Input is forwarded straight to `model.dropBomb`; the model owns
// column snapping and the cooldown/one-bomb gate (INV-5).
//
// This is a render-layer module: it MAY use the `Phaser` browser global and read
// a wall-clock seed. INV-1/INV-2 (core purity, seeded randomness) constrain only
// `src/core/`; seeding the RNG from the clock here is deliberate session variety.
// Juice/effects and the game-over overlay/restart are later phases (05/06); this
// scene never drains `consumeEvents()` and never mutates model state directly.

import config from '../core/config.js';
import { createRng } from '../core/rng.js';
import { GameModel } from '../core/simulation.js';
import { columnCenterX } from '../core/grid.js';
import { valueToTint } from '../render/tint.js';
import { fixedSteps } from '../render/loop.js';
import {
  TEX_BACKGROUND,
  TEX_BRICK,
  TEX_BOMB,
  TEX_DANGER_LINE,
} from '../render/neon.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    // Keyed map of live brick sprites (brick id -> Phaser.Image). Reconciled to
    // the model snapshot each frame; sprites for dead/removed bricks are
    // destroyed. Initialised here so a scene restart starts from a clean pool.
    this.brickSprites = new Map();
    this.bombSprite = null;
    this.model = null;
  }

  create() {
    const { width, height } = config.design;

    // Static neon backdrop from the baked texture (TDD §7 reuse — no per-frame
    // Graphics). Top-left origin so it covers the whole 720×1280 game space.
    this.add.image(0, 0, TEX_BACKGROUND).setOrigin(0, 0).setDisplaySize(width, height);

    // Static danger line at the game-over boundary. The texture's bright core
    // sits at its vertical centre, so a (0, 0.5) origin places that core exactly
    // on `config.gameOver.topY`. Tinted with the high (red) endpoint.
    this.add
      .image(0, config.gameOver.topY, TEX_DANGER_LINE)
      .setOrigin(0, 0.5)
      .setTint(config.tint.high);

    // One GameModel per session. Seed is chosen here (render layer): a wall-clock
    // seed gives each session variety without violating INV-2 (which scopes only
    // src/core/). The model owns and mutates all simulation state (INV-3).
    const seed = Date.now();
    this.model = new GameModel({ config, rng: createRng(seed) });

    // Minimal live score readout (top-left). Juice/typography polish is Phase 05.
    this.scoreText = this.add
      .text(16, 16, 'SCORE 0', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0, 0)
      .setDepth(10);

    // Input: forward the tap's game-space X straight to the model. Under
    // Scale.FIT + CENTER_BOTH, pointer.worldX is already in the 720×1280 game
    // space, so no manual unproject is needed. The model owns column snapping and
    // the cooldown/one-bomb gate (INV-5); a gameover model no-ops the drop, but
    // we also guard here so a frozen session stops accepting input entirely.
    this.input.on('pointerdown', (pointer) => {
      if (this.model.getState().status === 'gameover') return;
      this.model.dropBomb(pointer.worldX);
    });

    // Draw the initial frame so the seeded stack is visible before the first tick.
    this._render(this.model.getState());
  }

  update(time, delta) {
    const state = this.model.getState();

    // Freeze on game-over: stop advancing the model, leave the final frame up
    // (overlay + restart CTA is Phase 06).
    if (state.status !== 'gameover') {
      // Split the variable frame delta into bounded sub-steps so a spiky frame
      // cannot advance the bomb more than one row per tick (CF-04).
      const dt = delta / 1000;
      for (const step of fixedSteps(dt, config.loop.maxStepSeconds)) {
        this.model.tick(step);
      }
    }

    // Always render the latest snapshot (even when frozen, to keep the final
    // frame consistent after a resize/redraw). Read-only (INV-3).
    this._render(this.model.getState());
  }

  // Reconcile the on-screen sprites to a read-only model snapshot. Reuses a keyed
  // map of brick sprites and a single bomb sprite; sprites for dead/removed
  // bricks are destroyed. Never mutates model state (INV-3).
  _render(state) {
    this._renderBricks(state.bricks);
    this._renderBomb(state.bomb);
    this.scoreText.setText(`SCORE ${state.score}`);
  }

  _renderBricks(bricks) {
    const rowHeight = config.grid.rowHeight;
    const seen = new Set();

    for (const brick of bricks) {
      if (!brick.alive) continue;
      seen.add(brick.id);

      let sprite = this.brickSprites.get(brick.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, TEX_BRICK);
        this.brickSprites.set(brick.id, sprite);
      }

      // Centre of the cell: horizontal column centre, vertical brick-top + half
      // a row. The brick texture's origin is its centre (Phaser default 0.5).
      sprite.setPosition(
        columnCenterX(brick.col, config),
        brick.y + rowHeight / 2,
      );
      // Tint reflects the CURRENT value, so a partial-damage brick shows its
      // reduced-value colour (INV-7).
      sprite.setTint(valueToTint(brick.value, config));
      sprite.setVisible(true);
    }

    // Destroy sprites for bricks that are no longer alive/present this frame.
    for (const [id, sprite] of this.brickSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.brickSprites.delete(id);
      }
    }
  }

  _renderBomb(bomb) {
    if (bomb === null) {
      if (this.bombSprite) this.bombSprite.setVisible(false);
      return;
    }

    if (!this.bombSprite) {
      this.bombSprite = this.add.image(0, 0, TEX_BOMB).setDepth(5);
    }
    this.bombSprite.setPosition(bomb.x, bomb.y);
    this.bombSprite.setTint(valueToTint(bomb.value, config));
    this.bombSprite.setVisible(true);
  }
}
