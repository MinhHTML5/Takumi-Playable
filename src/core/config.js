// src/core/config.js
//
// Single source of truth for every tunable constant in BlockDrop 2 (TDD §4.1).
// This module is intentionally pure data: NO logic, NO game-engine import, NO
// DOM reference (INV-1 core purity). String tokens such as `scale.mode` are
// mapped to their engine-enum equivalents later in `src/main.js`, keeping this
// module runtime-agnostic and headlessly testable.
//
// All spatial values are in abstract "game units" matching the design
// resolution below; the render layer scales them to device pixels via the
// FIT scale mode. First-pass values — final tuning is deferred to Phases 02–03.

export const config = {
  // --- Design resolution & scaling (PRD Q1 / TDD §4.1) ---
  // Portrait 9:16. `mode`/`autoCenter` are string tokens mapped to the
  // engine's FIT / CENTER_BOTH enums inside main.js (preserves INV-1).
  design: {
    width: 720,
    height: 1280,
  },
  scale: {
    mode: 'FIT',
    autoCenter: 'CENTER_BOTH',
  },

  // --- Grid geometry (abstract game units) ---
  // The playfield is `columns` wide; `rowHeight` is the vertical size of a
  // single brick row. columnWidth = design.width / columns = 120 units.
  // `initialRows`: how many brick rows are seeded (bottom-anchored) at the
  // start of a session — the initial stack the player must survive (Phase 03
  // GameModel). The topmost seeded row begins at y = design.height -
  // rowHeight * initialRows and rises toward the top boundary.
  grid: {
    columns: 6,
    rowHeight: 120,
    initialRows: 4,
  },

  // --- Rising motion ---
  // Upward pressure: how fast the stack of brick rows rises toward the top
  // (game units per second). Increased by the difficulty curve over time
  // (riseSpeed = rise.speed + difficultyLevel * difficulty.riseSpeedGrowthPerLevel).
  // Tuned together with grid.initialRows and difficulty.riseSpeedGrowthPerLevel
  // so a fixed-seed, no-input session reaches game-over within ~30-45 s of
  // simulated time (R2) — see test/simulation.integration.test.js.
  rise: {
    speed: 16,
  },

  // --- Game-over boundary ---
  // The stack loses when the topmost alive brick's top edge reaches this y
  // (game units from the top). 0 = the very top of the playfield. Additive
  // tunable consumed by the Phase 03 GameModel game-over check.
  gameOver: {
    topY: 0,
  },

  // --- Brick-row spawning ---
  // Seconds between the introduction of new brick rows at the bottom.
  spawn: {
    interval: 2.5,
  },

  // --- Fixed-timestep frame binding (render layer, CF-04) ---
  // Maximum simulated seconds advanced per `model.tick`. The render layer's
  // variable per-frame delta is split into sub-steps each ≤ this bound (see
  // src/render/loop.js) so a spiky frame cannot advance the bomb more than one
  // row in a single tick. Chosen so bomb.fallSpeed(900) * 0.05 = 45 <
  // grid.rowHeight(120), preserving the accepted point-overlap collision
  // constraint under variable frame deltas.
  loop: {
    maxStepSeconds: 0.05,
  },

  // --- Bomb behaviour ---
  // `fallSpeed`: descent rate of a dropped bomb (game units per second).
  // `cooldown`: minimum seconds between drops — enforces "one bomb per
  // cooldown" (INV-5). ~0.5 s first-pass (PRD Q5).
  bomb: {
    fallSpeed: 900,
    cooldown: 0.5,
    // Bomb-value scaling params: the bomb's numeric value is drawn around a
    // base that drifts upward with difficulty. Clamped to [values.brickMin,
    // values.brickMax] by the (later) difficulty logic.
    value: {
      base: 5,
      variance: 3,
      growthPerLevel: 2,
    },
  },

  // --- Brick value range (INV-7: always within [1,30]) ---
  values: {
    brickMin: 1,
    brickMax: 30,
  },

  // --- Difficulty curve (upward drift over elapsed time) ---
  // `levelInterval`: seconds of play per difficulty level increment.
  // `valueDriftPerLevel`: how much the mean brick value shifts upward per
  // level. `maxLevel` caps the curve so values stay bounded to brickMax.
  difficulty: {
    levelInterval: 8,
    valueDriftPerLevel: 1.5,
    riseSpeedGrowthPerLevel: 2,
    maxLevel: 12,
  },

  // --- Green→red tint endpoints (TDD §4.4 INV-7) ---
  // Only the endpoint constants live here; the monotonic value→colour mapping
  // helper is implemented in the render layer (Phase 04). Integer 0xRRGGBB.
  tint: {
    low: 0x39ff14, // neon green — lowest value
    high: 0xff1744, // neon red — highest value
  },

  // --- Particle budget (performance backpressure, TDD §7) ---
  particles: {
    maxConcurrent: 120,
  },

  // --- Game-feel effects (Phase 05 render-layer juice, additive) ---
  // Pure tunables read by the engine-free `src/render/effects.js` helpers and
  // the render-layer juice wiring. No logic and no forbidden token lives here,
  // so the INV-1 core-purity scan stays green. The particle cap is NOT
  // duplicated: `explosionParticleCount` clamps to `particles.maxConcurrent`
  // above (R5).
  effects: {
    // Top danger-line sine pulse. `dangerPulse(t)` computes u∈[0,1] from
    // frequencyHz and lerps alpha/scaleY between these endpoints.
    dangerPulse: {
      frequencyHz: 1.2,
      minAlpha: 0.55,
      maxAlpha: 1.0,
      minScaleY: 0.85,
      maxScaleY: 1.25,
    },
    // Brick spawn fade-in duration (ms) for newly spawned rows.
    spawnFadeMs: 260,
    // Screen shake on exact-match row clears (camera shake duration/intensity).
    shake: {
      durationMs: 220,
      intensity: 0.012,
    },
    // Explosion particle burst per collision outcome (counts clamped to the
    // particle budget by `explosionParticleCount`) plus emitter tuning.
    explosion: {
      countGreater: 14,
      countLesser: 10,
      countExact: 28,
      lifespanMs: 420,
      speedMin: 120,
      speedMax: 380,
      scaleStart: 0.9,
      scaleEnd: 0,
    },
  },

  // --- Diagnostics ---
  // Gates lightweight console diagnostics in the core/render layers (TDD §
  // "Logs"). Off by default.
  debug: false,
};

export default config;
