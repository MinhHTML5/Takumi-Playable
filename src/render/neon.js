// src/render/neon.js
//
// Procedural neon texture factory (TDD §4.1 "Neon Art Factory", phase-04 T5).
//
// Uses Phaser Graphics -> generateTexture to bake a small set of reusable
// textures ONCE at boot and register them in the scene's texture manager
// (TDD §7: generate-once / reuse — no per-frame Graphics redraws). Consumers
// (GameScene) then create lightweight sprites from these texture keys.
//
// INDEPENDENCE / NEUTRALITY CONTRACT:
//   The brick and bomb textures are emitted as NEUTRAL WHITE bodies with a
//   white neon border/glow. They are designed to be recoloured per-instance by
//   the render layer via `sprite.setTint(...)` at draw time. This module does
//   NOT import or apply the value->tint mapping (`valueToTint`); tinting is the
//   scene's job. Keeping the base art neutral is what lets NEON-ART build in
//   parallel with the tint/loop helpers (RENDER-CORE).
//
// This is a render-layer module: it MAY use the `Phaser` browser global. INV-1
// (core purity) constrains only `src/core/`, not `src/render/`. Geometry and
// colour endpoints are read from the Phaser-free `config` module, read-only.

import config from '../core/config.js';

// --- Registered texture keys (named constants; the stable public contract) ---
export const TEX_BACKGROUND = 'neon-background';
export const TEX_BRICK = 'neon-brick';
export const TEX_BOMB = 'neon-bomb';
export const TEX_DANGER_LINE = 'neon-danger-line';
export const TEX_PARTICLE = 'neon-particle';

// Convenience bundle for consumers that want the whole set.
export const TEXTURE_KEYS = {
  background: TEX_BACKGROUND,
  brick: TEX_BRICK,
  bomb: TEX_BOMB,
  dangerLine: TEX_DANGER_LINE,
  particle: TEX_PARTICLE,
};

// Neutral white — the base colour for tintable art. `setTint(colour)`
// multiplies against white, so a white body reproduces the tint colour exactly.
const WHITE = 0xffffff;

// -----------------------------------------------------------------------------
// Low-level helpers
// -----------------------------------------------------------------------------

// Create an off-display Graphics object. `add: false` keeps it out of the
// scene's display list — we only need it as a scratch surface for
// generateTexture, then it is destroyed.
function scratchGraphics(scene) {
  return scene.make.graphics({ add: false });
}

// Draw a soft "neon glow" as a stack of concentric rounded-rect strokes that
// grow outward while fading to transparent — a cheap approximation of a blur
// without a shader. Strokes are white so the whole sprite tints as one.
function strokeGlowRect(g, x, y, w, h, radius, colour, layers) {
  for (let i = layers; i >= 1; i--) {
    const spread = i * 2;
    const alpha = 0.14 * (1 - (i - 1) / layers);
    g.lineStyle(spread * 2, colour, alpha);
    g.strokeRoundedRect(
      x - spread,
      y - spread,
      w + spread * 2,
      h + spread * 2,
      radius + spread,
    );
  }
}

// -----------------------------------------------------------------------------
// Individual texture generators. Each is idempotent: if the key already exists
// in the texture manager it returns early (generate-once, TDD §7).
// -----------------------------------------------------------------------------

// (a) Full-screen background: a vertical gradient (deep indigo -> near-black)
// with a soft neon glow bloom near the top-centre. This texture is static and
// NOT per-instance tinted, so it may use the config colour endpoints directly
// for its accent bloom.
function generateBackground(scene) {
  if (scene.textures.exists(TEX_BACKGROUND)) return;

  const { width, height } = config.design;
  const g = scratchGraphics(scene);

  // Vertical gradient drawn as horizontal bands.
  const top = { r: 0x0a, g: 0x0f, b: 0x30 }; // deep neon indigo
  const bottom = { r: 0x02, g: 0x02, b: 0x08 }; // near-black
  const bands = 96;
  const bandHeight = Math.ceil(height / bands);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = Math.round(top.r + (bottom.r - top.r) * t);
    const gg = Math.round(top.g + (bottom.g - top.g) * t);
    const b = Math.round(top.b + (bottom.b - top.b) * t);
    g.fillStyle((r << 16) | (gg << 8) | b, 1);
    g.fillRect(0, i * bandHeight, width, bandHeight);
  }

  // Neon bloom near the top-centre — concentric translucent circles using the
  // low (green) tint endpoint as an on-brand accent glow.
  const glowColour = config.tint.low;
  const cx = width / 2;
  const cy = height * 0.28;
  const maxR = width * 0.7;
  const rings = 24;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const radius = maxR * t;
    const alpha = 0.05 * (1 - t);
    g.fillStyle(glowColour, alpha);
    g.fillCircle(cx, cy, radius);
  }

  g.generateTexture(TEX_BACKGROUND, width, height);
  g.destroy();
}

