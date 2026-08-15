# Phases: Neon Bomb Brick Playable (blockdrop-2)

## 0. Metadata

- Feature Slug: blockdrop-2
- Related TDD: `./10-tdd.md`
- Status: In Delivery — Phases 01–05 accepted; Phase 06 next
- Last Updated: 2026-08-15

---

## 1. Phase Roadmap (High Level)

This document defines *how we sequence delivery*. It does NOT include file-level implementation
details. Decomposition follows the smallest-safe-slice rule: each phase is an independently
validatable unit that leaves the system coherent. The heavy, subtle logic (collision cascade,
difficulty, scoring) is isolated in the Phaser-free simulation core so it can be validated
headlessly before any rendering exists.

Single repo throughout: **Takumi-Playable**.

### Phase 01: Playable Shell & Test Harness
- Outcome: Accepted on 2026-08-14 by review node
  `8dae50e7-00e4-4266-9248-9d5e75269d48`. The vendored Phaser shell, central tunables, and
  headless harness were delivered with 9/9 automated tests and all shell syntax checks passing.
- Goal: Establish a bootable mobile-portrait Phaser runtime and the headless test harness.
- Scope: `index.html` loading a pinned/vendored Phaser 3; `src/main.js` game config (720×1280
  design resolution, `Scale.FIT` + `CENTER_BOTH`, scene list); a minimal `BootScene`/`GameScene`
  rendering a plain neon background; `src/core/config.js` tunables module; `node:test` harness
  wired via a `package.json` `test` script (`node --test`) with a smoke test importing `config.js`.
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [ ] Page boots in a browser in portrait and renders a background (manual DoD check; carried
        as CF-01 because the accepted headless review could verify only structural preconditions).
  - [x] `node --test` runs and the config smoke test passes (unit).
  - [x] `config.js` exposes the tunable set defined in the TDD and imports no Phaser.
- Key Risks / Notes: Vendoring/pinning Phaser (R1). Foundation for all later phases.

### Phase 02: Simulation Core — Values, Grid & Scoring
- Outcome: Accepted on 2026-08-14 by review node
  `d77b016e-5282-449c-a35c-51e6deb4cb95`. Deterministic RNG, upward-scaling value generation,
  grid/row helpers, and monotonic scoring were delivered with 49/49 automated tests passing and
  no review findings.
- Goal: Deterministic, Phaser-free primitives for value generation, the grid/brick/bomb data
  model, and scoring.
- Scope: `src/core/rng.js` (seedable RNG), `src/core/difficulty.js` (elapsed→brick value in [1,30]
  with upward drift; elapsed→bomb value scaling), `src/core/grid.js` (brick/row/bomb model +
  row-clear helper), `src/core/scoring.js`. No simulation loop yet; no rendering.
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [x] Brick values always ∈ [1,30]; mean value increases with elapsed time under a fixed seed
        (unit). (INV-7)
  - [x] Bomb value range scales upward with elapsed time (unit).
  - [x] Seeded RNG is deterministic — same seed reproduces the same sequence (unit). (INV-2)
  - [x] Scoring accumulates value monotonically and correctly (unit). (INV-4)
- Key Risks / Notes: Difficulty tuning risk (R2) begins here; determinism (R4).

### Phase 03: Simulation Loop — Collision, Rising & Game Over
- Outcome: Accepted on 2026-08-14 by review node
  `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40`. The pure collision resolver and complete deterministic
  `GameModel` were delivered with 85/85 automated tests passing and no blocking findings.
- Goal: The full headless game model: tick loop, collision cascade, rising bricks + spawn,
  cooldown gate, and game-over detection.
- Scope: `src/core/collision.js` (single bomb↔brick resolution: greater/lesser/exact) and
  `src/core/simulation.js` (`GameModel` with `dropBomb`, `tick`, `getState`, `consumeEvents`,
  `reset`). Implements the collision cascade (bomb chewing through a column), exact-match row
  clear, scoring integration, one-bomb cooldown, and game-over when bricks reach the top.
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [x] All three collision rules behave exactly as specified, including multi-brick cascade and
        exact-match full-row clear (unit + integration). (INV-8)
  - [x] `dropBomb` respects cooldown and single-active-bomb rule (unit). (INV-5)
  - [x] A headless session (spawn → rise → no input) reaches game-over, and under the tuned seed
        lands within ~30–45 s of simulated time (integration). (R2)
  - [x] `GameModel` public API returns the state/event shape defined in the TDD (contract).
- Key Risks / Notes: Depends on Phase 02. Highest logic-complexity phase; heaviest test coverage.

