// src/core/rng.js
//
// Seedable, deterministic pseudo-random number generator — the single source of
// randomness for the BlockDrop 2 simulation core (TDD §4.1, INV-2 / R4).
//
// Determinism contract: two instances built from the same seed yield identical
// `next()` / `nextInt()` sequences. State is per-instance only; there is no
// module-level mutable state shared across instances. The core reads no
// wall-clock and calls no engine randomness — every draw flows through here so
// gameplay is fully reproducible from a seed.
//
// Implementation: mulberry32, a compact high-quality 32-bit PRNG. The seed is
// coerced to a uint32 so any finite number maps to a well-defined stream.

// Advance a uint32 state one mulberry32 step, returning a float in [0, 1).
// `Math.imul` performs 32-bit integer multiplication; no engine randomness or
// clock is read here.
function step(state) {
  let a = state | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: a, value };
}

// Coerce an arbitrary seed to a uint32; non-finite seeds fall back to 0.
function toUint32(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n)) return 0;
  return n >>> 0;
}

/**
 * Create a deterministic RNG instance.
 *
 * @param {number} seed - any finite number; coerced to a uint32 seed.
 * @returns {{ next: () => number, nextInt: (minInclusive: number, maxInclusive: number) => number }}
 */
export function createRng(seed) {
  // Per-instance state — closed over, never shared between instances.
  let state = toUint32(seed);

  // Float in [0, 1).
  function next() {
    const result = step(state);
    state = result.state;
    return result.value;
  }

  // Integer in [minInclusive, maxInclusive], inclusive on both ends.
  // Assumes minInclusive <= maxInclusive (per the T1 contract).
  function nextInt(minInclusive, maxInclusive) {
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(next() * span);
  }

  return { next, nextInt };
}

export default createRng;
