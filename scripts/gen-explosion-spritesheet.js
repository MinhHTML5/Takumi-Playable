// scripts/gen-explosion-spritesheet.js
//
// Build-time generator for the BlockDrop-2 explosion sprite sheet (FR-3). Bakes
// a MONOCHROME (white-on-transparent) radial-burst animation into a single
// horizontal sprite sheet PNG, committed to `assets/explosion.png` and loaded by
// the render layer as a Phaser sprite sheet, then TINTED per collision outcome
// at runtime (INV-7 value tint for greater/lesser, red for exact).
//
// No runtime asset synthesis and NO third-party image dependency: the PNG is
// hand-encoded with Node's built-in `zlib` (RGBA, 8-bit, filter 0) so the sheet
// is a plain committed binary. Regeneration is fully DETERMINISTIC (no RNG, no
// clock), so re-running the script reproduces byte-identical output.
//
// Frames are laid out left→right; sheet width = frameSize * frameCount,
// height = frameSize. Each frame is one step of an expanding, fading fireball:
// a bright core that blooms then decays, a shell that expands outward, and eight
// angular spark spokes for texture. RGB is always white; the ALPHA channel
// carries the shape, so `setTint` reproduces any outcome colour exactly.
//
// Usage:
//   node scripts/gen-explosion-spritesheet.js            # writes assets/explosion.png
//   node scripts/gen-explosion-spritesheet.js out.png    # writes a custom path
//
// The pure builder `buildExplosionSheet(opts)` returns the PNG bytes as a Buffer
// and is unit-tested headlessly (test/assets.test.js).

import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --- CRC-32 (PNG chunk checksum) -------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Assemble one PNG chunk: length(4) + type(4) + data + crc(4).
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Encode a raw RGBA pixel buffer (width*height*4 bytes) as a PNG Buffer.
function encodePng(rgba, width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Prefix each scanline with filter byte 0 (none), then deflate (zlib format).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Smooth 0→1 gaussian-ish falloff.
function gauss(x, sigma) {
  return Math.exp(-(x * x) / (2 * sigma * sigma));
}

/**
 * Per-frame, per-pixel alpha intensity (0..1) of the fireball. Deterministic.
 *
 * @param {number} nx - x offset from centre, normalized to [-1,1] (edge = ±1).
 * @param {number} ny - y offset from centre, normalized to [-1,1].
 * @param {number} t  - frame progress in [0,1] (0 = first frame).
 * @returns {number} intensity in [0,1].
 */
function fireballAlpha(nx, ny, t) {
  const d = Math.sqrt(nx * nx + ny * ny); // 0 at centre, ~1 at edge
  // Expanding shell radius sweeps outward across the animation.
  const shellR = 0.15 + t * 0.8;
  const shell = gauss(d - shellR, 0.14);
  // Bright core blooms early then decays.
  const core = (1 - t) * gauss(d, 0.16);
  // Eight spark spokes give the shell some texture (deterministic, no RNG).
  const theta = Math.atan2(ny, nx);
  const spokes = 0.6 + 0.4 * Math.pow(Math.abs(Math.cos(4 * theta)), 3);
  // Overall amplitude fades out so the last frames are faint (animation ends).
  const amp = Math.pow(1 - t, 0.5);
  const a = (shell * spokes * 0.9 + core) * amp;
  return a < 0 ? 0 : a > 1 ? 1 : a;
}

/**
 * Build the explosion sprite sheet as PNG bytes (pure, deterministic).
 *
 * @param {{ frameCount?: number, frameSize?: number }} [opts]
 * @returns {Buffer} the encoded PNG.
 */
export function buildExplosionSheet(opts = {}) {
  const frameCount = opts.frameCount ?? 10;
  const frameSize = opts.frameSize ?? 64;
  const width = frameSize * frameCount;
  const height = frameSize;
  const rgba = Buffer.alloc(width * height * 4); // zero-filled = transparent

  const half = frameSize / 2;
  for (let f = 0; f < frameCount; f++) {
    const t = frameCount === 1 ? 0 : f / (frameCount - 1);
    const originX = f * frameSize;
    for (let py = 0; py < frameSize; py++) {
      const ny = (py - half + 0.5) / half;
      for (let px = 0; px < frameSize; px++) {
        const nx = (px - half + 0.5) / half;
        const a = fireballAlpha(nx, ny, t);
        const alpha = Math.round(a * 255);
        if (alpha === 0) continue;
        const idx = ((py * width) + (originX + px)) * 4;
        rgba[idx] = 255; // R — white body, tinted at runtime
        rgba[idx + 1] = 255; // G
        rgba[idx + 2] = 255; // B
        rgba[idx + 3] = alpha; // A — carries the shape
      }
    }
  }
  return encodePng(rgba, width, height);
}

export default { buildExplosionSheet };

// --- CLI: write the sheet to assets/ ---------------------------------------
// Run directly (not when imported by the test). Resolves the repo-root `assets/`
// dir relative to this file so it works regardless of cwd.
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..');
  const outArg = process.argv[2];
  const outPath = outArg
    ? (outArg.startsWith('/') ? outArg : join(process.cwd(), outArg))
    : join(repoRoot, 'assets', 'explosion.png');
  mkdirSync(dirname(outPath), { recursive: true });
  const png = buildExplosionSheet();
  writeFileSync(outPath, png);
  // eslint-disable-next-line no-console
  console.log(
    `[gen-explosion-spritesheet] wrote ${png.length} bytes -> ${outPath} ` +
      `(10 frames x 64px, sheet 640x64)`,
  );
}