### Phase 04: Rendering & Input Binding
- Outcome: Accepted on 2026-08-15 by review node
  `ef323933-2bed-4059-a7d1-ef4c953d7ce5`. Pure tint and fixed-step helpers, generated-once neon
  textures, and the snapshot-driven Phaser render/input adapter were delivered with 99/99 tests
  passing and all changed JavaScript parsing cleanly. The manual browser walkthrough remains
  explicitly carried as CF-01.
- Goal: Make the simulation visible and playable in Phaser.
- Scope: `src/render/neon.js` (procedural neon textures), pure `valueToTint` and `fixedSteps`
  helpers, and `GameScene` wiring — instantiate `GameModel`, drive it with bounded Phaser delta
  steps, render bricks/bomb/danger line/score from `getState`, and map taps → `model.dropBomb`.
  No juice yet beyond static rendering.
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [ ] Bricks, bomb, and danger line render at model positions; the loop is playable end-to-end
        in a browser (manual DoD check).
  - [x] Tint mapping is monotonic green→red across [1,30]; `GameScene` applies current brick values
        on every reconciliation, including partial damage (unit + structural review). (INV-7)
  - [x] Tap position is forwarded in game-space coordinates and the accepted model maps it to a
        column while enforcing cooldown/single-bomb rules (regression + structural review).
- Key Risks / Notes: Depends on Phases 01 + 03. Scene stays thin; no state mutation outside the
  model (INV-3). Testability-of-Phaser risk (R3).

### Phase 05: Game Feel Effects
- Outcome: Accepted on 2026-08-15 by review node
  `1c072521-caaf-4349-9a3f-28143e4285b7`. Pure pulse and particle-budget helpers, a generated
  particle texture, and event-driven GameScene effects were delivered with 108/108 automated
  tests passing and all changed JavaScript parsing cleanly. Manual visual/mobile confirmation
  remains carried as CF-01.
- Goal: Add the required juice.
- Scope: Explosion particles on bomb detonation, brick spawn fade-in, screen shake on exact-match
  row clears, pulsing top danger line, and immediate partial-damage tint refresh — all driven by
  the model's drained events (`consumeEvents`).
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [x] Each required effect is wired to the correct model event or elapsed-time source
        (structural review); visible confirmation remains part of CF-01.
  - [x] Effects are event-driven from the model and do not alter simulation outcomes — core tests
        from Phases 02–03 still pass unchanged (regression).
  - [x] Particle counts are capped per the performance budget (unit + review). (R5)
- Key Risks / Notes: Depends on Phase 04. Performance-on-mobile risk (R5).

### Phase 06: Game-Over Screen & Restart CTA
- Goal: Close the session loop.
- Scope: `GameOverScene` — game-over fade-in, final score display, and the fake `Play` CTA that
  restarts a fresh session; wire `GameScene`'s game-over transition; ensure a clean state reset on
  restart.
- Repos touched: Takumi-Playable.
- Exit Criteria:
  - [ ] Game-over screen fades in with the final score and a fake `Play` CTA (manual DoD check).
  - [ ] Activating the CTA restarts a fresh session equal to the initial state — score 0, no bomb,
        fresh bricks (integration on `reset`/re-construction). (INV-6)
  - [ ] Full DoD walkthrough passes: portrait boot, collision rules, rise→game-over, cooldown,
        upward scaling, value-based score, game-over CTA restart, neon effects visible.
- Key Risks / Notes: Depends on Phase 04 (and visually on Phase 05's fade-in). Final integration
  phase.

---

## 2. Phase Dependencies

- Phase 02 depends on Phase 01 because it needs the source layout, `config.js` tunables, and the
  `node:test` harness in place.
- Phase 03 depends on Phase 02 because the loop composes the value/grid/scoring primitives.
- Phase 04 depends on Phases 01 and 03 because rendering binds the Phaser runtime (01) to a
  functioning simulation model (03).
- Phase 05 depends on Phase 04 because juice attaches to rendered objects and model events.
- Phase 06 depends on Phase 04 (playable loop + game-over signal) and visually leans on Phase 05's
  fade-in; it closes the session lifecycle.

Phases 02 and 03 are pure-logic and can proceed independently of the render track's art work once
the shell (01) exists, but rendering (04) cannot start until the model (03) is real.

---

## 3. Deferred Work Registry

Phase 05 leaves three non-blocking, review-traceable items. It retained the manual browser check
and two scoped cleanup/observability items after explicitly re-evaluating each one. Current fields
and rationale are in `phase-05/32-carry-forward.md`.

- CF-01 — execute the manual mobile-portrait browser boot/play check for the delivered render,
  input binding, and game-feel effects during the Phase 06 final DoD walkthrough.
- CF-02 — remove the pre-existing empty `Test.txt` during Phase 06 final integration cleanup.
- CF-03 — consider a debug-only warning for unknown scale configuration tokens when shell
  observability is next touched.
