// src/scenes/GameOverScene.js
//
// Phase 06 GameOverScene: the render-layer game-over presentation (TDD §4.1,
// PRD Goals 8/9). It fades in a semi-transparent neon overlay, a "GAME OVER"
// title, the final score, and a fake `Play` CTA over the frozen final frame,
// then restarts a fresh session when the CTA is tapped.
//
// PRESENTATION ONLY: it never constructs or mutates a GameModel and reads
// nothing from `src/core/` except `config` and the pure `gameOverLayout` helper
// (INV-3 — no model-state mutation from the render layer). It MAY use the
// `Phaser` browser global; INV-1 (core purity) scopes only `src/core/`.
//
// Restart is by re-construction: on CTA `pointerdown` it stops itself and
// `scene.start('GameScene')`, which re-runs `GameScene.create()` and builds a
// brand-new GameModel — the initial state (INV-6 by construction). The `Play`
// CTA is FAKE: no external navigation, no persistence, no high-score store
// (PRD §3) — its only effect is the fresh restart.

import config from '../core/config.js';
import { gameOverLayout } from '../render/gameOverLayout.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });

    // Final score to display, supplied via scene init data. Initialised here and
    // (re)set in init() so a restart-relaunch always starts from a clean value.
    this.finalScore = 0;
  }

  // Store the final score passed by the launcher (GameScene). Guard against a
  // missing/non-finite value so a malformed launch never renders `NaN`.
  init(data) {
    this.finalScore = data && Number.isFinite(data.score) ? data.score : 0;
  }

  create() {
    const { width, height } = config.design;
    const screen = config.gameOver.screen;
    const layout = gameOverLayout(config);

    // Full-screen semi-transparent overlay behind the game-over UI. Top-left
    // origin so it covers the whole design space over the frozen final frame.
    const overlay = this.add
      .rectangle(0, 0, width, height, screen.overlayColor)
      .setOrigin(0, 0)
      .setAlpha(0);

    // "GAME OVER" title, horizontally centred at layout.title.
    const title = this.add
      .text(layout.title.x, layout.title.y, screen.title.text, {
        fontFamily: 'monospace',
        fontSize: `${screen.title.sizePx}px`,
        color: screen.title.color,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Final-score readout (`${prefix}${finalScore}`), centred below the title.
    const score = this.add
      .text(
        layout.score.x,
        layout.score.y,
        `${screen.score.prefix}${this.finalScore}`,
        {
          fontFamily: 'monospace',
          fontSize: `${screen.score.sizePx}px`,
          color: screen.score.color,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    // Fake `Play` CTA: a filled rectangle drawn with Phaser primitives (no neon
    // texture) plus a centred label, both at the layout's CTA centre.
    const ctaRect = this.add
      .rectangle(
        layout.cta.x,
        layout.cta.y,
        layout.cta.width,
        layout.cta.height,
        screen.cta.fillColor,
      )
      .setOrigin(0.5)
      .setAlpha(0);

    const ctaLabel = this.add
      .text(layout.cta.x, layout.cta.y, screen.cta.label, {
        fontFamily: 'monospace',
        fontSize: `${screen.cta.textSizePx}px`,
        color: screen.cta.textColor,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Fade everything in over `fadeMs` (the game-over fade-in, PRD Goal 8/9).
    // The overlay tweens to its semi-transparent target; text/CTA tween to full.
    this.tweens.add({
      targets: overlay,
      alpha: screen.overlayAlpha,
      duration: screen.fadeMs,
    });
    this.tweens.add({
      targets: [title, score, ctaRect, ctaLabel],
      alpha: 1,
      duration: screen.fadeMs,
    });

    // Make the CTA rectangle interactive. On tap, restart a FRESH session:
    // stop this scene and start GameScene, whose create() re-constructs a new
    // GameModel — the canonical initial state (INV-6 by construction). No
    // persistence and no external navigation (fake CTA, PRD §3).
    ctaRect.setInteractive();
    ctaRect.on('pointerdown', () => {
      this.scene.stop();
      this.scene.start('GameScene');
    });
  }
}
