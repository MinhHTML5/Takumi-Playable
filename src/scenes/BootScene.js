// src/scenes/BootScene.js
//
// Minimal boot scene. Phase 01 does no heavy asset work (the procedural
// neon-art factory is Phase 04 scope), so Boot immediately hands off to
// GameScene. It exists now as the stable first-scene seam that later phases
// will hang preloads and warm-up on.

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // No assets to load this phase — go straight to the play scene.
    this.scene.start('GameScene');
  }
}
