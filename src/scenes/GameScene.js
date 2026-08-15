// src/scenes/GameScene.js
//
// GameScene: the thin model↔Phaser adapter that makes the headless simulation
// visible and playable (TDD §4.1 Render/Input Layer, §4.3 GameModel API). It
// owns NO game rules — it constructs one GameModel, advances it with a
// fixed-timestep split of Phaser's variable frame delta (CF-04), and each frame
// reconciles a set of sprites to a READ-ONLY snapshot from `model.getState()`
// (INV-3). Input is forwarded straight to `model.dropBomb`; the model owns column
// snapping and the cooldown/one-bomb gate (INV-5).
//
// This is a render-layer module: it MAY use the `Phaser` browser global and read
// a wall-clock seed. INV-1/INV-2 (core purity, seeded randomness) constrain only
// `src/core/`. It never mutates model state directly (INV-3) — every read is via
// `getState()`/`consumeEvents()`.
//
// BlockDrop-2 juice + pacing layer:
//   FR-1 numeric labels centred on every alive brick and on the active bomb.
//   FR-2 two-tier shake: heavy row-clear shake + a lighter per-collision hit shake.
//   FR-3 explosion sprite-sheet animation + more particles + an expanding
//        shockwave ring, all tinted per outcome.
//   FR-7 two-bomb preview rendered in the top bar from `state.bombQueue`.
//   FR-8 dedicated top bar (score + previews); the danger line / game-over
//        boundary sits at `config.gameOver.topY` (= `config.topBar.height`).

import config from '../core/config.js';
import { createRng } from '../core/rng.js';
import { GameModel } from '../core/simulation.js';
import { columnCenterX } from '../core/grid.js';
import { valueToTint } from '../render/tint.js';
import {
  dangerPulse,
  explosionParticleCount,
  screenShake,
  shockwaveScale,
  shockwaveAlpha,
  outcomeTint,
} from '../render/effects.js';
import { fixedSteps } from '../render/loop.js';
import {
  TEX_BACKGROUND,
  TEX_BRICK,
  TEX_BOMB,
  TEX_DANGER_LINE,
  TEX_PARTICLE,
  TEX_SHOCKWAVE,
} from '../render/neon.js';

