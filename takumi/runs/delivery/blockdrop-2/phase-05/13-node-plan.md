# Node Plan: Phase 05 — Game Feel Effects

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 05
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Rules

This document defines the authoritative execution sub-graph planning materializes via
`phase_execution_set`: the `build` and `debug` nodes. `review` and `resolve` come from the
`delivery_loop` and attach automatically after this sub-graph. Aliases are stable identifiers;
dependencies reference aliases only. Each node is a strict execution scope and must not expand
beyond its Work Packet. Every node traces to Task Inventory scope (T1–T6) in `12-phase-plan.md`.

**Decomposition rationale.** Phase 05 mirrors the proven Phase 04 **diamond** — two parallel build
roots converging on the scene binding, then a stabilize node:

- `P05-BUILD-EFFECTS-CORE` owns the phase's only **pure, Phaser-free, headlessly-validatable**
  logic: the `effects.js` helpers (`dangerPulse` math + `explosionParticleCount` budget cap, R5),
  their `node:test` suite, and the **additive** `config.effects` tunables the helpers read. Isolated
  here so it is unit-tested in true independence. The two helpers share one validation surface
  (`node --test` over one pure file) and are each one small function, so they stay in one node —
  splitting two ~15-line pure functions from their only test would add handoff cost beyond the
  resilience it buys (lower-bound rule).
- `P05-BUILD-NEON-PARTICLE` owns the single neutral-white particle texture added to `neon.js`. It
  emits a **neutral** texture and does **not** consume any effects helper (the scene tints particles
  at emit time), so it shares no seam with EFFECTS-CORE and runs concurrently — a forced dependency
  would be incidental serialization, not a real input constraint.
- `P05-BUILD-EFFECTS-WIRE` (`GameScene.js`) has **real** input dependencies on both roots: it
  imports `dangerPulse` / `explosionParticleCount` + `config.effects` (EFFECTS-CORE) and the
  `TEX_PARTICLE` key (NEON-PARTICLE). It is the convergence point and cannot be validated until both
  roots exist.

The Phaser-coupled nodes (NEON-PARTICLE, EFFECTS-WIRE) cannot be imported under `node:test` (they
reference the `Phaser` global at class/definition time), so their gate is `node --check` (parse) +
the whole-suite `node --test` regression + the manual DoD browser check (CF-01) — the same pattern
Phases 01 and 04 used. Keeping them thin (INV-3) bounds the untested surface.

The phase changes **no** `src/core/` logic and **no** `GameModel` API/event shape, so the entire
Phase 02–03 suite (85 tests) plus the Phase 04 helper tests (14) run as **unchanged regression** —
their staying green with effects wired is the phase's proof that render-only juice did not alter any
simulation outcome.

---

## 2. Node List

### `P05-BUILD-EFFECTS-CORE`
- Alias: `P05-BUILD-EFFECTS-CORE`
- Lane: `lane:build`
- Title: `lane:build Phase 05 Build: Pure Effects Helpers (danger pulse + particle budget) & config`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.3 GameModel event API, §7 particle-budget/reuse, §4.4 INV-1/INV-3/INV-7)
  - `../30-risk-register.md` (R5 particle cap, R3 Phaser testability)
  - `./12-phase-plan.md` (T1, T2, T3)
  - `src/core/config.js` (`particles.maxConcurrent`, `tint`, read-only except the additive
    `effects` block below)
  - `test/config.test.js` (the asserted values + INV-1 purity scan that must stay green)
  - `src/render/tint.js`, `src/render/loop.js` (existing pure-helper convention reference, read-only)
- Outputs (paths):
  - `src/render/effects.js`
  - `test/effects.test.js`
  - `src/core/config.js` (additive `effects: { ... }` block only)
