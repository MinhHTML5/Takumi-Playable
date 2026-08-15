# Phase Plan: Phase 05 — Game Feel Effects

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 05
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: `../phase-04/32-carry-forward.md`
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Phase Goal

Add the required **game-feel juice** to the already-playable render loop: explosion particles on
bomb detonation, brick spawn fade-in, screen shake on exact-match row clears, and a pulsing top
danger line (PRD Goal 8; phases.md Phase 05). Immediate partial-damage tint refresh — also named in
the Phase 05 scope — was already delivered by Phase 04 (`GameScene` re-tints every alive brick from
its current value each frame, INV-7); this phase **preserves** that behavior and does not
re-implement it.

Every effect is **render-layer only**, driven either by the model's already-emitted events
(`model.consumeEvents()` → `explosion` / `spawn` / `rowClear`; TDD §4.3) or by read-only elapsed
time (`getState().time`) for the continuous danger-line pulse. **No `src/core/` module changes.**
This is the smallest safe slice that adds the visible feel while leaving the deterministic
simulation and its 99-test suite untouched:

- **Advances the feature:** delivers the last missing visual requirement before the Phase 06
  game-over/CTA close-out.
- **Preserves invariants:** effects never mutate model state and add no rules (INV-3, INV-1); the
  model's event shape is consumed, not changed (INV-8's `rowClear`/`explosion` triggers already
  exist), so INV-1..8 are structurally preserved.
- **Coherent validation boundary:** the phase's genuine logic — the danger-line pulse math and the
  particle-budget cap (R5) — is isolated into a pure, Phaser-free helper module that `node:test`
  validates headlessly; the Phaser-coupled wiring is parse-checked + regression-gated + carried to
  the manual DoD, exactly as Phase 04 did for its scene/texture surface.

---

## 2. Scope

### In-Scope
- A new pure, Phaser-free render helper module `src/render/effects.js` containing:
  - `dangerPulse(timeSeconds, config)` — a deterministic sine oscillator returning the danger
    line's `{ alpha, scaleY }` for a given elapsed time (continuous pulse).
  - `explosionParticleCount(outcome, config)` — maps a collision outcome
    (`greater` / `lesser` / `exact`) to an integer particle burst count, **clamped** to the
    performance budget `config.particles.maxConcurrent` (R5).
- `test/effects.test.js` — `node:test` unit coverage for both helpers.
- An **additive** `config.effects` block in `src/core/config.js` (pulse frequency/amplitude,
  spawn fade duration, shake duration/intensity, per-outcome particle counts + lifespan/speed/scale).
  No change to any value asserted by `test/config.test.js`.
- A new neutral-white neon **particle texture** in `src/render/neon.js` (`TEX_PARTICLE` +
  `generateParticle`, wired into `generateTextures`, generate-once/idempotent per TDD §7).
- `src/scenes/GameScene.js` wiring only:
  - drain `model.consumeEvents()` each `update()` and dispatch:
    - `explosion` → a capped burst from a **reused** particle emitter at the event's `(x, y)`,
      tinted by outcome/value;
    - `rowClear` → `this.cameras.main.shake(...)` (the INV-8 screen-shake trigger);
    - `spawn` → tag the newly spawned row's bricks so their sprites fade in (alpha 0→1) on first
      appearance;
  - each frame, drive the stored danger-line image's `alpha`/`scaleY` from `dangerPulse(state.time)`;
  - preserve the existing per-frame partial-damage tint refresh unchanged.

### Out-of-Scope
- Any change to `src/core/*` logic or the `GameModel` public/event API (event shape is consumed as-is).
- Game-over fade-in, `GameOverScene`, the final-score overlay, and the fake `Play` CTA/restart
  (Phase 06).
- Removing `Test.txt` (CF-02) and the `src/main.js` scale-token debug warning (CF-03) — neither
  file is touched this phase (see §10).
- Executing the manual browser DoD walkthrough (CF-01) — the headless lane has no browser (see §10).
- New tunable *values* being asserted into `test/config.test.js`; audio; any change to
  `index.html`, `src/main.js`, `BootScene.js`, or `vendor/`.

