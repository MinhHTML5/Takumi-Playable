# Risk Register: Neon Bomb Brick Playable (blockdrop-2)

## 0. Metadata

- Feature Slug: blockdrop-2
- Related TDD: `./10-tdd.md`
- Status: Active — reconciled after Phase 05
- Last Updated: 2026-08-15

---

## 1. Risks

### R1: Phaser runtime acquisition / version drift
- Status: Resolved for the current scope in Phase 01
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
- Phase 01 Outcome: The primary vendored path succeeded with pinned Phaser 3.80.0 at
  `vendor/phaser.min.js`; `index.html` references it locally and automated validation remains
  Phaser-independent. Review node `8dae50e7-00e4-4266-9248-9d5e75269d48` found no residual
  blocking acquisition risk.

### R2: Difficulty tuning misses the 30–45 s target
- Status: Mitigated for the headless model; browser play feel remains to be confirmed
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
- Phase 02 Outcome: Brick and bomb ranges remain within `[1,30]`, rise monotonically by difficulty
  level, and show upward mean drift under fixed seeds. Review node
  `d77b016e-5282-449c-a35c-51e6deb4cb95` accepted these properties with 49/49 tests passing. The
  30–45 s game-over target cannot be exercised until the Phase 03 simulation loop exists.
- Phase 03 Outcome: Review node `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40` accepted integration
  evidence that no-input sessions under seeds `1`, `20260814`, and `777`, stepped at 60 Hz, reach
  game-over within `[30,45]` seconds. Residual risk is subjective player feel, to be checked once
  browser play is available.

### R3: Phaser scenes are hard to unit-test
- Status: Mitigated structurally through Phase 05; residual manual validation remains
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
- Phase 01 Outcome: The shell keeps Phaser references outside `src/core/`, and the core-purity
  test passed. Browser rendering remains a manual validation boundary (CF-01).
- Phase 04 Outcome: Review node `ef323933-2bed-4059-a7d1-ef4c953d7ce5` accepted a thin scene
  adapter with no game rules or model-state mutation. Tint and fixed-step logic were extracted
  into pure modules with 14 focused tests; the 99/99 full suite and recursive core-purity check
  passed. The Phaser-coupled texture/scene surface parsed cleanly, while runtime rendering remains
  the explicit CF-01 manual boundary.
- Phase 05 Outcome: Review node `1c072521-caaf-4349-9a3f-28143e4285b7` accepted the effects layer
  with pulse and particle-budget math extracted into `src/render/effects.js` and covered by nine
  focused tests. The Phaser-coupled emitter, fade, shake, and pulse application remains thin
  adapter code; all changed JavaScript parsed cleanly and the full 108/108 suite passed.

### R4: Non-deterministic core breaks reproducibility and tests
- Status: Mitigated through the complete Phase 03 simulation core
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
- Phase 02 Outcome: `rng.js` provides deterministic per-seed streams; difficulty functions use an
  injected RNG and explicit elapsed time. Dynamic tests scan every core module for direct random
  or wall-clock reads, and seeded replay assertions pass. Review node
  `d77b016e-5282-449c-a35c-51e6deb4cb95` accepted the implementation without findings. The same
  invariant remains binding as Phase 03 adds `tick(dt)` and simulation orchestration.
- Phase 03 Outcome: `GameModel` uses injected RNG and explicit `dt` only; the recursive purity
  guard and seeded integration scenarios passed in the accepted 85/85 suite. Phase 03 review found
  no wall-clock or direct-randomness path.

### R5: Mobile performance under particle/glow load
- Status: Mitigated structurally in Phase 05; real-device frame-rate confirmation remains
- Category: Performance
- Description: Neon glow and explosion particles can drop frame rate on mid-range mobile GPUs.
- Likelihood: Medium
- Impact: Medium
- Detection: Frame-rate dips during row clears / heavy particle moments in manual mobile testing.
- Mitigation: Generate textures once and reuse; reuse particle emitters; cap concurrent particles
  and total brick count; scope collision checks to the bomb's column. Degrade particle counts if
  needed.
- Phase Most Affected: Phase 05
- Phase 04 Outcome: Procedural background, brick, bomb, and danger-line textures are generated
  once and reused; brick sprites are reconciled by id and the bomb sprite is reused. Phase 04
  review found no performance blocker. Particle/emitter load is not yet implemented or exercised,
  so the risk remains open for Phase 05.
- Phase 05 Outcome: The neutral particle texture is generated once, one emitter is reused for all
  bursts, per-outcome counts are clamped to `config.particles.maxConcurrent`, and spawn tweens are
  bounded by row size and duration. Review node `1c072521-caaf-4349-9a3f-28143e4285b7` accepted
  the implementation with no performance finding; the cap and outcome mapping are covered by the
  108/108 suite. Actual mid-range mobile GPU behavior remains part of CF-01.

### R6: Collision cascade / row-clear edge cases
- Status: Mitigated for the accepted Phase 03 configuration and contracts
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
- Phase 03 Outcome: Exhaustive resolver tests and model integration scenarios cover greater,
  lesser, exact, multi-brick cascades, partially cleared rows, aggregate row scoring, and misses.
  Review node `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40` accepted all evidence. Residual constraint:
  collision overlap is point-based and assumes bomb travel per tick does not exceed row height;
  this is tracked as Phase 03 CF-04 for any future tuning that changes that relationship.
- Phase 04 Outcome: CF-04 is discharged for variable browser frame cadence. `fixedSteps` caps each
  model tick at 0.05 s, limiting bomb travel to 45 game units against a 120-unit row height; the
  real-config relationship is pinned by the accepted loop tests.

### R7: Mobile-portrait scaling / input across viewports
- Status: Partially mitigated — render/input binding delivered; browser confirmation pending
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
- Phase 01 Outcome: The 720×1280 FIT/CENTER_BOTH configuration and portrait viewport metadata are
  implemented and structurally accepted. Actual browser/viewport behavior was not executable in
  the headless lane and is carried as CF-01.
- Phase 04 Outcome: `GameScene` now forwards Phaser `pointer.worldX` to the model, which clamps and
  maps the game-space coordinate to a valid column while enforcing cooldown. Review accepted the
  structural binding and existing model tests; cross-viewport behavior still requires the CF-01
  manual browser walkthrough.

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

- Q1: The headless no-input window holds for three accepted fixed seeds. Will the same constants
  produce the intended duration and feel for real first-time players? Resolve through browser
  playtest feedback during Phases 04–06.
- Q2: Resolved for the current scope. Phaser 3.80.0 is vendored for self-containment, consistent
  with the absence of a file-size constraint. Reopen only if product scope introduces one.
