// src/main.js
//
// Browser entry point for BlockDrop 2. Builds the Phaser Game configuration
// from the Phaser-free tunables in `config.js` and starts the game.
//
// The design resolution and scale tokens come from config as engine-agnostic
// strings (INV-1: config imports no Phaser). This module is the boundary where
// those tokens are mapped to Phaser's enums — keeping config runtime-agnostic
// and headlessly testable.
//
// `Phaser` is provided as a browser global by the vendored runtime loaded in
// index.html before this module. It is intentionally not imported here.

import config from './core/config.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

// Map config's string scale tokens onto Phaser's Scale enum. Falling back to
// FIT / CENTER_BOTH keeps the shell booting even if a token is unrecognised.
const SCALE_MODE = {
  FIT: Phaser.Scale.FIT,
  RESIZE: Phaser.Scale.RESIZE,
  NONE: Phaser.Scale.NONE,
};
const AUTO_CENTER = {
  CENTER_BOTH: Phaser.Scale.CENTER_BOTH,
  CENTER_HORIZONTALLY: Phaser.Scale.CENTER_HORIZONTALLY,
  CENTER_VERTICALLY: Phaser.Scale.CENTER_VERTICALLY,
  NO_CENTER: Phaser.Scale.NO_CENTER,
};

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: config.design.width,
  height: config.design.height,
  backgroundColor: '#000000',
  scale: {
    mode: SCALE_MODE[config.scale.mode] ?? Phaser.Scale.FIT,
    autoCenter: AUTO_CENTER[config.scale.autoCenter] ?? Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
};

// Start the game.
const game = new Phaser.Game(gameConfig);

export default game;
