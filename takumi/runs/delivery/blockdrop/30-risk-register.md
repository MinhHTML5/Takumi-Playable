# Risk Register: Number Bomb Brick Breaker (blockdrop)

## 0. Metadata

- Feature Slug: blockdrop
- Related TDD: `./10-tdd.md`
- Status: Draft
- Last Updated: 2026-08-14

---

## 1. Risks

### R1: Sequential collision resolution is wrong
- Category: Correctness
- Description: The bomb's pass-through logic (`>` destroy + subtract + continue, `<` damage + spend,
  `==` destroy both + clear whole row) is the core mechanic; an off-by-one or wrong equality
  ordering silently changes gameplay and violates I2/I3.
- Likelihood: Medium
- Impact: High
- Detection: `unit` tests over every branch incl. multi-brick pass-through, bomb reaching exactly 0,
  and full-row clear; deterministic seeded scenarios.
- Mitigation: Implement `rules.resolveDrop` as a pure function with exhaustive table-driven unit
  tests before any rendering exists (Phase 1).
- Phase Most Affected: Phase 1

### R2: Phaser objects leak into the logic core
- Category: Concurrency / Structural
- Description: If rendering code imports into `src/core/**` (or the core imports Phaser), the rules
  become un-unit-testable in CI and I1 breaks, undermining the whole testability strategy.
- Likelihood: Medium
- Impact: High
- Detection: Grep/test check that fails when `src/core/**` imports `phaser`; core tests run in Node
  with no DOM.
- Mitigation: Enforce the core/render boundary as invariant I1; keep the engine framework-free and
  have scenes call *into* it only.
- Phase Most Affected: Phase 1 (established), Phase 2 (respected)

### R3: Pacing misses the 30–45s target
- Category: Operational (game feel)
- Description: Rise speed, spawn cadence, cooldown, and value bands may produce sessions that are too
  short or too long, missing the ad-style pacing goal.
- Likelihood: High
- Impact: Medium
- Detection: Seeded auto-play pacing harness estimating average session length; manual playtest.
- Mitigation: Centralize all pacing in `config`; defer final tuning to Phase 3 with buffer for
  iteration; use determinism (I7) to measure repeatably.
- Phase Most Affected: Phase 3

### R4: Mobile performance degrades during juice
- Category: Performance
- Description: Particle bursts, screen shake, and rising bricks may drop frames on common mobile
  browser viewports.
- Likelihood: Medium
- Impact: Medium
- Detection: Manual smoke on a mobile-sized viewport during clears; watch for frame drops.
- Mitigation: Cache procedurally-generated textures at boot; bound particle counts and active rows;
  keep the `step`/render hot loop allocation-light (TDD §7).
- Phase Most Affected: Phase 3

### R5: Non-deterministic randomness blocks testing
- Category: Correctness
- Description: Using `Math.random()` directly makes spawn/difficulty behavior irreproducible, so
  I5/I7 and pacing analysis cannot be validated.
- Likelihood: Medium
- Impact: Medium
- Detection: Core review + tests requiring a fixed seed to reproduce outcomes.
- Mitigation: Route all randomness through the injectable seeded `rng`; forbid direct `Math.random`
  in `src/core/**`.
- Phase Most Affected: Phase 1

### R6: Phaser integration untestable in CI
- Category: Validation
- Description: Phaser needs a canvas/WebGL context; naive integration tests fail in headless CI.
- Likelihood: Medium
- Impact: Medium
- Detection: Integration test run in the project's CI/local `vitest` environment.
- Mitigation: Use Phaser headless mode / canvas-mock + jsdom; keep integration assertions on wiring
  (tap→dropBomb, events→HUD, loss→game-over) rather than rendered pixels.
- Phase Most Affected: Phase 2

### R7: Best-score persistence throws on unavailable/corrupt storage
- Category: Data
- Description: `localStorage` may be disabled (private mode) or hold a malformed value, risking a
  crash on load and violating I8.
- Likelihood: Low
- Impact: Medium
- Detection: Unit tests for `LocalStorageBestScore` with unavailable storage and malformed values.
- Mitigation: Defensive parse + try/catch with in-memory fallback behind the `BestScoreStore`
  interface.
- Phase Most Affected: Phase 1

### R8: Row-clear semantics ambiguity
- Category: Correctness
- Description: "Clear the whole row" could be misread (grid-row by y vs spawn-wave row), producing
  surprising clears.
- Likelihood: Low
- Impact: Medium
- Detection: Unit tests asserting a `==` match clears exactly the matched brick's spawn-wave row.
- Mitigation: TDD fixes a "row" as a spawn wave (shared `Row.id`); encode it in `board` + I2.
- Phase Most Affected: Phase 1

---

## 2. Invariant Threats

- Invariant: **I1 (core purity)** — Threat: a convenience import of Phaser into core. Mitigation:
  grep/test guard; scenes call into the engine only.
- Invariant: **I2/I3 (number rules & sequential resolution)** — Threat: wrong equality ordering or
  pass-through subtraction. Mitigation: pure `resolveDrop` + exhaustive table-driven tests.
- Invariant: **I4 (single bomb / cooldown)** — Threat: rapid taps spawning multiple bombs.
  Mitigation: engine gates `dropBomb` on `activeBomb==null` and cooldown; tested.
- Invariant: **I5 (upward trend)** — Threat: flat or noisy distribution hides escalation. Mitigation:
  statistical test on seeded spawns; difficulty monotonic where required.
- Invariant: **I6 (single writer / terminal game-over)** — Threat: scene mutating state or scoring
  after loss. Mitigation: engine is sole writer; no scoring/spawn once `phase=='gameover'`; tested.
- Invariant: **I7 (determinism)** — Threat: direct `Math.random`. Mitigation: injectable `rng`; ban
  global randomness in core.
- Invariant: **I8 (best score)** — Threat: storage errors or `best < score` display. Mitigation:
  defensive store + best updated only at game over when exceeded; tested.

---

## 3. Open Risk Questions

- Q1: What common mobile viewport(s) should the manual performance smoke target? (Assumed: a typical
  phone portrait size, e.g. ~390×844 CSS px; refine during Phase 3 if the operator specifies.)
- Q2: Is any accessibility/color-contrast bar required for the green→red tint (e.g. colorblind
  readability)? Not specified by the PRD; numbers are always shown as text as a fallback.
