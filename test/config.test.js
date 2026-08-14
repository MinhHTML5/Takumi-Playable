// test/config.test.js
//
// Unit smoke test + INV-1 core-purity assertion for the tunables module.
// Run via `npm test` (equivalently `node --test`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import config, { config as namedConfig } from '../src/core/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_DIR = join(HERE, '..', 'src', 'core');

// Forbidden references in src/core/ per INV-1 (case-insensitive substring).
const FORBIDDEN = ['phaser', 'document', 'window'];

// Recursively collect every *.js file under a directory.
function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

test('config module loads and exposes a config object', () => {
  assert.ok(config, 'default export must be defined');
  assert.equal(typeof config, 'object', 'config must be an object');
  assert.equal(namedConfig, config, 'named and default exports must be the same object');
});

test('config exposes required design/scale tunables with correct values', () => {
  assert.equal(config.design.width, 720, 'design.width must be 720');
  assert.equal(config.design.height, 1280, 'design.height must be 1280');

  assert.equal(typeof config.scale.mode, 'string', 'scale.mode must be a string token');
  assert.equal(typeof config.scale.autoCenter, 'string', 'scale.autoCenter must be a string token');
});

test('config exposes required grid/motion/spawn tunables with sane bounds', () => {
  assert.ok(Number.isInteger(config.grid.columns) && config.grid.columns > 0,
    'grid.columns must be a positive integer');
  assert.ok(config.grid.rowHeight > 0, 'grid.rowHeight must be positive');

  assert.ok(config.rise.speed > 0, 'rise.speed must be > 0');
  assert.ok(config.spawn.interval > 0, 'spawn.interval must be > 0');
});

test('config exposes required bomb tunables with sane bounds', () => {
  assert.ok(config.bomb.fallSpeed > 0, 'bomb.fallSpeed must be > 0');
  assert.ok(config.bomb.cooldown > 0, 'bomb.cooldown must be > 0');
  // First-pass cooldown target is ~0.5s (PRD Q5); assert it is in a sane range.
  assert.ok(config.bomb.cooldown <= 5, 'bomb.cooldown must be a small number of seconds');
  assert.equal(typeof config.bomb.value, 'object', 'bomb.value scaling params must exist');
  assert.ok(config.bomb.value.base > 0, 'bomb.value.base must be > 0');
});

test('config exposes brick value range [1,30] (INV-7)', () => {
  assert.equal(config.values.brickMin, 1, 'values.brickMin must be 1');
  assert.equal(config.values.brickMax, 30, 'values.brickMax must be 30');
  assert.ok(config.values.brickMin < config.values.brickMax,
    'brickMin must be less than brickMax');
});

test('config exposes difficulty-curve params', () => {
  assert.equal(typeof config.difficulty, 'object', 'difficulty params must exist');
  assert.ok(config.difficulty.levelInterval > 0, 'difficulty.levelInterval must be > 0');
});

test('config exposes green→red tint endpoints', () => {
  assert.notEqual(config.tint.low, undefined, 'tint.low must be defined');
  assert.notEqual(config.tint.high, undefined, 'tint.high must be defined');
  assert.equal(typeof config.tint.low, 'number', 'tint.low must be an integer colour');
  assert.equal(typeof config.tint.high, 'number', 'tint.high must be an integer colour');
  assert.notEqual(config.tint.low, config.tint.high, 'tint endpoints must differ');
});

test('config exposes particle cap and debug flag', () => {
  assert.ok(config.particles.maxConcurrent > 0, 'particles.maxConcurrent must be > 0');
  assert.equal(config.debug, false, 'debug must default to false');
});

test('INV-1: no src/core/ module references phaser, document, or window', () => {
  const files = collectJsFiles(CORE_DIR);
  assert.ok(files.length > 0, 'expected at least one *.js file under src/core/');

  const violations = [];
  for (const file of files) {
    const contents = readFileSync(file, 'utf8').toLowerCase();
    for (const token of FORBIDDEN) {
      if (contents.includes(token)) {
        violations.push(`${file} contains forbidden token "${token}"`);
      }
    }
  }

  assert.deepEqual(violations, [], `INV-1 core-purity violation(s):\n${violations.join('\n')}`);
});