This section prevents phase bleed. Nothing listed as out-of-scope appears in the Task Inventory.

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `src/render/effects.js` (pure helpers) + `test/effects.test.js`.
- Additive `config.effects` block in `src/core/config.js`.
- `TEX_PARTICLE` particle texture in `src/render/neon.js`.
- Event-driven juice wiring in `src/scenes/GameScene.js`.
- `phase-05/stabilization-report.md` (debug output).

### Exit Criteria
- [ ] Implementation tasks (T1–T5) complete.
- [ ] Required validation commands pass (`node --test` full suite green; `node --check` clean on
      every changed `.js`).
- [ ] Each required effect is present and wired to the correct game event: explosion particles ←
      `explosion`, screen shake ← `rowClear`, spawn fade-in ← `spawn`, danger-line pulse ← elapsed
      time (structural review; visible confirmation is the deferred manual DoD, CF-01).
- [ ] Effects are event-driven from the model and **do not alter simulation outcomes** — the
      Phase 02–03 core tests still pass **unchanged** (regression).
- [ ] Particle counts are **capped** per the performance budget: `explosionParticleCount` never
      exceeds `config.particles.maxConcurrent`, asserted by a unit test (R5).
- [ ] Debug stabilization completed.
- [ ] Review completed with `accept` (correctness + structural).
- [ ] No invariant violations introduced (INV-1..8 preserved; core-purity scan still green).
- [ ] Carry-forward items from Phase 04 (CF-01, CF-02, CF-03) were explicitly evaluated (§10).
- [ ] All remediation loops resolved (loop review `accept`), if any are opened.

---

## 4. Task Inventory (Canonical Scope)

Every build, debug, and review node traces back to a task here. No lane may invent work outside
this inventory.

### T1 — Pure effects helpers (`effects.js`)
- Task ID: T1
- Type: implementation
- Description: Implement `src/render/effects.js`, a **pure, Phaser/DOM-free** module (imports
  cleanly under plain Node; no `Phaser`/`window`/`document` reference) with:
  - `dangerPulse(timeSeconds, config)` → `{ alpha, scaleY }`. Compute
    `u = (sin(2π · config.effects.dangerPulse.frequencyHz · timeSeconds) + 1) / 2` ∈ [0,1], then
    `alpha = lerp(minAlpha, maxAlpha, u)` and `scaleY = lerp(minScaleY, maxScaleY, u)` from the
    `config.effects.dangerPulse` endpoints. Non-negative `timeSeconds`; deterministic.
  - `explosionParticleCount(outcome, config)` → integer. Map `'greater' → countGreater`,
    `'lesser' → countLesser`, `'exact' → countExact` from `config.effects.explosion`; any other
    value → `0`. Clamp the result to `[0, config.particles.maxConcurrent]` (R5 budget).
  - House convention: named exports plus a `default` export bundle.
- Files / Areas: `src/render/effects.js` (new).
- Outputs: `src/render/effects.js`.
- Test Intent (`unit`): `dangerPulse` output stays within the configured `[min,max]` bands for a
  sweep of times; equals the mid-band at `t = 0` (sin 0 = 0 ⇒ u = 0.5); repeats with period
  `1 / frequencyHz`. `explosionParticleCount` returns the exact per-outcome counts, returns the
  budget cap when a configured count would exceed `config.particles.maxConcurrent` (assert via a
  cloned config with an inflated count), returns integers, and returns `0` for an unknown outcome.
- Validation Commands: `node --test test/effects.test.js`; `node --check src/render/effects.js`.
- Dependencies: none (parallel root).

### T2 — Effects helper tests (`effects.test.js`)
- Task ID: T2
- Type: test
- Description: Author `test/effects.test.js` implementing the T1 Test Intent with specific-value
  and property assertions (band bounds, `t=0` midpoint, periodicity, per-outcome counts, cap
  enforcement, integer type, unknown-outcome `0`).
- Files / Areas: `test/effects.test.js` (new).
- Outputs: `test/effects.test.js`.
- Test Intent (`unit`): as above; suite is green under `node --test`.
- Validation Commands: `node --test test/effects.test.js`.
- Dependencies: T1 (same node — implementation + its only test stay together).

