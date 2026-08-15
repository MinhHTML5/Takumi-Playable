// src/scenes/BootScene.js
//
// Boot scene. Its job is warm-up: LOAD the build-time explosion sprite sheet
// (BlockDrop-2 FR-3), procedurally bake the neon textures ONCE (background,
// brick, bomb, danger line, particle, shockwave) into the texture manager,
// register the explosion animation once (global AnimationManager), then hand off
// to GameScene. Baking here — before any gameplay scene exists — lets GameScene
// create sprites from cached texture keys instead of redrawing Graphics per
// frame (TDD §7 generate-once / reuse).

import config from '../core/config.js';
import { generateTextures } from '../render/neon.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // FR-3: load the committed monochrome explosion sheet as a Phaser sprite
    // sheet so the collision effect can play it, tinted per outcome at runtime.
    const sheet = config.assets.explosionSheet;
    this.load.spritesheet(sheet.key, sheet.path, {
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
    });
  }

  create() {
    // Generate and register all neon textures before the play scene starts, so
    // GameScene can assume they already exist in the texture manager.
    generateTextures(this);

    // FR-3: register the explosion animation once. Animations live on the global
    // AnimationManager (this.anims), so a single registration is shared by every
    // GameScene session (idempotent guard for scene restarts).
    const anim = config.effects.explosionAnim;
    const sheet = config.assets.explosionSheet;
    if (!this.anims.exists(anim.key)) {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNumbers(sheet.key, {
          start: 0,
          end: sheet.frameCount - 1,
        }),
        frameRate: anim.frameRate,
        repeat: 0,
      });
    }

    this.scene.start('GameScene');
  }
}
