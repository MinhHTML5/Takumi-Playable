// src/render/gameOverLayout.js
//
// Pure, Phaser/DOM-free game-over screen layout helper (Phase 06, TDD §4.3 /
// PRD Goals 8/9). Engine-free by design: no Phaser, no `window`, no `document`
// — it imports cleanly under plain Node and is unit-tested headlessly, isolating
// the phase's only real layout logic (R3). The Phaser-coupled scene
// (`src/scenes/GameOverScene.js`) consumes these results at render time to place
// the title, final-score readout, and the fake `Play` CTA.
//
// `gameOverLayout(config)` derives screen-space positions/dimensions purely from
// `config.design` (`width`, `height`) and `config.gameOver.screen.cta`
// (`width`, `height`). Deterministic and side-effect-free: the same `config` in
// yields a structurally-identical object out, with no shared mutable state.

// Vertical placement fractions (top→bottom) of the design height. Kept as local
// constants — presentation-only geometry, not a gameplay tunable.
const TITLE_Y_FRAC = 0.34;
const SCORE_Y_FRAC = 0.46;
const CTA_Y_FRAC = 0.64;

/**
 * Compute deterministic game-over screen layout from the tunables module.
 *
 * All elements are horizontally centred at `config.design.width / 2`. The title
 * sits in the upper third, the final-score readout below it, and the CTA
 * rectangle lower still — preserving `title.y < score.y < cta.y`. The CTA uses
 * the configured `config.gameOver.screen.cta` `width`/`height`, with derived
 * edge coordinates (`left/top/right/bottom`) for hit-region/interaction use. The
 * returned CTA rectangle lies fully within `[0, width] × [0, height]`.
 *
 * @param {object} config - the tunables module (needs `design.width`,
 *   `design.height`, and `gameOver.screen.cta.width`/`height`).
 * @returns {{
 *   title: { x: number, y: number },
 *   score: { x: number, y: number },
 *   cta: { x: number, y: number, width: number, height: number,
 *          left: number, top: number, right: number, bottom: number },
 * }} deterministic screen-space layout.
 */
export function gameOverLayout(config) {
  const { width, height } = config.design;
  const ctaCfg = config.gameOver.screen.cta;

  const centreX = width / 2;

  const ctaWidth = ctaCfg.width;
  const ctaHeight = ctaCfg.height;
  const ctaCentreY = height * CTA_Y_FRAC;

  const left = centreX - ctaWidth / 2;
  const right = centreX + ctaWidth / 2;
  const top = ctaCentreY - ctaHeight / 2;
  const bottom = ctaCentreY + ctaHeight / 2;

  return {
    title: { x: centreX, y: height * TITLE_Y_FRAC },
    score: { x: centreX, y: height * SCORE_Y_FRAC },
    cta: {
      x: centreX,
      y: ctaCentreY,
      width: ctaWidth,
      height: ctaHeight,
      left,
      top,
      right,
      bottom,
    },
  };
}

export default { gameOverLayout };