// Depth bands so gameplay, effects, and the top-bar UI layer predictably.
const DEPTH = {
  brick: 1,
  brickLabel: 2,
  bomb: 5,
  bombLabel: 6,
  shockwave: 19,
  particles: 20,
  explosionSprite: 21,
  topBarBg: 30,
  dangerLine: 31,
  score: 32,
  previewIcon: 32,
  previewLabel: 33,
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    // Keyed maps of live brick sprites / value labels (brick id -> object).
    // Reconciled to the model snapshot each frame; entries for dead/removed
    // bricks are destroyed. Initialised here so a scene restart starts clean.
    this.brickSprites = new Map();
    this.brickLabels = new Map();
    this.bombSprite = null;
    this.bombLabel = null;
    this.model = null;

    // Render-only effect state. `dangerLine` pulses each frame; `explosionEmitter`
    // is the single reused particle emitter (TDD §7 reuse, R5); `_fadeRows`
    // records rows that emitted a `spawn` event so their bricks fade in.
    this.dangerLine = null;
    this.explosionEmitter = null;
    this._fadeRows = new Set();

    // FR-7 preview widgets (created once in create(), updated each frame).
    this.previewIcons = [];
    this.previewLabels = [];
  }

  create() {
    const { width, height } = config.design;

    // Re-initialise per-session scene fields so a `scene.start` restart begins
    // from a clean pool (Phaser reuses the scene instance and does NOT re-run the
    // constructor). `_gameOverHandled` guards the once-only GameOverScene launch.
    this.brickSprites = new Map();
    this.brickLabels = new Map();
    this.bombSprite = null;
    this.bombLabel = null;
    this._fadeRows = new Set();
    this._gameOverHandled = false;

    // Static neon backdrop from the baked texture (TDD §7 reuse).
    this.add.image(0, 0, TEX_BACKGROUND).setOrigin(0, 0).setDisplaySize(width, height);

    // Danger line at the game-over boundary (FR-8: y = topBar.height). The
    // texture's bright core sits at its vertical centre, so a (0, 0.5) origin
    // places that core exactly on `config.gameOver.topY`. Tinted red; pulsed each
    // frame from `dangerPulse`.
    this.dangerLine = this.add
      .image(0, config.gameOver.topY, TEX_DANGER_LINE)
      .setOrigin(0, 0.5)
      .setTint(config.tint.high)
      .setDepth(DEPTH.dangerLine);

    // One reusable particle emitter for every explosion burst (TDD §7 reuse, R5).
    const ex = config.effects.explosion;
    this.explosionEmitter = this.add
      .particles(0, 0, TEX_PARTICLE, {
        lifespan: ex.lifespanMs,
        speed: { min: ex.speedMin, max: ex.speedMax },
        scale: { start: ex.scaleStart, end: ex.scaleEnd },
        emitting: false,
      })
      .setDepth(DEPTH.particles);

    // One GameModel per session. A wall-clock seed gives each session variety
    // without violating INV-2 (which scopes only src/core/).
    const seed = Date.now();
    this.model = new GameModel({ config, rng: createRng(seed) });

    // FR-8 top bar (score + previews) — created after gameplay layers so it sits
    // on top; the danger line above it marks the shrunk playfield's top edge.
    this._createTopBar();

    // Input: forward the tap's game-space X straight to the model. The model owns
    // column snapping and the cooldown/one-bomb gate (INV-5).
    this.input.on('pointerdown', (pointer) => {
      if (this.model.getState().status === 'gameover') return;
      this.model.dropBomb(pointer.worldX);
    });

    // Draw the initial frame so the seeded stack + previews are visible before
    // the first tick.
    this._render(this.model.getState());
  }

  update(time, delta) {
    const state = this.model.getState();

    // Freeze on game-over: stop advancing the model, leave the final frame up.
    if (state.status !== 'gameover') {
      // Split the variable frame delta into bounded sub-steps (CF-04).
      const dt = delta / 1000;
      for (const step of fixedSteps(dt, config.loop.maxStepSeconds)) {
        this.model.tick(step);
      }
    }

    // Drain this frame's events into render-only effects (runs after the ticks).
    const events = this.model.consumeEvents();
    for (const event of events) {
      this._dispatchEffect(event);
    }

    // Latest snapshot: pulse the danger line and reconcile sprites (INV-3).
    const snapshot = this.model.getState();
    const pulse = dangerPulse(snapshot.time, config);
    this.dangerLine.setAlpha(pulse.alpha);
    this.dangerLine.scaleY = pulse.scaleY;

    this._render(snapshot);

    // Game-over transition (render-only, INV-3). Fires exactly once.
    if (snapshot.status === 'gameover' && !this._gameOverHandled) {
      this._gameOverHandled = true;
      this.scene.launch('GameOverScene', { score: snapshot.score });
    }
  }

  // Turn one drained model event into a render-only effect (INV-3: never touches
  // model state).
  //   `explosion` → FR-3 burst: sprite-sheet animation + particles + shockwave
  //     ring (all tinted per outcome), plus the FR-2 lighter HIT shake for a
  //     partial (greater/lesser) collision;
  //   `rowClear`  → the heavier INV-8 row-clear shake (FR-2 heavy tier);
  //   `spawn`     → tag the new row so its bricks fade in when first drawn.
  _dispatchEffect(event) {
    switch (event.type) {
      case 'explosion': {
        const tint = outcomeTint(event.outcome, event.value, config);
        // Particle burst (count already clamped to the budget, R5).
        const count = explosionParticleCount(event.outcome, config);
        this.explosionEmitter.setParticleTint(tint);
        this.explosionEmitter.explode(count, event.x, event.y);
        // Sprite-sheet explosion + expanding shockwave ring.
        this._playExplosionSprite(event.x, event.y, tint);
        this._spawnShockwave(event.x, event.y, tint);
        // FR-2: the lighter hit shake fires on partial collisions only; an exact
        // hit gets the heavier row-clear shake below (from its rowClear event).
        if (event.outcome === 'greater' || event.outcome === 'lesser') {
          const s = screenShake('hit', config);
          this.cameras.main.shake(s.durationMs, s.intensity);
        }
        break;
      }
      case 'rowClear': {
        const s = screenShake('rowClear', config);
        this.cameras.main.shake(s.durationMs, s.intensity);
        break;
      }
      case 'spawn':
        this._fadeRows.add(event.row);
        break;
      default:
        break;
    }
  }

  // FR-3: play the one-shot sprite-sheet explosion at (x,y), tinted per outcome.
  // A fresh sprite per burst, destroyed on animation complete (bursts are short
  // and bounded by the drop cooldown, so overlap is minimal).
  _playExplosionSprite(x, y, tint) {
    const anim = config.effects.explosionAnim;
    const sprite = this.add
      .sprite(x, y, config.assets.explosionSheet.key, 0)
      .setDepth(DEPTH.explosionSprite)
      .setTint(tint)
      .setScale(anim.scale);
    sprite.once('animationcomplete', () => sprite.destroy());
    sprite.play(anim.key);
  }

  // FR-3: an expanding shockwave ring that grows and fades over its lifetime,
  // driven by the pure `shockwaveScale`/`shockwaveAlpha` curves so the visual
  // matches the headless-tested contract.
  _spawnShockwave(x, y, tint) {
    const ring = this.add
      .image(x, y, TEX_SHOCKWAVE)
      .setDepth(DEPTH.shockwave)
      .setTint(tint)
      .setScale(shockwaveScale(0, config))
      .setAlpha(shockwaveAlpha(0, config));
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: config.effects.shockwave.lifespanMs,
      onUpdate: (tween) => {
        const p = tween.getValue();
        ring.setScale(shockwaveScale(p, config));
        ring.setAlpha(shockwaveAlpha(p, config));
      },
      onComplete: () => ring.destroy(),
    });
  }

  // Reconcile the on-screen sprites/labels/previews to a read-only snapshot.
  _render(state) {
    this._renderBricks(state.bricks);
    this._renderBomb(state.bomb);
    this._renderPreviews(state.bombQueue);
    this.scoreText.setText(`SCORE ${state.score}`);
  }

  _renderBricks(bricks) {
    const rowHeight = config.grid.rowHeight;
    const seen = new Set();

    for (const brick of bricks) {
      if (!brick.alive) continue;
      seen.add(brick.id);

      let sprite = this.brickSprites.get(brick.id);
      let label = this.brickLabels.get(brick.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, TEX_BRICK).setDepth(DEPTH.brick);
        this.brickSprites.set(brick.id, sprite);

        // FR-1: the numeric value label, centred on the brick.
        label = this.add
          .text(0, 0, '', this._labelStyle(config.labels.brickSizePx))
          .setOrigin(0.5)
          .setDepth(DEPTH.brickLabel);
        this.brickLabels.set(brick.id, label);

        // Spawn fade-in for a freshly spawned row (sprite + label together).
        if (this._fadeRows.has(brick.row)) {
          sprite.setAlpha(0);
          label.setAlpha(0);
          this.tweens.add({
            targets: [sprite, label],
            alpha: 1,
            duration: config.effects.spawnFadeMs,
          });
        }
      }

      const cx = columnCenterX(brick.col, config);
      const cy = brick.y + rowHeight / 2;
      sprite.setPosition(cx, cy);
      // Tint reflects the CURRENT value (a partial-damage brick shows its
      // reduced-value colour — INV-7).
      sprite.setTint(valueToTint(brick.value, config));
      sprite.setVisible(true);

      // FR-1: keep the label centred and in sync with the current value.
      label.setPosition(cx, cy);
      label.setText(String(brick.value));
      label.setVisible(true);
    }

    // Destroy sprites/labels for bricks no longer alive/present this frame.
    for (const [id, sprite] of this.brickSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.brickSprites.delete(id);
        const label = this.brickLabels.get(id);
        if (label) {
          label.destroy();
          this.brickLabels.delete(id);
        }
      }
    }
  }

  _renderBomb(bomb) {
    if (bomb === null) {
      if (this.bombSprite) this.bombSprite.setVisible(false);
      if (this.bombLabel) this.bombLabel.setVisible(false);
      return;
    }

    if (!this.bombSprite) {
      this.bombSprite = this.add.image(0, 0, TEX_BOMB).setDepth(DEPTH.bomb);
    }
    if (!this.bombLabel) {
      // FR-1: the active bomb's value label.
      this.bombLabel = this.add
        .text(0, 0, '', this._labelStyle(config.labels.bombSizePx))
        .setOrigin(0.5)
        .setDepth(DEPTH.bombLabel);
    }
    this.bombSprite.setPosition(bomb.x, bomb.y);
    this.bombSprite.setTint(valueToTint(bomb.value, config));
    this.bombSprite.setVisible(true);

    this.bombLabel.setPosition(bomb.x, bomb.y);
    this.bombLabel.setText(String(bomb.value));
    this.bombLabel.setVisible(true);
  }

  // FR-7: reconcile the two preview widgets to the model's upcoming-bomb queue
  // [dropsNext, followingBomb]. Leftmost preview = the bomb that drops next.
  _renderPreviews(bombQueue) {
    for (let i = 0; i < this.previewIcons.length; i += 1) {
      const value = bombQueue ? bombQueue[i] : undefined;
      const icon = this.previewIcons[i];
      const label = this.previewLabels[i];
      if (typeof value === 'number') {
        icon.setTint(valueToTint(value, config)).setVisible(true);
        label.setText(String(value)).setVisible(true);
      } else {
        icon.setVisible(false);
        label.setVisible(false);
      }
    }
  }

  // --- FR-8 top bar construction ------------------------------------------

  _createTopBar() {
    const tb = config.topBar;
    const { width } = config.design;

    // Reserved band across the top; a thin accent border along its lower edge.
    this.add
      .rectangle(0, 0, width, tb.height, tb.background, tb.backgroundAlpha)
      .setOrigin(0, 0)
      .setDepth(DEPTH.topBarBg);
    this.add
      .rectangle(0, tb.height, width, 3, tb.borderColor, tb.borderAlpha)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.topBarBg);

    // Score readout — same monospace style as before, repositioned into the bar
    // (left, vertically centred).
    this.scoreText = this.add
      .text(tb.scoreX, tb.height / 2, 'SCORE 0', {
        fontFamily: 'monospace',
        fontSize: `${tb.scoreSizePx}px`,
        color: tb.scoreColor,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.score);

    this._createPreviews();
  }

  // Build the two preview slots, right-aligned in queue order (leftmost = next).
  _createPreviews() {
    const tb = config.topBar;
    const p = tb.preview;
    const totalW = 2 * p.slotSize + p.slotGap;
    const leftStart = config.design.width - p.rightPad - totalW;
    const cy = tb.height / 2;
    const iconSize = p.slotSize * p.iconScale;

    this.previewIcons = [];
    this.previewLabels = [];
    for (let i = 0; i < 2; i += 1) {
      const cx = leftStart + i * (p.slotSize + p.slotGap) + p.slotSize / 2;
      const icon = this.add
        .image(cx, cy, TEX_BOMB)
        .setDisplaySize(iconSize, iconSize)
        .setDepth(DEPTH.previewIcon);
      const label = this.add
        .text(cx, cy, '', this._labelStyle(p.labelSizePx))
        .setOrigin(0.5)
        .setDepth(DEPTH.previewLabel);
      this.previewIcons.push(icon);
      this.previewLabels.push(label);
    }
  }

  // FR-1 label text style from config.labels (bold monospace, dark stroke).
  _labelStyle(sizePx) {
    const l = config.labels;
    return {
      fontFamily: l.fontFamily,
      fontStyle: l.fontStyle,
      fontSize: `${sizePx}px`,
      color: l.color,
      stroke: l.stroke,
      strokeThickness: l.strokeThickness,
    };
  }
}
