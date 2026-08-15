# Node Plan: Phase 04 — Rendering & Input Binding

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 04
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Rules

This document defines the authoritative execution sub-graph planning materializes via
`phase_execution_set`: the `build` and `debug` nodes. `review` and `resolve` come from the
`delivery_loop` and attach automatically after this sub-graph. Aliases are stable identifiers;
dependencies reference aliases only. Each node is a strict execution scope and must not expand
beyond its Work Packet. Every node traces to Task Inventory scope in `12-phase-plan.md`.

**Decomposition rationale.** Phase 04 splits into **two parallel build roots** that converge on the
scene binding — a diamond, not a chain:

- `P04-BUILD-RENDER-CORE` owns the two **pure, Phaser-free** helper modules (`tint.js`, `loop.js`)
  and their `node:test` suites. This is the phase's only headlessly-validatable logic (INV-7 tint +
  CF-04 delta safety), so it is isolated where it can be unit-tested in true independence. The two
  helpers share one validation surface (`node --test` over two pure files) and are each ~one small
  function, so they stay in one node — splitting two ~30-line pure functions would add handoff cost
  beyond the resilience it buys (lower-bound rule).
- `P04-BUILD-NEON-ART` owns the Phaser texture factory (`neon.js`) plus its Boot wiring. It emits
  **neutral** textures and does **not** consume the tint mapping (tinting is applied at render time
  in the scene), so it shares no seam with RENDER-CORE and runs concurrently — a forced dependency
  would be incidental serialization, not a real input constraint.
- `P04-BUILD-SCENE-BIND` (`GameScene.js`) has **real** input dependencies on both roots: it imports
  `valueToTint` + `fixedSteps` (RENDER-CORE) and uses `neon.js`'s texture keys (NEON-ART). It is the
  convergence point and cannot be validated until both roots exist.

The Phaser-coupled nodes (NEON-ART, SCENE-BIND) cannot be imported under `node:test` (they reference
the `Phaser` global at class/definition time), so their gate is `node --check` (parse) plus the
manual DoD browser check — the same pattern Phase 01 used for the shell. Keeping them thin (INV-3)
bounds the untested surface.

---

## 2. Node List

### `P04-BUILD-RENDER-CORE`
- Alias: `P04-BUILD-RENDER-CORE`
- Lane: `lane:build`
- Title: `lane:build Phase 04 Build: Pure Render Helpers (tint + fixed-timestep)`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 neon tint helper, §4.3 collision-overlap note, §4.4 INV-7)
  - `./12-phase-plan.md` (T1, T2, T3, T4)
  - `../phase-03/32-carry-forward.md` (CF-04)
  - `src/core/config.js` (`values.brickMin/brickMax`, `tint.low/high`, `bomb.fallSpeed`,
    `grid.rowHeight`; read-only except the additive `loop` block below)
- Outputs (paths):
  - `src/render/tint.js`
  - `src/render/loop.js`
  - `src/core/config.js` (additive `loop: { maxStepSeconds: 0.05 }` block only)
  - `test/tint.test.js`
  - `test/loop.test.js`
- Work Packet (strict scope):
  - Implement **T1**: `valueToTint(value, config)` in `src/render/tint.js` — clamp `value` to
    `[config.values.brickMin, config.values.brickMax]`, linearly interpolate each RGB channel from
    `config.tint.low` (at min) to `config.tint.high` (at max), return integer `0xRRGGBB`. Pure,
    Phaser/DOM-free (must import cleanly under plain Node). Named export `valueToTint` + `default`.
  - Implement **T2**: `test/tint.test.js` — endpoints equal `config.tint.low`/`config.tint.high`;
    across `value = 1..30` red channel non-decreasing and green channel non-increasing (INV-7);
    out-of-range clamps; channels integer in `[0,255]`. Specific-value assertions.
  - Implement **T3**: `fixedSteps(dtSeconds, maxStep)` in `src/render/loop.js` — return sub-step
    durations summing to `dtSeconds` (float tolerance), each `≤ maxStep`; `dtSeconds <= 0` → `[]`;
    `0 < dtSeconds <= maxStep` → `[dtSeconds]`; larger → `ceil(dtSeconds/maxStep)` near-equal
    sub-steps. Pure, Phaser/DOM-free. Named export `fixedSteps` + `default`. Extend `config.js` with
    an **additive** `loop: { maxStepSeconds: 0.05 }` block (so `bomb.fallSpeed*0.05 = 45 <
    grid.rowHeight 120`, CF-04) — change **no** value asserted by `test/config.test.js`.
  - Implement **T4**: `test/loop.test.js` — sum preserved; each sub-step `≤ maxStep`; zero/negative
    → `[]`; `dt = maxStep` → single element; large spike (e.g. 0.5 s) → expected count; and
    `config.bomb.fallSpeed * config.loop.maxStepSeconds < config.grid.rowHeight` using the real
    config (CF-04 guarantee).
  - House convention: each module has a named export plus a `default` export.
  - Do **not** touch scenes, `neon.js`, `main.js`, `index.html`, vendor, or any existing asserted
    `config.js` value; do not import Phaser or the DOM in either module.