### T3 — Additive `config.effects` block
- Task ID: T3
- Type: implementation
- Description: Extend `src/core/config.js` with an **additive** `effects` block. Suggested first-pass
  values (all tunable): `dangerPulse: { frequencyHz: 1.2, minAlpha: 0.55, maxAlpha: 1.0,
  minScaleY: 0.85, maxScaleY: 1.25 }`; `spawnFadeMs: 260`; `shake: { durationMs: 220,
  intensity: 0.012 }`; `explosion: { countGreater: 14, countLesser: 10, countExact: 28,
  lifespanMs: 420, speedMin: 120, speedMax: 380, scaleStart: 0.9, scaleEnd: 0 }`. Change **no**
  existing value and introduce **no** forbidden substring (`phaser`/`document`/`window`) so the
  INV-1 core-purity scan and every existing `test/config.test.js` assertion stay green. Reuse the
  existing `config.particles.maxConcurrent` as the cap (do not duplicate it).
- Files / Areas: `src/core/config.js` (additive only).
- Outputs: `src/core/config.js`.
- Test Intent (`unit`, regression): `test/config.test.js` passes unchanged; the INV-1 purity scan
  in that suite still reports zero violations.
- Validation Commands: `node --test test/config.test.js`; `node --check src/core/config.js`.
- Dependencies: none (same node as T1/T2 — see node plan; `effects.js` and its tests read these
  values).

### T4 — Neon particle texture (`neon.js`)
- Task ID: T4
- Type: implementation
- Description: Add a neutral-white neon **particle** texture to `src/render/neon.js`: export a
  `TEX_PARTICLE` key constant and a `generateParticle(scene)` generator (a small soft glowing
  disc/spark, white so it tints per-instance), following the existing idempotent generate-once
  pattern; add it to the `TEXTURE_KEYS` bundle and call it from `generateTextures(scene)`. May use
  the `Phaser` global (render layer; INV-1 scopes only `src/core/`). Do **not** import or apply the
  value/outcome tint mapping (the scene tints at emit time) — this keeps the texture root
  independent of the effects-helper root.
- Files / Areas: `src/render/neon.js`.
- Outputs: `src/render/neon.js`.
- Test Intent: Phaser-coupled — no headless class. Gate: `node --check src/render/neon.js` parses,
  and the full `node --test` suite (incl. the INV-1 scan) remains green as regression.
- Validation Commands: `node --check src/render/neon.js`.
- Dependencies: none (parallel root).

### T5 — GameScene juice wiring (`GameScene.js`)
- Task ID: T5
- Type: implementation
- Description: Wire the effects into `src/scenes/GameScene.js` — presentation only, never mutating
  model state (INV-3):
  - In `create()`: store the danger-line image on a field (currently an unstored `this.add.image`);
    construct **one reusable** particle emitter from `TEX_PARTICLE` (non-emitting, exploded on
    demand) using `config.effects.explosion` for lifespan/speed/scale.
  - In `update()`, after advancing the model (and also on the frozen game-over frame), drain
    `const events = this.model.consumeEvents()` and dispatch:
    - `explosion` → `emitter.explode(explosionParticleCount(e.outcome, config), e.x, e.y)`, tinting
      particles by outcome/value; the count is already budget-capped (R5).
    - `rowClear` → `this.cameras.main.shake(config.effects.shake.durationMs,
      config.effects.shake.intensity)`.
    - `spawn` → record the spawned `row` so bricks in that row start at `alpha = 0` and tween to
      `1` over `config.effects.spawnFadeMs` when their sprite is first created in `_renderBricks`
      (initial seeded rows emit no `spawn` event and therefore do not fade).
  - Each frame, set the stored danger line's `alpha` and `scaleY` from
    `dangerPulse(state.time, config)`.
  - Preserve the existing per-frame brick/bomb `valueToTint` refresh (partial-damage tint, INV-7)
    unchanged.
  - Import `effects.js` helpers and the `TEX_PARTICLE` key. Do **not** add game rules, read
    wall-clock for simulation, or drain/inspect state other than through `getState()` /
    `consumeEvents()`.
- Files / Areas: `src/scenes/GameScene.js`.
- Outputs: `src/scenes/GameScene.js`.
- Test Intent: Phaser-coupled — no headless class. Gate: `node --check src/scenes/GameScene.js`
  parses; the full `node --test` suite remains green (proves no core/model regression); structural
  review confirms each effect binds to the correct event and INV-3 (no state mutation) holds. Visible
  correctness is the deferred manual DoD (CF-01).
