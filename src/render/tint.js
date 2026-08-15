// src/render/tint.js
//
// Pure value→colour mapping for the neon green→red brick/bomb tint (TDD §4.1
// neon tint helper / §4.4 INV-7). Engine-free: no Phaser, no DOM. It maps a
// numeric brick/bomb value to an integer 0xRRGGBB by clamping the value to the
// configured brick range and linearly interpolating each RGB channel between
// the two endpoint colours (`config.tint.low` at the minimum, `config.tint.high`
// at the maximum). The render layer (Phase 04 GameScene) feeds the result to a
// sprite's `setTint`, so a partial-damage brick shows its reduced-value colour.
//
// INV-7 (value & tint bounds): values are always within [brickMin, brickMax] and
// the mapping is monotonic green→red — as the value rises the red channel is
// non-decreasing and the green channel is non-increasing. Because the endpoints
// are the exact configured colours, `valueToTint(brickMin) === config.tint.low`
// and `valueToTint(brickMax) === config.tint.high`.

// Split a packed 0xRRGGBB integer into its three 8-bit channels.
function channels(color) {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff,
  };
}

/**
 * Map a numeric value to its neon tint colour (INV-7).
 *
 * Clamps `value` to `[config.values.brickMin, config.values.brickMax]`, then
 * linearly interpolates each RGB channel from `config.tint.low` (at the minimum)
 * to `config.tint.high` (at the maximum), returning an integer `0xRRGGBB`.
 *
 * Pure: reads only its arguments, owns no state, and never touches Phaser/DOM.
 *
 * @param {number} value - the brick/bomb value to colour.
 * @param {object} config - the tunables module (needs `values` and `tint`).
 * @returns {number} an integer 0xRRGGBB colour.
 */
export function valueToTint(value, config) {
  const min = config.values.brickMin;
  const max = config.values.brickMax;

  // Clamp into range (INV-7) so out-of-range inputs map to the endpoints.
  const clamped = value < min ? min : value > max ? max : value;

  // Normalised position in [0,1]; guard the degenerate min === max range.
  const span = max - min;
  const t = span === 0 ? 0 : (clamped - min) / span;

  const low = channels(config.tint.low);
  const high = channels(config.tint.high);

  // Round each interpolated channel: at t=0 this reproduces `low` exactly and
  // at t=1 it reproduces `high` exactly, so the endpoints match the config.
  const r = Math.round(low.r + t * (high.r - low.r));
  const g = Math.round(low.g + t * (high.g - low.g));
  const b = Math.round(low.b + t * (high.b - low.b));

  return (r << 16) | (g << 8) | b;
}

export default { valueToTint };