- Validation Commands:
  - `node --test test/tint.test.js`
  - `node --test test/loop.test.js`
  - `node --test test/config.test.js`
  - `node --check src/render/tint.js`
  - `node --check src/render/loop.js`
- Validation Classes:
  - `unit`

### `P04-BUILD-NEON-ART`
- Alias: `P04-BUILD-NEON-ART`
- Lane: `lane:build`
- Title: `lane:build Phase 04 Build: Neon Texture Factory & Boot Wiring`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Neon Art Factory, §7 caching)
  - `./12-phase-plan.md` (T5)
  - `src/core/config.js` (`design`, `grid`, `tint`, read-only)
  - `src/scenes/BootScene.js` (current), `vendor/phaser.min.js` (Phaser API reference, read-only)
- Outputs (paths):
  - `src/render/neon.js`
  - `src/scenes/BootScene.js` (updated to invoke the factory)
- Work Packet (strict scope):
  - Implement **T5**: `src/render/neon.js` exporting `generateTextures(scene)` and named
    texture-key constants. Procedurally create + register via Phaser Graphics → `generateTexture`:
    (a) background gradient + glow, (b) a **neutral white** brick-body texture with a neon
    border/glow suited to per-instance `setTint`, (c) a neutral bomb texture, (d) a danger-line
    texture. Generate each texture **once** (reuse thereafter — TDD §7). May use the `Phaser` global
    (render layer; INV-1 applies only to `src/core/`).
  - Update `src/scenes/BootScene.js` to call `generateTextures(this)` in `create()` before
    `this.scene.start('GameScene')`.
  - Emit neutral (untinted) textures only — do **not** import or apply the tint mapping (that is the
    scene's job at render time); this keeps NEON-ART independent of RENDER-CORE.
  - Do **not** touch `GameScene.js`, `tint.js`, `loop.js`, `main.js`, `index.html`, vendor, or
    `config.js`.
- Validation Commands:
  - `node --check src/render/neon.js`
  - `node --check src/scenes/BootScene.js`
- Validation Classes:
  - (Phaser-coupled — no headless class; parse-checked + manual DoD. Regression gate `node --test`
    must remain green, verified in `P04-DEBUG-STABILIZE`.)

### `P04-BUILD-SCENE-BIND`
- Alias: `P04-BUILD-SCENE-BIND`
- Lane: `lane:build`
- Title: `lane:build Phase 04 Build: GameScene Model/Render/Input Binding`
- Priority: `1`
- Depends On:
  - `P04-BUILD-RENDER-CORE`
  - `P04-BUILD-NEON-ART`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Render/Input Layer, §4.3 GameModel API, §4.4 INV-3/INV-5/INV-7)
  - `./12-phase-plan.md` (T6)
  - `../phase-03/32-carry-forward.md` (CF-01, CF-04)
  - `src/render/tint.js`, `src/render/loop.js` (from RENDER-CORE)
  - `src/render/neon.js` (texture keys, from NEON-ART)
  - `src/core/simulation.js` (`GameModel`), `src/core/rng.js` (`createRng`), `src/core/grid.js`
    (`columnCenterX`), `src/core/config.js` — all read-only
