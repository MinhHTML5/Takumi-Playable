# Risk Register: Neon Bomb Brick Playable (blockdrop-2)

## 0. Metadata

- Feature Slug: blockdrop-2
- Related TDD: `./10-tdd.md`
- Status: Draft
- Last Updated: 2026-08-14

---

## 1. Risks

### R1: Phaser runtime acquisition / version drift
- Category: Operational
- Description: The playable depends on the Phaser 3 runtime. Loading it from a CDN introduces a
  runtime network dependency and version drift; the sandbox may also lack network access to fetch
  it at build time.
- Likelihood: Medium
- Impact: Medium
- Detection: Page fails to boot (blank canvas, `Phaser is not defined`); build step cannot download
  the runtime.
- Mitigation: Pin an exact Phaser 3 version and **vendor** `phaser.min.js` into the repo so the
  playable is self-contained and offline-runnable. Crucially, the simulation core and all
  automated tests import **no** Phaser (INV-1), so validation never depends on runtime acquisition
  — logic can be built and verified even if the runtime file is added separately.
- Phase Most Affected: Phase 01

### R2: Difficulty tuning misses the 30–45 s target
- Category: Correctness
- Description: Rise speed, spawn interval, and the value-scaling curve must combine so a typical
  first-time player loses in ~30–45 s. Mis-tuned constants make sessions too short or too long.
- Likelihood: High
- Impact: Medium
- Detection: Integration test simulating a no-input (worst-case) session under a fixed seed reports
  a game-over time outside the target window; manual playtest feel.
- Mitigation: Centralize every tunable in `config.js`; add an integration test asserting the
  simulated game-over time falls within a target band; iterate constants without touching logic.
- Phase Most Affected: Phase 03 (introduced in Phase 02)

### R3: Phaser scenes are hard to unit-test
- Category: Correctness
- Description: Rendering/input code bound to Phaser is not testable in a headless Node runner,
  risking untested logic leaking into scenes.
- Likelihood: Medium
- Impact: Medium
- Detection: Logic appearing inside scenes that has no corresponding unit test; review flags
  state mutation outside the model.
- Mitigation: Strict model–view separation (INV-1, INV-3). All rules live in the Phaser-free core
  and are unit/integration tested; scenes are thin adapters. Pure helpers used by scenes (tint
  mapping, tap→column, cooldown gate) live in core and are unit-tested independently.
- Phase Most Affected: Phase 04

### R4: Non-deterministic core breaks reproducibility and tests
- Category: Correctness
- Description: Direct `Math.random()` or wall-clock reads in the core would make sessions
  irreproducible and tests flaky.
- Likelihood: Medium
- Impact: High
- Detection: Seeded-replay test produces differing sequences; grep check finds `Math.random` or
  `Date`/`performance` usage in `src/core/`.
- Mitigation: All randomness flows through an injected seedable RNG (INV-2); `tick(dt)` takes an
  explicit delta rather than reading time. Enforce with a grep-based purity test.
- Phase Most Affected: Phase 02

### R5: Mobile performance under particle/glow load
- Category: Performance
- Description: Neon glow and explosion particles can drop frame rate on mid-range mobile GPUs.
- Likelihood: Medium
- Impact: Medium
- Detection: Frame-rate dips during row clears / heavy particle moments in manual mobile testing.
- Mitigation: Generate textures once and reuse; reuse particle emitters; cap concurrent particles
  and total brick count; scope collision checks to the bomb's column. Degrade particle counts if
  needed.
- Phase Most Affected: Phase 05

### R6: Collision cascade / row-clear edge cases
- Category: Correctness
- Description: The bomb chewing through multiple bricks in one fall, exact-match full-row clears,
  and simultaneous events create ordering/edge-case bugs (e.g. bomb reduced to 0, empty rows,
  brick reduced below its own value).
- Likelihood: High
- Impact: High
- Detection: Unit/integration tests over crafted collision scenarios; score invariant (INV-4)
  violations; incorrect surviving bricks.
- Mitigation: Isolate single-interaction resolution in a pure `collision.js` with exhaustive unit
  tests; test the cascade and row-clear in `simulation.js` with scripted scenarios; assert INV-4
  and INV-8 hold.
- Phase Most Affected: Phase 03

### R7: Mobile-portrait scaling / input across viewports
- Category: Correctness
- Description: Varying device aspect ratios and touch vs mouse input can misplace elements or
  mis-map tap position to brick columns.
- Likelihood: Medium
- Impact: Medium
- Detection: Elements clipped/letterboxed incorrectly; taps drop bombs in the wrong column on
  different viewport sizes; manual testing across a few portrait sizes.
- Mitigation: Fixed 720×1280 design resolution with `Scale.FIT` + `CENTER_BOTH`; convert pointer
  coordinates through Phaser's scale manager; unit-test the pure tap→column mapping against the
  design resolution.
- Phase Most Affected: Phase 04

---

## 2. Invariant Threats

- Invariant: **INV-1 (Core purity)** — core imports no Phaser/DOM.
  - Threat: Convenience import of a Phaser type or `window`/`document` into a core module.
  - Mitigation: Grep/lint purity test in CI-equivalent `node --test`; review gate.
- Invariant: **INV-2 (Deterministic randomness)**.
  - Threat: `Math.random()` or wall-clock time sneaking into core logic.
  - Mitigation: Injected RNG + explicit `dt`; seeded-replay and grep tests (see R4).
- Invariant: **INV-4 (Scoring correctness)** — monotonic, equals value removed/cleared.
  - Threat: Double-counting on cascades/row clears, or missing partial-damage credit.
  - Mitigation: Scenario tests over cascade + row-clear paths asserting exact score deltas
    (see R6).
- Invariant: **INV-5 (Bomb cooldown / single active bomb)**.
  - Threat: Rapid taps dropping multiple bombs or bypassing cooldown.
  - Mitigation: Gate enforced in `GameModel.dropBomb`; unit tests for rapid-drop attempts.
- Invariant: **INV-6 (Clean restart)**.
  - Threat: Residual state (score, bricks, bomb, timers) leaking across restart.
  - Mitigation: Reconstruct/`reset` the model on restart; integration test asserting equality to
    initial state.
- Invariant: **INV-8 (Collision rule fidelity)**.
  - Threat: Wrong branch on greater/lesser/exact, or missed row clear.
  - Mitigation: Exhaustive unit tests per rule branch (see R6).

---

## 3. Open Risk Questions

- Q1: Will the empirically-tuned difficulty constants hold the 30–45 s window across the range of
  real first-time players, or only under the test seed? Resolved by playtest feedback during
  Phases 03–06.
- Q2: Is vendoring the Phaser runtime acceptable given no stated file-size limit, or is a CDN
  reference preferred for size? Defaulting to vendoring for self-containment (R1); revisit if a
  size constraint emerges.
