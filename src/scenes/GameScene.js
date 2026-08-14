// src/scenes/GameScene.js
//
// Phase 01 GameScene: renders a PLAIN neon background and nothing else.
// No simulation, input, or juice — those arrive in later phases. The
// background is drawn procedurally with Phaser Graphics (a vertical gradient
// between two dark neon-tinted endpoints) so the shell has a visible, on-brand
// surface to boot into without any texture assets.

import config from '../core/config.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = config.design;

    // Procedural vertical gradient: deep indigo at the top fading to near-black
    // at the bottom, drawn as horizontal bands via Graphics. This is a plain
    // backdrop only — the real neon-art factory is Phase 04 scope.
    const top = { r: 0x0a, g: 0x0a, b: 0x2a }; // deep neon indigo
    const bottom = { r: 0x02, g: 0x02, b: 0x08 }; // near-black
    const bands = 64;
    const bandHeight = Math.ceil(height / bands);

    const bg = this.add.graphics();
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(top.r + (bottom.r - top.r) * t);
      const g = Math.round(top.g + (bottom.g - top.g) * t);
      const b = Math.round(top.b + (bottom.b - top.b) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.fillStyle(color, 1);
      bg.fillRect(0, i * bandHeight, width, bandHeight);
    }

    // Camera clear colour underneath, so any sub-pixel seams read as backdrop.
    this.cameras.main.setBackgroundColor(0x020208);
  }
}
