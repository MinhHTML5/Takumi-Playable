// src/core/collision.js
//
// Pure resolver for a SINGLE bomb↔brick interaction (TDD §4.1, INV-8).
// Engine-free and self-contained: no rendering/clock reads, no state ownership,
// no row iteration, and no dependency on the RNG, grid, difficulty, or scoring
// modules. It maps one `(bombValue, brickValue)` pair to the state deltas of the
// interaction by pure numeric comparison; the caller (simulation.js) owns state
// and applies the returned deltas.
//
// INV-8 (collision fidelity): a bomb resolves against a brick by comparing
// values —
//   greater (bomb > brick): the brick is destroyed, the bomb survives with its
//     value reduced by the brick's value, and the caller scores the brick value;
//   lesser  (bomb < brick): the brick survives with its value reduced by the
//     bomb's value, the bomb is consumed, and the caller scores the bomb value;
//   exact   (bomb === brick): both are destroyed and the brick's ENTIRE row is
//     cleared (the screen-shake trigger).
//
// Scoring ownership (avoid double-count): for the `exact` outcome `scoreGained`
// is 0 here ON PURPOSE. The whole-row award (hit brick + Σ remaining row values)
// is scored by simulation.js via grid.clearRow's clearedValue, keeping a single
// source of truth for the row-clear award (INV-8:
// `score += hitBrickValue + Σ remaining row values`).

/**
 * Resolve one bomb↔brick interaction by numeric comparison (INV-8).
 *
 * Pure: owns no state and iterates no rows. Returns the deltas the caller
 * applies to its own state.
 *
 * @param {number} bombValue - the falling bomb's current value.
 * @param {number} brickValue - the brick's current value.
 * @returns {{
 *   outcome: 'greater' | 'lesser' | 'exact',
 *   brickDestroyed: boolean,
 *   bombSurvives: boolean,
 *   newBombValue: number,
 *   brickRemainingValue: number,
 *   triggersRowClear: boolean,
 *   scoreGained: number,
 * }} the interaction deltas.
 */
export function resolveCollision(bombValue, brickValue) {
  if (bombValue > brickValue) {
    // greater: brick destroyed, bomb survives with reduced value.
    return {
      outcome: 'greater',
      brickDestroyed: true,
      bombSurvives: true,
      newBombValue: bombValue - brickValue,
      brickRemainingValue: 0,
      triggersRowClear: false,
      scoreGained: brickValue,
    };
  }

  if (bombValue < brickValue) {
    // lesser: brick survives with reduced value, bomb consumed.
    return {
      outcome: 'lesser',
      brickDestroyed: false,
      bombSurvives: false,
      newBombValue: 0,
      brickRemainingValue: brickValue - bombValue,
      triggersRowClear: false,
      scoreGained: bombValue,
    };
  }

  // exact: both destroyed, whole row cleared; scoring owned by simulation.js.
  return {
    outcome: 'exact',
    brickDestroyed: true,
    bombSurvives: false,
    newBombValue: 0,
    brickRemainingValue: 0,
    triggersRowClear: true,
    scoreGained: 0,
  };
}

export default { resolveCollision };