- Outputs (paths):
  - `src/scenes/GameScene.js` (rewritten)
- Work Packet (strict scope):
  - Implement **T6**: rewrite `src/scenes/GameScene.js` as the model↔Phaser adapter:
    - In `create()`, construct one `GameModel({ config, rng })` with `rng = createRng(seed)`; choose
      the seed in the scene (render layer — a wall-clock/time-based seed is allowed here; INV-2
      constrains only `src/core/`). Draw the neon background and a **static** danger line at
      `y = config.gameOver.topY`.
    - In `update(time, delta)`: `dt = delta/1000`; for each `step` of
      `fixedSteps(dt, config.loop.maxStepSeconds)` call `model.tick(step)`; skip ticking when
      `model.getState().status === 'gameover'`.
    - Render from `model.getState()` only (INV-3, read-only): one sprite per **alive** brick at
      `(columnCenterX(col, config), y + config.grid.rowHeight/2)` using the neutral brick texture
      with `setTint(valueToTint(value, config))` (so partial-damage bricks show their reduced-value
      colour); the active bomb sprite when `bomb !== null`, tinted by its value; and a minimal live
      score text from `state.score`. Reconcile sprites to state each frame (keyed map or pool;
      hide/destroy sprites for dead/removed bricks) — do not recreate all sprites per frame.
    - Input: on `pointerdown`, call `model.dropBomb(pointer.worldX)` and nothing else — the model
      owns column snapping + the cooldown/one-bomb gate (INV-5). Under `Scale.FIT`+`CENTER_BOTH`,
      pointer coordinates are already in the 720×1280 game space, so forward `worldX` unchanged.
    - On `status === 'gameover'`, stop advancing the model and accepting input; leave the final frame
      rendered (overlay + restart CTA is Phase 06).
    - Do **not** drain `consumeEvents()` and do **not** add juice/effects (Phase 05). Never mutate
      model state except through model methods (INV-3). May use the `Phaser` global.
  - Do **not** touch `neon.js`, `tint.js`, `loop.js`, `BootScene.js`, `main.js`, `index.html`,
    vendor, `config.js`, or any `src/core/*` file.
- Validation Commands:
  - `node --check src/scenes/GameScene.js`
  - `node --test` (regression — the full core suite must remain green after adding the scene)
- Validation Classes:
  - (Phaser-coupled — no headless class for the scene itself; parse-checked + manual DoD. The
    column-snap + cooldown gate it relies on is covered by the Phase 03 `simulation` suite as
    regression.)

### `P04-DEBUG-STABILIZE`
- Alias: `P04-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 04 Debug: Render & Input Stabilization`
- Priority: `1`
- Depends On:
  - `P04-BUILD-RENDER-CORE`
  - `P04-BUILD-NEON-ART`
  - `P04-BUILD-SCENE-BIND`
- Inputs (paths):
  - `./12-phase-plan.md`, `./13-node-plan.md`
  - `src/render/tint.js`, `src/render/loop.js`, `src/render/neon.js`
  - `src/scenes/BootScene.js`, `src/scenes/GameScene.js`, `src/core/config.js`
  - `test/tint.test.js`, `test/loop.test.js`, and the existing `test/*.test.js` suite
- Outputs (paths):
  - `stabilization-report.md`
- Work Packet (strict scope):
  - Implement **T7**: run the full validation gate, diagnose failures, apply bounded in-scope
    repairs, and rerun to green:
    - `node --test` — the complete suite: the existing 85 core tests must remain unchanged/green as
      regression, plus the new `tint`/`loop` unit tests.
    - `node --check` on every changed `.js`: `src/render/tint.js`, `src/render/loop.js`,
      `src/render/neon.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`, and `src/main.js`.
    - Confirm the INV-1 core-purity scan inside `test/config.test.js` still passes (no Phaser/DOM in
      `src/core/`).
  - Record results and any repairs in the stabilization report.
- Validation Commands:
  - `node --test`
  - `node --check src/render/tint.js`
  - `node --check src/render/loop.js`
  - `node --check src/render/neon.js`
  - `node --check src/scenes/BootScene.js`
  - `node --check src/scenes/GameScene.js`
  - `node --check src/main.js`
