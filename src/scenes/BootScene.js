// src/scenes/BootScene.js
//
// Boot scene. Its one job is warm-up: procedurally bake the neon textures ONCE
// (background, brick, bomb, danger line) into the texture manager, then hand
// off to GameScene. Baking here — before any gameplay scene exists — is what
// lets GameScene create sprites from cached texture keys instead of redrawing
// Graphics per frame (TDD §7 generate-once / reuse).

import { generateTextures } from '../render/neon.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Generate and register all neon textures before the play scene starts, so
    // GameScene can assume they already exist in the texture manager.
    generateTextures(this);

    this.scene.start('GameScene');
  }
}