- Work Packet (strict scope):
  - Implement **T1**: `src/render/effects.js`, pure and Phaser/DOM-free (must import cleanly under
    plain Node; no `Phaser`/`window`/`document`):
    - `dangerPulse(timeSeconds, config)` → `{ alpha, scaleY }`: with
      `u = (Math.sin(2*Math.PI*config.effects.dangerPulse.frequencyHz*timeSeconds)+1)/2`, return
      `alpha = minAlpha + u*(maxAlpha-minAlpha)` and `scaleY = minScaleY + u*(maxScaleY-minScaleY)`
      from `config.effects.dangerPulse`. Deterministic; handles `timeSeconds >= 0`.
    - `explosionParticleCount(outcome, config)` → integer: `'greater'→countGreater`,
      `'lesser'→countLesser`, `'exact'→countExact` from `config.effects.explosion`; any other value
      → `0`; clamp the result to `[0, config.particles.maxConcurrent]` (R5).
    - Named exports plus a `default` export bundle.
  - Implement **T2**: `test/effects.test.js` — `dangerPulse` stays within the configured
    `[minAlpha,maxAlpha]` / `[minScaleY,maxScaleY]` bands over a time sweep, equals the mid-band at
    `t=0` (sin 0 ⇒ u=0.5), and repeats with period `1/frequencyHz`; `explosionParticleCount` returns
    the exact per-outcome counts, returns the cap when a cloned config inflates a count above
    `particles.maxConcurrent`, returns integers, and returns `0` for an unknown outcome
    (e.g. `'gameover'`).
  - Implement **T3**: extend `src/core/config.js` with an **additive** `effects` block —
    `dangerPulse: { frequencyHz: 1.2, minAlpha: 0.55, maxAlpha: 1.0, minScaleY: 0.85,
    maxScaleY: 1.25 }`, `spawnFadeMs: 260`, `shake: { durationMs: 220, intensity: 0.012 }`,
    `explosion: { countGreater: 14, countLesser: 10, countExact: 28, lifespanMs: 420,
    speedMin: 120, speedMax: 380, scaleStart: 0.9, scaleEnd: 0 }`. Change **no** existing value,
    add **no** forbidden substring (`phaser`/`document`/`window`), and reuse the existing
    `config.particles.maxConcurrent` as the cap (do not duplicate it) — so every `test/config.test.js`
    assertion and the INV-1 core-purity scan stay green.
  - House convention: named export plus a `default` export.
  - Do **not** touch scenes, `neon.js`, `tint.js`, `loop.js`, `main.js`, `index.html`, vendor, or
    any `src/core/*` file other than the additive `config.effects` block; do not import Phaser or the
    DOM in `effects.js`.
- Validation Commands:
  - `node --test test/effects.test.js`
  - `node --test test/config.test.js`
  - `node --check src/render/effects.js`
  - `node --check src/core/config.js`
- Validation Classes:
  - `unit`

### `P05-BUILD-NEON-PARTICLE`
- Alias: `P05-BUILD-NEON-PARTICLE`
- Lane: `lane:build`
- Title: `lane:build Phase 05 Build: Neon Particle Texture`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Neon Art Factory, §7 generate-once/reuse)
  - `./12-phase-plan.md` (T4)
  - `src/render/neon.js` (current — existing generator pattern + `TEXTURE_KEYS` bundle)
  - `src/core/config.js` (`design`, `grid`, read-only), `vendor/phaser.min.js` (Phaser Graphics API
    reference, read-only)
- Outputs (paths):
  - `src/render/neon.js` (add `TEX_PARTICLE` + `generateParticle`, wire into `generateTextures`)
