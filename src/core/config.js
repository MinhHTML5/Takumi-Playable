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

// Reserved top-bar band height (game units), 120–140 per BlockDrop-2 FR-8. The
// gameplay top edge and the danger line / game-over boundary both sit at this y,
// so it is defined once here and referenced by `topBar.height` and
// `gameOver.topY` below (pure data — no logic, no engine/DOM token).
const TOP_BAR_HEIGHT = 130;

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
  // (game units from the top). BlockDrop-2 FR-8 shrinks the playfield by the
  // reserved top bar: the effective top edge for gameplay — and the danger line —
  // is `y = topBar.height`, so game-over triggers when the stack reaches the
  // bottom of the top bar rather than the very top of the canvas. Additive
  // tunable consumed by the GameModel game-over check (INV preserved: still a
  // pure y-threshold, just relocated).
  gameOver: {
    topY: TOP_BAR_HEIGHT,
    // --- Game-over screen presentation (Phase 06 render-layer, additive) ---
    // Pure tunables consumed by the engine-free `src/render/gameOverLayout.js`
    // helper and the render-layer game-over scene. No logic and no forbidden
    // token lives here, so the INV-1 core-purity scan and every
    // `test/config.test.js` assertion stay green. First-pass values — final
    // visual tuning is the deferred manual DoD (CF-01).
    screen: {
      // Overlay fade-in duration (ms) for the whole game-over presentation.
      fadeMs: 500,
      // Semi-transparent full-screen overlay behind the frozen final frame.
      overlayColor: 0x05010a,
      overlayAlpha: 0.72,
      // "GAME OVER" title styling.
      title: { text: 'GAME OVER', color: '#ff1744', sizePx: 72 },
      // Final-score readout styling (`${prefix}${finalScore}`).
      score: { prefix: 'SCORE ', color: '#39ff14', sizePx: 56 },
      // Fake `Play` restart CTA — rectangle dimensions + label styling.
      cta: {
        label: 'PLAY',
        width: 360,
        height: 132,
        fillColor: 0x39ff14,
        textColor: '#05010a',
        textSizePx: 60,
      },
    },
  },

  // --- Brick-row spawning (BlockDrop-2 FR-6: distance-triggered) ---
  // A new bottom row is spawned once the most recently spawned row has RISEN one
  // `riseTrigger` of game units from its spawn position (default = one row
  // height, 120u), so rows always stack exactly one cell apart and the cadence
  // accelerates naturally with rise speed. `interval` is the LEGACY fixed-cadence
  // value (seconds) — retained so existing config consumers/tests keep resolving
  // it, but no longer read by the simulation once FR-6 landed.
  spawn: {
    interval: 2.5,
    riseTrigger: 120,
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
    // Bomb-value scaling params (BlockDrop-2 FR-5): the bomb's numeric value is
    // drawn around a `base` that drifts upward with difficulty by
    // `growthPerLevel`, with a fixed `variance` spread. Clamped to
    // [values.bombMin, values.bombMax] by the difficulty logic — DECOUPLED from
    // the brick cap so late-game bombs can reach 60 and decisively cascade.
    value: {
      base: 6,
      variance: 6,
      growthPerLevel: 4,
    },
  },

  // --- Value ranges ---
  // Bricks stay bounded to [brickMin, brickMax] = [1,30] (INV-7 tint domain).
  // BlockDrop-2 FR-4 reshapes the brick curve so early rows draw from
  // [brickMin, brickStartMax] and the UPPER cap grows over time toward brickMax
  // while the lower bound stays at brickMin for the whole session.
  // BlockDrop-2 FR-5 gives bombs their OWN cap, [bombMin, bombMax] = [1,60],
  // independent of the brick cap.
  values: {
    brickMin: 1,
    brickMax: 30,
    brickStartMax: 8,
    bombMin: 1,
    bombMax: 60,
  },

  // --- Difficulty curve (upward drift over elapsed time) ---
  // `levelInterval`: seconds of play per difficulty level increment.
  // `brickMaxGrowthPerLevel`: how much the brick UPPER cap grows per level
  // (FR-4), from `values.brickStartMax` toward `values.brickMax`.
  // `valueDriftPerLevel`: LEGACY (pre-FR-4 lower-bound drift) — retained for
  // back-compat config consumers/tests; no longer read by the brick curve.
  // `maxLevel` caps the curve so values stay bounded.
  difficulty: {
    levelInterval: 8,
    valueDriftPerLevel: 1.5,
    brickMaxGrowthPerLevel: 2,
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
    // Two-tier screen shake (BlockDrop-2 FR-2).
    //   `shake` — the HEAVIER exact-match row-clear shake (unchanged: ~220ms,
    //     intensity 0.012), the INV-8 row-clear trigger.
    //   `hitShake` — a LIGHTER, shorter shake fired on EVERY bomb-hits-brick
    //     collision (greater/lesser). Distinctly weaker so the two read apart.
    shake: {
      durationMs: 220,
      intensity: 0.012,
    },
    hitShake: {
      durationMs: 90,
      intensity: 0.005,
    },
    // Explosion particle burst per collision outcome (counts clamped to the
    // particle budget by `explosionParticleCount`) plus emitter tuning.
    // BlockDrop-2 FR-3 beefs up the burst counts (still well under the
    // particles.maxConcurrent budget, R5).
    explosion: {
      countGreater: 20,
      countLesser: 16,
      countExact: 40,
      lifespanMs: 420,
      speedMin: 120,
      speedMax: 380,
      scaleStart: 0.9,
      scaleEnd: 0,
    },
    // Expanding shockwave ring per collision (BlockDrop-2 FR-3). A single ring
    // sprite scales from `startScale`→`endScale` while its alpha fades
    // `startAlpha`→0 over `lifespanMs`, coloured to match the outcome. The pure
    // scale/alpha curves live in `src/render/effects.js` (shockwave helpers).
    shockwave: {
      lifespanMs: 420,
      startScale: 0.25,
      endScale: 2.6,
      startAlpha: 0.8,
    },
    // Sprite-sheet explosion animation (BlockDrop-2 FR-3). The frames are baked
    // build-time by `scripts/gen-explosion-spritesheet.js` into
    // `assets/explosion.png` (see `assets.explosionSheet`); the render layer
    // plays this animation once per collision, tinted per outcome.
    explosionAnim: {
      key: 'explosion',
      frameRate: 24,
      scale: 1.1,
    },
  },

  // --- Sprite-sheet assets (build-time generated, committed to the repo) ---
  // BlockDrop-2 FR-3: the monochrome explosion sheet is produced by the Node
  // script `scripts/gen-explosion-spritesheet.js` and loaded by the render layer
  // via a sprite-sheet load call `{ frameWidth, frameHeight }`. Frames are laid
  // out horizontally: sheet width = frameWidth * frameCount.
  assets: {
    explosionSheet: {
      key: 'explosion',
      path: 'assets/explosion.png',
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 10,
    },
  },

  // --- Numeric value labels on bricks / bomb (BlockDrop-2 FR-1) ---
  // Bold monospace with a dark stroke for contrast against any tint. Consumed by
  // the render layer, which centres a text object on each alive brick and on the
  // active bomb and updates it whenever the value changes.
  labels: {
    fontFamily: 'monospace',
    fontStyle: 'bold',
    color: '#ffffff',
    stroke: '#05010a',
    strokeThickness: 5,
    brickSizePx: 40,
    bombSizePx: 44,
  },

  // --- Top bar (BlockDrop-2 FR-8) ---
  // Reserved band across the top of the playfield (`height` game units). The
  // gameplay top edge and danger line sit at `height` (= gameOver.topY). Layout:
  // the score readout is left-aligned at `scoreX`; the two bomb previews
  // (FR-7, queue order — leftmost drops next) are right-aligned as `slotSize`
  // squares separated by `slotGap`, `rightPad` from the right edge.
  topBar: {
    height: TOP_BAR_HEIGHT,
    background: 0x0a0f30,
    backgroundAlpha: 0.92,
    borderColor: 0x39ff14,
    borderAlpha: 0.5,
    scoreX: 24,
    scoreSizePx: 44,
    scoreColor: '#ffffff',
    preview: {
      slotSize: 84,
      slotGap: 18,
      rightPad: 28,
      iconScale: 0.82,
      labelSizePx: 34,
    },
  },

  // --- Diagnostics ---
  // Gates lightweight console diagnostics in the core/render layers (TDD §
  // "Logs"). Off by default.
  debug: false,
};

export default config;