- Validation Commands: `node --check src/scenes/GameScene.js`; `node --test`.
- Dependencies: T1/T3 (imports `effects.js` helpers + `config.effects`), T4 (uses `TEX_PARTICLE`).

### T6 — Debug stabilization
- Task ID: T6
- Type: validation
- Description: Run the full validation gate, diagnose any failures, apply bounded in-scope repairs,
  rerun to green, and record results in the stabilization report.
- Files / Areas: `phase-05/stabilization-report.md`; bounded repairs within T1–T5 scope only.
- Outputs: `phase-05/stabilization-report.md`.
- Test Intent (`unit` + regression `integration`/`contract`): full `node --test` green (99 prior
  tests **unchanged** + the new `effects` unit tests); `node --check` clean on every changed `.js`;
  INV-1 core-purity scan green.
- Validation Commands: see §7.2.
- Dependencies: T1–T5.

---

## 5. Task Breakdown (Human Organization)

This is a single-repo (Takumi-Playable), front-end-only feature; there is no backend/frontend split.

### 5.1 Backend Tasks
- None (no backend in this playable).

### 5.2 Frontend Tasks
- Pure render helpers + tests + config:
  - Task IDs: T1, T2, T3
  - Files/Areas: `src/render/effects.js`, `test/effects.test.js`, `src/core/config.js` (additive)
  - Notes: the only headlessly-testable logic in the phase; isolates the pulse math and the R5
    particle-budget cap so they are unit-tested in true independence.
  - Depends on: none (parallel root).
- Neon particle texture:
  - Task ID: T4
  - Files/Areas: `src/render/neon.js`
  - Notes: neutral-white texture; independent of the helper root (no shared seam).
  - Depends on: none (parallel root).
- GameScene juice wiring:
  - Task ID: T5
  - Files/Areas: `src/scenes/GameScene.js`
  - Notes: convergence node — imports the helpers/config (T1/T3) and the texture key (T4).
  - Depends on: T1/T3, T4.

### 5.3 Cross-Cutting Tasks
- Debug stabilization:
  - Task ID: T6
  - Files/Areas: full validation gate; `stabilization-report.md`
  - Depends on: T1–T5.

---

## 6. Dependency Notes (Human Explanation)

- The pure-helper node (T1–T3) and the particle-texture node (T4) are **independent parallel
  roots**: `effects.js` emits no texture and `neon.js` consumes no helper, so forcing an order
  between them would be incidental serialization, not a real input constraint.
- The scene node (T5) has **real import dependencies** on both roots — it imports `dangerPulse` /
  `explosionParticleCount` and `config.effects` (from the helper root) and the `TEX_PARTICLE` key
  (from the texture root) — so it is the convergence point and cannot be validated until both
  roots exist.
- Debug stabilization depends on all build nodes: it runs the whole-suite regression + parse gate
  over the combined output.
- Review depends on the debug node; closure readiness depends on review recording `accept` (and any
  remediation-loop reviews accepting).

---

## 7. Validation Plan

### 7.1 Validation Classes

- `unit` — **required.** `effects.js`: `dangerPulse` band bounds / `t=0` midpoint / periodicity;
  `explosionParticleCount` per-outcome counts, budget-cap enforcement (R5), integer type,
  unknown-outcome `0`. Plus the `config.test.js` regression (additive block does not break existing
  assertions or the INV-1 scan).
- `integration` — **required (as regression).** No new headless integration file. The Phase 02–03
  integration suite runs under `node --test` and must pass **unchanged**, proving the render-only
  effects did not alter any simulation outcome (Phase 05 exit criterion). This is the project's own
  higher-level test expressed as integration validation.
- `contract` — **required (as regression).** No new contract test; the `GameModel` public/event
  shape is unchanged and remains covered by the Phase 03 contract tests. Effects only **consume**
  the existing `explosion`/`spawn`/`rowClear` event shape.

The Phaser-coupled modules (`neon.js`, `GameScene.js`) cannot be imported under `node:test`
(they reference the `Phaser` global at definition time), so their gate is `node --check` (parse) +
the whole-suite regression + the deferred manual DoD (CF-01) — the same pattern Phase 04 used.

### 7.2 Validation Commands

