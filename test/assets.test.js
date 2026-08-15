// test/assets.test.js
//
// Validates the FR-3 explosion sprite-sheet asset pipeline headlessly:
//   - the pure `buildExplosionSheet` generator produces a well-formed PNG
//     (signature + IHDR: 8-bit RGBA, width = frameSize * frameCount, height =
//     frameSize) and is DETERMINISTIC (byte-identical on re-run);
//   - the animation actually animates: decoded per-frame max-alpha starts bright
//     and fades over the sheet (a bloom-then-decay fireball);
//   - the committed `assets/explosion.png` matches `config.assets.explosionSheet`
//     (key/path/frame geometry) and is byte-identical to a fresh generation, so
//     the checked-in binary is exactly what the script produces (no drift).
//
// Run via `npm test` (equivalently `node --test`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildExplosionSheet } from '../scripts/gen-explosion-spritesheet.js';
import config from '../src/core/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Minimal PNG reader: assert the signature/IHDR and return the raw (un-filtered)
// RGBA pixel rows so a test can inspect actual pixel alpha.
function decodePng(buf) {
  assert.ok(buf.slice(0, 8).equals(PNG_SIGNATURE), 'valid PNG signature');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];

  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.slice(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  return { width, height, bitDepth, colorType, raw, stride };
}

// Alpha of pixel (x,y) in a decoded sheet (accounts for the per-row filter byte).
function alphaAt(dec, x, y) {
  const idx = y * (dec.stride + 1) + 1 + x * 4;
  return dec.raw[idx + 3];
}

test('buildExplosionSheet produces a well-formed 8-bit RGBA PNG of the right size', () => {
  const frameCount = 10;
  const frameSize = 64;
  const png = buildExplosionSheet({ frameCount, frameSize });
  const dec = decodePng(png);
  assert.equal(dec.width, frameSize * frameCount, 'width = frameSize * frameCount');
  assert.equal(dec.height, frameSize, 'height = frameSize');
  assert.equal(dec.bitDepth, 8, '8-bit channels');
  assert.equal(dec.colorType, 6, 'colour type 6 (RGBA)');
});

test('buildExplosionSheet is deterministic (byte-identical on re-run)', () => {
  const a = buildExplosionSheet();
  const b = buildExplosionSheet();
  assert.ok(a.equals(b), 're-running the generator yields identical bytes');
});

test('the sheet is monochrome white with alpha carrying the shape (tintable at runtime)', () => {
  const dec = decodePng(buildExplosionSheet({ frameCount: 10, frameSize: 64 }));
  // Sample the bright first frame's centre: opaque-ish white body.
  const cx = 32;
  const cy = 32;
  const idx = cy * (dec.stride + 1) + 1 + cx * 4;
  assert.ok(dec.raw[idx + 3] > 0, 'first-frame centre has non-zero alpha');
  // Every non-transparent pixel is pure white (so setTint reproduces any colour).
  for (let y = 0; y < dec.height; y += 7) {
    for (let x = 0; x < dec.width; x += 7) {
      const p = y * (dec.stride + 1) + 1 + x * 4;
      if (dec.raw[p + 3] === 0) continue;
      assert.equal(dec.raw[p], 255, `R white at ${x},${y}`);
      assert.equal(dec.raw[p + 1], 255, `G white at ${x},${y}`);
      assert.equal(dec.raw[p + 2], 255, `B white at ${x},${y}`);
    }
  }
});

test('the animation blooms then fades across frames (per-frame max alpha decays)', () => {
  const frameCount = 10;
  const frameSize = 64;
  const dec = decodePng(buildExplosionSheet({ frameCount, frameSize }));
  const maxPerFrame = [];
  for (let f = 0; f < frameCount; f++) {
    let max = 0;
    for (let y = 0; y < frameSize; y++) {
      for (let x = 0; x < frameSize; x++) {
        const a = alphaAt(dec, f * frameSize + x, y);
        if (a > max) max = a;
      }
    }
    maxPerFrame.push(max);
  }
  // Early frames are bright; the sheet fades toward the end.
  assert.ok(maxPerFrame[0] > 200, `first frame bright (was ${maxPerFrame[0]})`);
  assert.ok(
    maxPerFrame[frameCount - 1] < maxPerFrame[0],
    'the last frame is fainter than the first (animation fades out)',
  );
});

test('committed assets/explosion.png matches config and the generator (no drift)', () => {
  const sheet = config.assets.explosionSheet;
  assert.equal(sheet.frameCount, 10, 'config frameCount');
  assert.equal(sheet.frameWidth, 64, 'config frameWidth');
  assert.equal(sheet.frameHeight, 64, 'config frameHeight');

  const committed = readFileSync(join(REPO_ROOT, sheet.path));
  const dec = decodePng(committed);
  assert.equal(dec.width, sheet.frameWidth * sheet.frameCount, 'committed sheet width matches config');
  assert.equal(dec.height, sheet.frameHeight, 'committed sheet height matches config');

  const fresh = buildExplosionSheet({
    frameCount: sheet.frameCount,
    frameSize: sheet.frameWidth,
  });
  assert.ok(
    committed.equals(fresh),
    'committed PNG is byte-identical to a fresh generation (regenerate with `npm run gen:assets`)',
  );
});