- Work Packet (strict scope):
  - Implement **T4**: add a neutral-white neon **particle** texture to `src/render/neon.js` —
    export a `TEX_PARTICLE = 'neon-particle'` key constant, add it to the `TEXTURE_KEYS` bundle,
    and add a `generateParticle(scene)` generator following the existing idempotent
    (`if (scene.textures.exists(...)) return;`) generate-once pattern: a small soft glowing
    disc/spark drawn white (so it tints per-instance at emit time), e.g. concentric fading discs +
    a bright core, sized ~16–24 px. Call `generateParticle(scene)` from `generateTextures(scene)`.
    May use the `Phaser` global (render layer; INV-1 applies only to `src/core/`).
  - Emit a **neutral** (untinted) texture only — do **not** import or apply any value/outcome tint
    mapping (the scene tints particles at emit time); this keeps NEON-PARTICLE independent of
    EFFECTS-CORE.
  - Do **not** touch `GameScene.js`, `BootScene.js`, `effects.js`, `tint.js`, `loop.js`, `main.js`,
    `index.html`, vendor, or `config.js`.
- Validation Commands:
  - `node --check src/render/neon.js`
- Validation Classes:
  - (Phaser-coupled — no headless class; parse-checked + manual DoD. The whole-suite `node --test`
    regression gate is verified in `P05-DEBUG-STABILIZE`.)

### `P05-BUILD-EFFECTS-WIRE`
- Alias: `P05-BUILD-EFFECTS-WIRE`
- Lane: `lane:build`
- Title: `lane:build Phase 05 Build: GameScene Juice Wiring (events → effects)`
- Priority: `1`
- Depends On:
  - `P05-BUILD-EFFECTS-CORE`
  - `P05-BUILD-NEON-PARTICLE`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Render/Input Layer, §4.3 `consumeEvents` API, §4.4 INV-3/INV-7, §7 reuse)
  - `./12-phase-plan.md` (T5)
  - `../phase-04/32-carry-forward.md` (CF-01)
  - `src/render/effects.js`, `src/core/config.js` (`config.effects`) — from EFFECTS-CORE
  - `src/render/neon.js` (`TEX_PARTICLE`) — from NEON-PARTICLE
  - `src/scenes/GameScene.js` (current), `src/core/simulation.js` (event shape, read-only reference),
    `vendor/phaser.min.js` (particle emitter / camera-shake / tween API reference, read-only)
- Outputs (paths):
  - `src/scenes/GameScene.js` (juice wiring added)
- Work Packet (strict scope):
  - Implement **T5**: add event-driven juice to `src/scenes/GameScene.js` — presentation only,
    never mutating model state (INV-3):
    - In `create()`: store the danger-line image on a field (it is currently an unstored
      `this.add.image(...)`); create **one reusable** particle emitter from `TEX_PARTICLE`
      (non-emitting / `emitting: false`, exploded on demand) configured from `config.effects.explosion`
      (`lifespanMs`, `speedMin`/`speedMax`, `scaleStart`→`scaleEnd`). Track a set/map of spawned row
      ids for fade-in.
    - In `update(time, delta)`, after the existing tick loop (and also execute this on the frozen
      game-over frame so the final burst plays), drain `const events = this.model.consumeEvents()`
      and dispatch each:
      - `explosion` → `emitter.explode(explosionParticleCount(e.outcome, config), e.x, e.y)`; tint
        the particles by outcome/value (e.g. `valueToTint`-style or a per-outcome colour). Count is
        already budget-capped (R5).
      - `rowClear` → `this.cameras.main.shake(config.effects.shake.durationMs,
        config.effects.shake.intensity)`.
      - `spawn` → record `e.row` so bricks in that row start at `alpha = 0` and tween to `1` over
        `config.effects.spawnFadeMs` when their sprite is first created in `_renderBricks`.
    - Each frame, set the stored danger line's `alpha` and `scaleY` from
      `dangerPulse(state.time, config)` (read-only `state.time`).
    - In `_renderBricks`, when creating a new brick sprite whose `row` is in the spawned-row set,
      start it at `alpha = 0` and tween to `1` over `spawnFadeMs`; initial seeded rows (no `spawn`
      event) render at full alpha.
    - **Preserve** the existing per-frame `setTint(valueToTint(...))` on bricks and bomb (partial-
      damage tint, INV-7) and the existing tick/reconcile/input logic unchanged.
    - Import the `effects.js` helpers and the `TEX_PARTICLE` key. Read model state only through
      `getState()` / `consumeEvents()`; never mutate model state or add game rules; do not read
      wall-clock for simulation (INV-3, INV-1 spirit). May use the `Phaser` global.
  - Do **not** touch `neon.js`, `effects.js`, `tint.js`, `loop.js`, `BootScene.js`, `main.js`,
    `index.html`, vendor, `config.js`, or any `src/core/*` file.