- Unit tests: `node --test test/effects.test.js` · `node --test test/config.test.js`
- Integration tests (regression): `node --test` (full suite — the Phase 02–03 simulation +
  integration suites must remain green and unchanged)
- Contract tests (regression): covered by the full `node --test` run (Phase 03 `GameModel` API/event
  tests)
- Migrations / reset steps: none
- Seed steps: none
- Build / lint: `node --check src/render/effects.js` · `node --check src/render/neon.js` ·
  `node --check src/scenes/GameScene.js` · `node --check src/core/config.js`

All required commands must pass before the phase may exit.

### 7.3 Completion Artifact Validation

All node work concludes with a `takumi_complete` call carrying a valid completion artifact
(`schema_version: 1`, matching `node_id`/`run_id`, terminal `status`, `outcome`, `summary`,
`directives`). Required directives: `close_node` (all lanes); `record_repo_changes` with real
40-char SHAs when commits are made. Validated by CompletionService against the `AGENTS.md` schema.

### 7.4 Debug Stabilization Contract

Debug executes §7.2, diagnoses failures, applies bounded repairs **within T1–T5 scope**, reruns to
green, and repeats until pass or a stop condition. Debug must not introduce new feature work.

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** (never defer to a loop) when: an
architecture invariant (INV-1..8) cannot be satisfied without a design change (e.g. an effect
appears to require mutating model state or reading time inside the core, contradicting INV-1/INV-3);
required functionality is missing in a way needing a design decision; or an existing Phase 01–04
test would have to change to go green (a regression signalling a design issue, not a local repair).

Debug may apply bounded stabilization, or defer to a `remediation_loop` for a **bounded,
build-fixable** defect, when: more than 3 repair cycles hit the same failure class; the same
failure repeats after repair. A `node --check` parse failure or a failing **new** `effects` unit
test is a bounded in-scope repair, not a block. The manual DoD browser check (CF-01) is a human
step and is **not** a debug stop condition — debug has no browser and must not block on it.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it validates correctness + scope compliance, validation
evidence, and structural integrity / invariant preservation (INV-1..8; especially INV-3 — the scene
mutates no model state — and the regression proof that Phase 02–03 outcomes are unchanged). If
review finds a blocking in-scope defect it opens one or more `remediation_loop`s
(`build → debug → review`) that rejoin at resolve. The phase closes only when the phase review and
every loop review record `accept`. Loops are bounded (`max_self_recurrence: 5`); on exhaustion with
issues remaining, review escalates `status: blocked`.

### 7.7 Edge Cases to Validate

- `explosionParticleCount` when a configured per-outcome count exceeds
  `config.particles.maxConcurrent` → returns the cap (not the configured value) (R5).
- `explosionParticleCount('gameover' | unknown)` → `0` (no burst for non-collision events).
- `dangerPulse` at `t = 0` → mid-band `alpha`/`scaleY`; over a full period stays within
  `[minAlpha,maxAlpha]` / `[minScaleY,maxScaleY]` and never negative.
- A `spawn` event fades in only the newly spawned row; the initial seeded rows (no `spawn` event)
  render at full alpha immediately.
- Multiple `explosion` events drained in one frame (bomb cascade) reuse the single emitter rather
  than allocating a new one per event (TDD §7 reuse).
- Draining `consumeEvents()` on the frame game-over is reached still fires the final
  explosion/rowClear before the scene freezes.
- Regression: with effects wired, `node --test` reports the identical Phase 02–03 pass set with no
  test file edited.

---

## 8. Environment Contract

**No runtime environment required for automated validation.** The entire gate runs with local Node
commands (`node --test`, `node --check`) that import no Phaser and need no server, browser, or
network. The only environment that would exercise the *visible* effects is a mobile-portrait
browser, and that is the **deferred manual DoD** (CF-01) — not part of this phase's automated
validation and not a debug stop condition.

---

## 9. Risk Touchpoints

- Risk ID: **R5 — Mobile performance under particle/glow load** (primary; status Open for Phase 05).
  - Mitigation in this phase: reuse a single particle emitter and the generated-once `TEX_PARTICLE`
    (no per-event allocation, TDD §7); cap every explosion burst via `explosionParticleCount`,
    clamped to `config.particles.maxConcurrent`, with the cap asserted by a unit test. Residual
    frame-rate feel on real devices remains a manual-playtest item (browser phases; ties to CF-01).