// (b) Neutral white brick body with a neon border + outer glow, sized to one
// grid cell (columnWidth x rowHeight). Emitted white so the scene can
// `setTint(valueToTint(value))` per brick. A small inset margin gives each
// brick visual separation on the grid.
function generateBrick(scene) {
  if (scene.textures.exists(TEX_BRICK)) return;

  const columnWidth = config.design.width / config.grid.columns;
  const cellW = columnWidth;
  const cellH = config.grid.rowHeight;
  const margin = 7;
  const x = margin;
  const y = margin;
  const w = cellW - margin * 2;
  const h = cellH - margin * 2;
  const radius = 14;

  const g = scratchGraphics(scene);

  // Outer glow (white so it tints with the body).
  strokeGlowRect(g, x, y, w, h, radius, WHITE, 5);

  // Body fill — translucent white so the neon border reads as brighter than
  // the interior once tinted.
  g.fillStyle(WHITE, 0.82);
  g.fillRoundedRect(x, y, w, h, radius);

  // Bright crisp border.
  g.lineStyle(4, WHITE, 1);
  g.strokeRoundedRect(x, y, w, h, radius);

  g.generateTexture(TEX_BRICK, cellW, cellH);
  g.destroy();
}

// (c) Neutral white bomb: a glowing disc with a bright ring. Emitted white for
// per-instance tinting by value.
function generateBomb(scene) {
  if (scene.textures.exists(TEX_BOMB)) return;

  const columnWidth = config.design.width / config.grid.columns;
  const size = Math.round(columnWidth * 0.82);
  const c = size / 2;
  const coreR = size * 0.32;

  const g = scratchGraphics(scene);

  // Outer glow: concentric fading discs.
  const rings = 10;
  const maxR = size * 0.48;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const alpha = 0.13 * (1 - t);
    g.fillStyle(WHITE, alpha);
    g.fillCircle(c, c, maxR * t);
  }

  // Solid core disc.
  g.fillStyle(WHITE, 0.92);
  g.fillCircle(c, c, coreR);

  // Bright ring.
  g.lineStyle(4, WHITE, 1);
  g.strokeCircle(c, c, coreR + 6);

  g.generateTexture(TEX_BOMB, size, size);
  g.destroy();
}

// (d) Danger-line: a full-width horizontal neon bar with vertical glow
// falloff. Emitted neutral white so the scene owns its colour (typically the
// high/red tint endpoint) via setTint.
function generateDangerLine(scene) {
  if (scene.textures.exists(TEX_DANGER_LINE)) return;

  const width = config.design.width;
  const height = 18;
  const midY = height / 2;

  const g = scratchGraphics(scene);

  // Vertical glow falloff: wide faint bands narrowing to a bright core line.
  const bands = 6;
  for (let i = bands; i >= 1; i--) {
    const t = i / bands;
    const halfThickness = midY * t;
    const alpha = 0.12 * (1 - t);
    g.fillStyle(WHITE, alpha);
    g.fillRect(0, midY - halfThickness, width, halfThickness * 2);
  }

  // Bright core line.
  g.fillStyle(WHITE, 1);
  g.fillRect(0, midY - 2, width, 4);

  g.generateTexture(TEX_DANGER_LINE, width, height);
  g.destroy();
}

// (e) Neutral white particle/spark: a small soft glowing disc with a bright
// core, drawn white so the scene tints each emitted particle per-instance
// (by outcome/value) at explode time. Kept small (~20px) and reusable — one
// generated-once texture feeds a single shared emitter (TDD §7 reuse, R5).
function generateParticle(scene) {
  if (scene.textures.exists(TEX_PARTICLE)) return;

  const size = 20;
  const c = size / 2;

  const g = scratchGraphics(scene);

  // Outer glow: concentric fading discs growing to the edge.
  const rings = 8;
  const maxR = size * 0.5;
  for (let i = rings; i >= 1; i--) {
    const t = i / rings;
    const alpha = 0.16 * (1 - t);
    g.fillStyle(WHITE, alpha);
    g.fillCircle(c, c, maxR * t);
  }

  // Bright solid core spark.
  g.fillStyle(WHITE, 1);
  g.fillCircle(c, c, size * 0.18);

  g.generateTexture(TEX_PARTICLE, size, size);
  g.destroy();
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

/**
 * Procedurally generate and register every neon texture in the scene's texture
 * manager. Idempotent and generate-once: each texture is only baked if its key
 * is not already registered, so calling this again (e.g. on a scene restart) is
 * a cheap no-op that reuses the cached textures (TDD §7).
 *
 * @param {Phaser.Scene} scene - the scene whose texture manager receives the
 *   generated textures (typically BootScene).
 * @returns {typeof TEXTURE_KEYS} the registered texture-key bundle.
 */
export function generateTextures(scene) {
  generateBackground(scene);
  generateBrick(scene);
  generateBomb(scene);
  generateDangerLine(scene);
  generateParticle(scene);
  return TEXTURE_KEYS;
}

export default generateTextures;