- Validation Commands:
  - `node --check src/scenes/GameScene.js`
  - `node --test` (regression — the full core + helper suite must remain green after wiring)
- Validation Classes:
  - (Phaser-coupled — no headless class for the scene itself; parse-checked + manual DoD. The
    event shape it consumes and the no-mutation model contract are covered by the Phase 03
    `simulation` suite as regression.)

### `P05-DEBUG-STABILIZE`
- Alias: `P05-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 05 Debug: Effects Stabilization`
- Priority: `1`
- Depends On:
  - `P05-BUILD-EFFECTS-CORE`
  - `P05-BUILD-NEON-PARTICLE`
  - `P05-BUILD-EFFECTS-WIRE`
- Inputs (paths):
  - `./12-phase-plan.md`, `./13-node-plan.md`
  - `src/render/effects.js`, `src/render/neon.js`, `src/scenes/GameScene.js`, `src/core/config.js`
  - `test/effects.test.js`, `test/config.test.js`, and the existing `test/*.test.js` suite
- Outputs (paths):
  - `stabilization-report.md`
- Work Packet (strict scope):
  - Implement **T6**: run the full validation gate, diagnose failures, apply bounded in-scope
    repairs, and rerun to green:
    - `node --test` — the complete suite: the existing 99 tests (Phase 02–03 core/integration +
      Phase 04 tint/loop) must remain **unchanged/green** as regression, plus the new `effects`
      unit tests.
    - `node --check` on every changed `.js`: `src/render/effects.js`, `src/render/neon.js`,
      `src/scenes/GameScene.js`, `src/core/config.js`.
    - Confirm the INV-1 core-purity scan inside `test/config.test.js` still passes (no Phaser/DOM in
      `src/core/`, including the additive `config.effects` block).
  - Record results and any repairs in the stabilization report.
- Validation Commands:
  - `node --test`
  - `node --check src/render/effects.js`
  - `node --check src/render/neon.js`
  - `node --check src/scenes/GameScene.js`
  - `node --check src/core/config.js`
- Validation Classes:
  - `unit`
  - `integration`
  - `contract`

### Debug Scope
Stabilizes the combined Phase 05 build output (pure effects helpers + particle texture + scene
juice wiring) within the referenced build scope. Executes `node --test` and the `node --check`
parse gate, diagnoses, repairs within scope, reruns to green.

### Allowed Repair Surface
- Small logic bugs in `effects.js` (sine/lerp math in `dangerPulse`, outcome mapping or clamp in
  `explosionParticleCount`).
- Test fixture, cloned-config, or assertion-setup issues in `test/effects.test.js`.
- Additive-only `config.effects` correction (a value the helpers/tests require) that changes **no**
  value asserted by `test/config.test.js` and adds no forbidden token.
- Syntax/parse errors in the Phaser modules (`neon.js`, `GameScene.js`) surfaced by `node --check`
  (typos, bad imports, wrong texture-key usage).
- Bounded render-wiring fixes wholly within `GameScene.js`/`neon.js` scope (wrong texture key,
  wrong `consumeEvents` field, emitter reused incorrectly, tween/shake parameter mistakes) that do
  not change the model or its API.

### Stop Conditions
Debug must escalate (`status: blocked`) — or defer to a remediation loop only for a bounded,
build-fixable defect — if:
- more than 3 repair cycles occur on the same failure class,
- an architecture invariant (INV-1..8) cannot be satisfied without a design change (e.g. an effect
  appears to require mutating model state or reading time in the core, contradicting INV-1/INV-3),