- Validation Classes:
  - `unit`
  - `integration`
  - `contract`

### Debug Scope
Stabilizes the combined Phase 04 build output (pure helpers + neon factory + scene binding) within
the referenced build scope. Executes `node --test` and the `node --check` parse gate, diagnoses,
repairs within scope, reruns to green.

### Allowed Repair Surface
- Small logic bugs in `tint.js` / `loop.js` (channel-lerp rounding, off-by-one in step counting,
  sum/boundary handling).
- Test fixture, seed, or assertion-setup issues in `test/tint.test.js` / `test/loop.test.js`.
- Syntax/parse errors in the Phaser modules (`neon.js`, `BootScene.js`, `GameScene.js`) surfaced by
  `node --check` (typos, bad imports, malformed texture-key usage).
- Bounded render-wiring fixes wholly within `GameScene.js`/`neon.js` scope (wrong texture key,
  wrong `getState` field, missing `fixedSteps` loop) that do not change the model or its API.
- Additive-only `config.loop` correction if `maxStepSeconds` fails the CF-04 travel-vs-row-height
  assertion.

### Stop Conditions
Debug must escalate (`status: blocked`) — or defer to a remediation loop only for a bounded,
build-fixable defect — if:
- more than 3 repair cycles occur on the same failure class,
- an architecture invariant (INV-1..8) cannot be satisfied without a design change (e.g. the scene
  cannot render correctly without mutating model state, contradicting INV-3),
- a fix requires new feature scope or an out-of-scope file (juice, GameOverScene, model changes),
- an existing Phase 01–03 test would have to change to go green (signals a regression that needs a
  design decision, not a local repair).

Note: a `node --check` parse failure or a failing new unit test is a bounded in-scope repair, not a
block. The manual DoD browser check (CF-01) is a human step and is **not** a debug stop condition —
debug cannot run a browser and must not block on it.

---

## 3. Validation Classes

- `unit` — `valueToTint` monotonic green→red + endpoint fidelity (INV-7); `fixedSteps` sub-step
  bounds/sum + CF-04 travel-vs-row-height guarantee.
- `integration` — no new headless integration file; the Phase 02–03 integration suite runs as
  regression under `node --test`, and the tap→column-snap + cooldown gate the scene relies on is
  covered there.
- `contract` — none new; the `GameModel` public API/event shape is unchanged and covered by the
  Phase 03 contract tests (regression).

Phaser-coupled modules cannot be imported under `node:test`; their gate is `node --check` (parse) +
the manual DoD browser check. All headless commands run via `node --test` / `node --check`.

---

## 4. Example Build Node

(See `P04-BUILD-RENDER-CORE`, `P04-BUILD-NEON-ART`, and `P04-BUILD-SCENE-BIND` in §2 — concrete,
not illustrative.)

---

## 5. Example Debug Node

(See `P04-DEBUG-STABILIZE` in §2 — concrete, not illustrative.)

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
P04-BUILD-RENDER-CORE ─┐
                       ├─→ P04-BUILD-SCENE-BIND ─→ P04-DEBUG-STABILIZE ─→ review ─→ resolve
P04-BUILD-NEON-ART ────┘
```

- Build nodes are defined here (two parallel roots converging on SCENE-BIND); `review` (closure
  gate) and `resolve` come from the `delivery_loop`.
- `review` depends on all debug nodes (`P04-DEBUG-STABILIZE`).
- `resolve` depends on `review` (and on any remediation-loop review nodes that rejoin).

---

## 8. Graph Constraints

- The graph is a DAG; no cycles.
- Dependencies reference declared aliases only.
- `P04-BUILD-RENDER-CORE` and `P04-BUILD-NEON-ART` are independent parallel roots (no shared seam).
- `P04-BUILD-SCENE-BIND` depends on both roots (real input dependency: imports `valueToTint` /
  `fixedSteps` and uses `neon.js` texture keys).
- `P04-DEBUG-STABILIZE` depends on all three build nodes.
- Review depends on all debug nodes; resolve depends on review.

---

## 9. Priority Contract

All nodes use priority `1` (High) — Phase 04 unblocks the visible/playable product and the
remaining render-track phases (05, 06). All priorities are within `0-4`.
