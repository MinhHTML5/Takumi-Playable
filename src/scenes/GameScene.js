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
// Phase 05 adds render-only juice: it drains `model.consumeEvents()` each frame
// and turns `explosion`/`rowClear`/`spawn` events into particles/shake/fade-in,
// and pulses the danger line from read-only elapsed time. It still never mutates
// model state directly (INV-3) — every read is via `getState()`/`consumeEvents()`.
// The game-over overlay/restart is a later phase (06).

import config from '../core/config.js';
import { createRng } from '../core/rng.js';
import { GameModel } from '../core/simulation.js';
import { columnCenterX } from '../core/grid.js';
import { valueToTint } from '../render/tint.js';
import { dangerPulse, explosionParticleCount } from '../render/effects.js';
import { fixedSteps } from '../render/loop.js';
import {
  TEX_BACKGROUND,
  TEX_BRICK,
  TEX_BOMB,
  TEX_DANGER_LINE,
  TEX_PARTICLE,
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

    // Phase 05 render-only effect state. `dangerLine` is the stored top danger
    // image whose alpha/scaleY pulse each frame; `explosionEmitter` is the single
    // reused particle emitter (TDD §7 reuse — no per-event allocation, R5);
    // `_fadeRows` records rows that emitted a `spawn` event so their bricks fade
    // in on first appearance. Populated in create()/update().
    this.dangerLine = null;
    this.explosionEmitter = null;
    this._fadeRows = new Set();
  }

  create() {
    const { width, height } = config.design;

    // Re-initialise the per-session scene fields so a `scene.start` restart
    // begins from a clean pool. Phaser reuses the scene instance across restart
    // and does NOT re-run the constructor, so constructor-only initialisation
    // would carry stale sprite references / a stale game-over guard into the new
    // session. `brickSprites`/`bombSprite`/`_fadeRows` mirror the constructor
    // defaults; `_gameOverHandled` guards the once-only GameOverScene launch
    // (reset to false so the fresh session can trigger its own game-over). The
    // sprites from the prior session are already destroyed by Phaser on
    // scene.start, so dropping the old references here is safe.
    this.brickSprites = new Map();
    this.bombSprite = null;
    this._fadeRows = new Set();
    this._gameOverHandled = false;

    // Static neon backdrop from the baked texture (TDD §7 reuse — no per-frame
    // Graphics). Top-left origin so it covers the whole 720×1280 game space.
    this.add.image(0, 0, TEX_BACKGROUND).setOrigin(0, 0).setDisplaySize(width, height);

    // Danger line at the game-over boundary. The texture's bright core sits at
    // its vertical centre, so a (0, 0.5) origin places that core exactly on
    // `config.gameOver.topY`. Tinted with the high (red) endpoint. Stored on a
    // field so `update()` can pulse its alpha/scaleY from `dangerPulse` each
    // frame; the (0, 0.5) origin keeps the scaleY pulse centred on `topY`.
    this.dangerLine = this.add
      .image(0, config.gameOver.topY, TEX_DANGER_LINE)
      .setOrigin(0, 0.5)
      .setTint(config.tint.high);

    // One reusable particle emitter for every explosion burst (TDD §7 reuse, R5).
    // Non-emitting: particles are produced only by explicit `explode(...)` calls
    // in `_dispatchEffect`. Lifespan/speed/scale come from `config.effects.explosion`;
    // per-burst colour is applied via `setParticleTint` at emit time. Depth above
    // bricks/bomb/score so bursts read on top.
    const ex = config.effects.explosion;
    this.explosionEmitter = this.add
      .particles(0, 0, TEX_PARTICLE, {
        lifespan: ex.lifespanMs,
        speed: { min: ex.speedMin, max: ex.speedMax },
        scale: { start: ex.scaleStart, end: ex.scaleEnd },
        emitting: false,
      })
      .setDepth(20);

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

    // Drain the events produced by this frame's tick(s) and turn each into a
    // render-only effect. Runs AFTER the tick loop, and unconditionally — on the
    // frame game-over is first reached the model has already frozen at the top of
    // the next update, but the tick that ends the game still pushed its final
    // explosion/rowClear this frame, so draining here plays that last burst. On
    // subsequent frozen frames no ticks run, so this drains an empty list.
    const events = this.model.consumeEvents();
    for (const event of events) {
      this._dispatchEffect(event);
    }

    // Latest snapshot: pulse the danger line from read-only elapsed sim time and
    // reconcile sprites (even when frozen, to keep the final frame consistent
    // after a resize/redraw). Read-only (INV-3).
    const snapshot = this.model.getState();
    const pulse = dangerPulse(snapshot.time, config);
    this.dangerLine.setAlpha(pulse.alpha);
    this.dangerLine.scaleY = pulse.scaleY;

    this._render(snapshot);

    // Game-over transition (render-only, INV-3: reads model state via getState()
    // only, never mutates it). Runs AFTER the tick loop, the event drain, and the
    // final-frame render, so the game-ending tick's last explosion/row-clear/shake
    // still plays this frame beneath the overlay. `_gameOverHandled` makes the
    // launch fire exactly once — not on every frozen post-game-over frame. Use
    // `launch` (not `start`) so this frozen neon final frame stays visible under
    // the GameOverScene's fading overlay; GameOverScene restarts GameScene on its
    // CTA. `_gameOverHandled` is reset in create(), so a fresh session re-arms it.
    if (snapshot.status === 'gameover' && !this._gameOverHandled) {
      this._gameOverHandled = true;
      this.scene.launch('GameOverScene', { score: snapshot.score });
    }
  }

  // Turn one drained model event into a render-only effect (INV-3: never touches
  // model state). `explosion` → a budget-capped particle burst (R5) tinted by
  // outcome/value; `rowClear` → the INV-8 screen shake; `spawn` → tag the new row
  // so its bricks fade in when first drawn. Any other event type (e.g. `gameover`)
  // has no render effect here (the overlay is Phase 06).
  _dispatchEffect(event) {
    switch (event.type) {
      case 'explosion': {
        // Count is already clamped to `config.particles.maxConcurrent` (R5).
        const count = explosionParticleCount(event.outcome, config);
        // Colour the burst by the collision: an exact row-clear flashes the high
        // (red) endpoint; a partial hit tints by the value gained.
        const tint =
          event.outcome === 'exact'
            ? config.tint.high
            : valueToTint(event.value, config);
        this.explosionEmitter.setParticleTint(tint);
        this.explosionEmitter.explode(count, event.x, event.y);
        break;
      }
      case 'rowClear':
        this.cameras.main.shake(
          config.effects.shake.durationMs,
          config.effects.shake.intensity,
        );
        break;
      case 'spawn':
        // Bricks in this row fade in on first render (see _renderBricks). Initial
        // seeded rows emit no `spawn` event, so they never fade (render full alpha).
        this._fadeRows.add(event.row);
        break;
      default:
        break;
    }
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

        // Spawn fade-in: if this brick's row emitted a `spawn` event, start the
        // freshly created sprite transparent and tween it to full alpha over
        // `config.effects.spawnFadeMs`. Only affects sprites created after their
        // spawn event; seeded initial rows (never tagged) render at full alpha.
        if (this._fadeRows.has(brick.row)) {
          sprite.setAlpha(0);
          this.tweens.add({
            targets: sprite,
            alpha: 1,
            duration: config.effects.spawnFadeMs,
          });
        }
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