- Risk ID: **R3 — Phaser scenes are hard to unit-test** (Mitigated structurally; residual manual).
  - Mitigation in this phase: the phase's real logic (pulse math + budget cap) is extracted into
    the pure `effects.js` and unit-tested; the scene stays a thin, parse-checked adapter with no
    rules and no model-state mutation (INV-3).
- Invariant threats: INV-1 (core purity — no Phaser/DOM enters `src/core/`; the additive
  `config.effects` block adds no forbidden token and the purity scan stays green), INV-3 (scene
  never mutates model state — only `getState()`/`consumeEvents()` reads), INV-8 (the screen-shake
  trigger consumes the existing `rowClear` event; the model's collision fidelity is unchanged).

---

## 10. Carry Forward Consumption

Prior phase Phase 04 has `../phase-04/32-carry-forward.md` with three open items — each addressed:

- Carry Forward ID: **CF-01** — execute the mobile-portrait browser boot/play walkthrough.
  - Source: Phase 01 manual DoD item, re-evaluated by Phase 04 plan §10 and review.
  - Disposition: **Deferred again.**
  - Rationale: This phase adds the visible juice, which enlarges what the manual DoD should observe
    (explosions, shake, spawn fade, danger pulse). But the headless execution lane has **no
    browser**, so it cannot run the walkthrough or verify actual canvas rendering/feel. The check
    remains a human step; per the Phase 04 carry-forward it lands no later than the Phase 06 final
    DoD walkthrough, now covering the Phase 05 effects.
  - Related Task IDs: none (structural review of T5 confirms each effect binds to the correct event;
    visible confirmation is the human step).

- Carry Forward ID: **CF-02** — remove the pre-existing empty `Test.txt`.
  - Source: Phase 01 review advisory, re-deferred by Phase 04.
  - Disposition: **Deferred again.**
  - Rationale: Phase 05 touches only the render/effects surface and contains no repository-cleanup
    task; `Test.txt` has no runtime effect. Removing unrelated tracked content during effects work
    would obscure provenance. Recommended for Phase 06 final integration cleanup (unchanged).
  - Related Task IDs: none.

- Carry Forward ID: **CF-03** — debug-only warning for unknown `src/main.js` scale tokens.
  - Source: Phase 01 review advisory + code review, re-deferred by Phase 04.
  - Disposition: **Deferred again.**
  - Rationale: Phase 05 does not edit `src/main.js` or its scale-token boundary; its accepted
    fallback remains safe. Adding an observability warning without touching that boundary would be
    unscoped churn. Recommended for the next phase that edits `src/main.js` scale handling, else
    Phase 06 cleanup (unchanged).
  - Related Task IDs: none.

Rules honored: every open carry-forward item is addressed explicitly; none is silently ignored;
each deferral states why it remains out of this phase's render-only scope.

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES (INV-1..8).
- Any invariant modifications: NONE. Effects are render-only; no core module, rule, or event shape
  changes.
- Risk register regression concerns: NONE new. R5 is actively mitigated (emitter reuse + asserted
  particle cap); R3 mitigated by extracting pulse/budget logic into a tested pure module.
- Deferred work impact review: CF-01 re-deferred (no browser in lane; scope now includes Phase 05
  visuals); CF-02 and CF-03 re-deferred (files untouched this phase). See §10.
- Prior carry-forward reviewed: YES (`../phase-04/32-carry-forward.md`).
- Carry-forward items brought into scope this phase: NONE.
- Carry-forward items deferred again: CF-01, CF-02, CF-03.

---

## 12. Phase Closure Contract

Required base sequence: **build → debug → review → resolve.**

Build roots (parallel): `P05-BUILD-EFFECTS-CORE` (T1–T3) and `P05-BUILD-NEON-PARTICLE` (T4) →
converge on `P05-BUILD-EFFECTS-WIRE` (T5) → `P05-DEBUG-STABILIZE` (T6) → `review` → `resolve`
(`review`/`resolve` come from the `delivery_loop`).

Review is the single closure gate. If it requests changes, each remediation loop it opens runs in
parallel and rejoins at resolve. The phase exits only when the phase review records `accept` and
every remediation-loop review records `accept`. Only then does resolve reconcile artifacts and
close the phase.