- a fix requires new feature scope or an out-of-scope file (GameOverScene, model/event changes,
  `main.js`, `Test.txt`),
- an existing Phase 01–04 test would have to change to go green (signals a regression that needs a
  design decision, not a local repair).

Note: a `node --check` parse failure or a failing **new** `effects` unit test is a bounded in-scope
repair, not a block. The manual DoD browser check (CF-01) is a human step and is **not** a debug
stop condition — debug cannot run a browser and must not block on it.

---

## 3. Validation Classes

- `unit` — `dangerPulse` band bounds / `t=0` midpoint / periodicity; `explosionParticleCount`
  per-outcome counts, R5 budget-cap enforcement, integer type, unknown-outcome `0`; plus the
  `config.test.js` regression (additive block breaks nothing, INV-1 scan green).
- `integration` — no new headless integration file; the Phase 02–03 integration suite runs as
  **regression** under `node --test` and must pass unchanged, proving the render-only effects did
  not alter any simulation outcome.
- `contract` — none new; the `GameModel` public API/event shape is unchanged and covered by the
  Phase 03 contract tests (regression). Effects only consume the existing
  `explosion`/`spawn`/`rowClear` event shape.

Phaser-coupled modules cannot be imported under `node:test`; their gate is `node --check` (parse) +
the whole-suite regression + the manual DoD browser check. All headless commands run via
`node --test` / `node --check`.

---

## 4. Example Build Node

(See `P05-BUILD-EFFECTS-CORE`, `P05-BUILD-NEON-PARTICLE`, and `P05-BUILD-EFFECTS-WIRE` in §2 —
concrete, not illustrative.)

---

## 5. Example Debug Node

(See `P05-DEBUG-STABILIZE` in §2 — concrete, not illustrative.)

---

## 6. Remediation Loops (Runtime, Not Predefined)

Not part of this base sub-graph. Any `build`, `debug`, or `review` node may open a `remediation_loop`
(`build → debug → review`, rejoining at `resolve`) at closure for a blocking, in-scope,
bounded-fixable defect. Loops run in parallel with the rest of the graph and are bounded by
`max_self_recurrence: 5`; on exhaustion with issues remaining, the loop's review escalates with
`status: blocked`. Do not add remediation nodes to this document.

---

## 7. Base Execution Order

```
P05-BUILD-EFFECTS-CORE ──┐
                         ├─→ P05-BUILD-EFFECTS-WIRE ─→ P05-DEBUG-STABILIZE ─→ review ─→ resolve
P05-BUILD-NEON-PARTICLE ─┘
```

- Build nodes are defined here (two parallel roots converging on EFFECTS-WIRE); `review` (closure
  gate) and `resolve` come from the `delivery_loop`.
- `review` depends on all debug nodes (`P05-DEBUG-STABILIZE`).
- `resolve` depends on `review` (and on any remediation-loop review nodes that rejoin).

---

## 8. Graph Constraints

- The graph is a DAG; no cycles.
- Dependencies reference declared aliases only.
- `P05-BUILD-EFFECTS-CORE` and `P05-BUILD-NEON-PARTICLE` are independent parallel roots (no shared
  seam: `effects.js` emits no texture, `neon.js` consumes no helper).
- `P05-BUILD-EFFECTS-WIRE` depends on both roots (real input dependency: imports `dangerPulse` /
  `explosionParticleCount` + `config.effects` and uses the `TEX_PARTICLE` key).
- `P05-DEBUG-STABILIZE` depends on all three build nodes.
- Review depends on all debug nodes; resolve depends on review.

---

## 9. Priority Contract

All nodes use priority `1` (High) — Phase 05 delivers the last required visual layer and unblocks
the Phase 06 session-close phase. All priorities are within `0-4`.
