# Phase 04 — Review (Rendering & Input Binding)

**Node:** `ef323933-2bed-4059-a7d1-ef4c953d7ce5` (Phase Review — closure gate)
**Traces to:** `12-phase-plan.md` (Task Inventory T1–T7), `13-node-plan.md`, `10-tdd.md` §4.1/§4.3/§4.4, `phase-03/32-carry-forward.md` (CF-01, CF-04)
**Prior stage:** `00f911f2-…` Phase 04 DEBUG-STABILIZE (accepted, first-pass green)

---

## 1. Review Summary

**Verdict:** **`accept`.** No blocking correctness, completeness, or structural findings. The phase delivers the smallest safe render/input slice per plan: two pure Phaser-free helpers with headless unit coverage (`tint.js`, `loop.js`), a procedural neon texture factory that generates once at boot (`neon.js` + Boot wiring), and a thin `GameScene` that binds the accepted `GameModel` to Phaser (read-only rendering, `fixedSteps`-bounded ticks, and a pointer→`dropBomb` forwarder). Full suite is 99/99 green (85 core regression + 7 tint + 7 loop); every changed `.js` parses clean under `node --check`; INV-1 core-purity scan still green. INV-3/INV-5/INV-7 preserved and actively exercised.

The single remaining Phase 04 exit item is the **manual DoD browser check (CF-01)** — deliberately outside every automated gate because no headless node can boot a browser. Its automated preconditions (parseable Phaser modules + green regression + preserved invariants) are satisfied.

---

## 2. Task Completion Status

| Task | Type | Expected Outputs | Status | Evidence |
|---|---|---|---|---|
| **T1** — `valueToTint(value, config)` | implementation | `src/render/tint.js` (named + default export) | ✅ | File present, 62 LoC, `node --check` OK; imports only its args (Phaser-free) |
| **T2** — Tint mapping unit tests | test | `test/tint.test.js` (endpoints, monotonic, clamp, integer channels) | ✅ | 7 assertions all pass; imports the real `config` |
| **T3** — `fixedSteps(dtSeconds, maxStep)` + `config.loop` | implementation | `src/render/loop.js`, additive `config.loop: { maxStepSeconds: 0.05 }` | ✅ | File present, 47 LoC, pure; `config.loop` present, no asserted Phase 01–03 value touched |
| **T4** — Fixed-timestep unit tests | test | `test/loop.test.js` (sum, per-sub-step bound, zero/negative, spike, CF-04) | ✅ | 7 assertions all pass; CF-04 guarantee pinned via real config |
| **T5** — Neon procedural textures + Boot wiring | implementation | `src/render/neon.js`, updated `src/scenes/BootScene.js` | ✅ | Both parse; four texture keys exported (background, brick, bomb, danger-line); brick/bomb bodies emitted neutral white for per-instance `setTint`; each generator guarded by `textures.exists` (generate-once, TDD §7); Boot invokes `generateTextures(this)` in `create()` before `scene.start('GameScene')` |
| **T6** — `GameScene` model/render/input binding | implementation | Rewritten `src/scenes/GameScene.js` | ✅ | Parses; constructs `GameModel({ config, rng: createRng(Date.now()) })`; splits `delta/1000` via `fixedSteps(dt, config.loop.maxStepSeconds)`; renders from `getState()` only; reconciles brick sprites by id; forwards `pointer.worldX` to `model.dropBomb`; freezes on `status === 'gameover'`; does not drain `consumeEvents()` |
| **T7** — Stabilization & full validation | validation | `stabilization-report.md` | ✅ | Report committed; documents 99/99 pass and 6/6 clean parse checks; zero repairs required |

Everything in §2/§4 of the phase plan is delivered; nothing in §2 Out-of-Scope leaked in.

---

## 3. Implementation Quality Assessment

### `src/render/tint.js` (T1)
- Pure ES module, no Phaser/DOM references.
- Clamp is a simple `min/max` ternary — INV-7 bounds honoured for out-of-range inputs.
- Per-channel linear interpolation with `Math.round`; endpoint fidelity holds by construction (`t=0` reproduces `low`, `t=1` reproduces `high`).
- Degenerate `min === max` guarded (`t = 0`).
- Named + default export (`default { valueToTint }`) per house convention.

### `src/render/loop.js` (T3)
- Pure ES module, no Phaser/DOM references.
- Three-branch split (`dt <= 0` / `dt <= maxStep` / large) matches the spec exactly.
- `n = ceil(dt/maxStep)` guarantees per-sub-step size `dt/n ≤ maxStep`; `n` copies sum to `dt` (float-exact for the pattern).
- Named + default export.

### `src/render/neon.js` (T5)
- Uses only the render-layer-authorised `Phaser` global (via `scene.make.graphics`, `scene.textures`); no `document`/`window`.
- Idempotent generators: each `generate*` early-returns on `textures.exists(KEY)` — TDD §7 generate-once satisfied.
- Brick and bomb bodies are emitted **neutral white** (`WHITE = 0xffffff`), as required — the scene tints per-instance at render time. This is the seam that lets `NEON-ART` sit independent of `RENDER-CORE`.
- Background may use `config.tint.low` for the accent bloom (correctly noted as *not* per-instance tinted — the background is a static full-screen image and does not participate in the value→tint mapping).
- Texture-key constants exported both individually and as a `TEXTURE_KEYS` bundle — stable, discoverable contract.

### `src/scenes/BootScene.js` (T5)
- Minimal: single-purpose `create()` that calls `generateTextures(this)` then `scene.start('GameScene')`. No other side effects.

### `src/scenes/GameScene.js` (T6)
- **Model construction** in `create()`: exactly one `GameModel({ config, rng: createRng(Date.now()) })`. Wall-clock seed is deliberate render-layer session variety; INV-2 constrains only `src/core/` (plan §T6 explicit).
- **Rendering** is snapshot-based (`const state = this.model.getState()`) — model state is never mutated by the scene (INV-3). Snapshots are the frozen, non-aliasing objects `simulation.js` returns.
- **Brick reconciliation** uses a keyed `Map<brickId, sprite>` with a `seen` set: create-on-demand for new alive bricks, `setPosition` + `setTint(valueToTint(brick.value, config))` for existing sprites, `destroy` + `delete` for bricks no longer alive/present. This is the reuse pattern the plan requires (no per-frame recreation).
- **Bomb rendering** uses a single sprite, `setVisible(false)` when `bomb === null`, `setVisible(true)` + `setPosition` + `setTint(valueToTint(bomb.value, config))` when active. Efficient reuse.
- **Fixed timestep**: `dt = delta / 1000`; `for (const step of fixedSteps(dt, config.loop.maxStepSeconds)) this.model.tick(step)` — CF-04 preserved by construction.
- **Freeze on game-over**: `update` skips ticking when `state.status === 'gameover'` (still renders the last snapshot); `pointerdown` guards against dropping while gameover. The final-frame overlay + CTA is correctly deferred to Phase 06.
- **Input**: `pointer.worldX` → `model.dropBomb(x)`. Under `Scale.FIT` + `CENTER_BOTH`, `worldX` is in the 720×1280 game space; model handles column snap + cooldown (INV-5).
- **Score readout**: minimal top-left monospace, driven from `state.score` (which is the numeric total exposed by `getState()`). Juice/typography polish is Phase 05 scope.
- Does **not** drain `consumeEvents()` — juice deferred to Phase 05.

**No scope creep.** Nothing outside the T5/T6 output surface was modified. `main.js`, `index.html`, vendor, all `src/core/*` files, and every `test/*.test.js` file except the two new suites are untouched — confirmed by inspection.

---

## 4. Test Coverage Assessment

Per skill `test-design` (call `takumi_get_skill("test-design")` for details): tests must fail meaningfully and cover the requirement, not merely execute the module.

### `test/tint.test.js` (7 tests)
- **Named & default export shape** — the house-convention API surface is asserted.
- **Endpoint fidelity** — `valueToTint(brickMin)` equals `config.tint.low` exactly; `valueToTint(brickMax)` equals `config.tint.high` exactly. Specific integers, not truthiness.
- **Monotonic green→red across the full [1,30] range** — INV-7 asserted per-value, per-channel (red non-decreasing, green non-increasing).
- **Strict end-to-end monotonicity** — rejects a degenerate flat mapping.
- **Out-of-range clamp** — both sides, near and far.
- **Integer channels in [0,255]** — swept across the range and beyond.
- **24-bit integer envelope** — midpoint colour fits in `0..0xffffff`.

Uses the **real** production `config`, so a wrong endpoint constant would break the test — no risk of the test tracking a stale duplicate of `config`.

### `test/loop.test.js` (7 tests)
- **Named & default export shape.**
- **Non-positive dt** — zero and both a small and a large negative.
- **dt ≤ maxStep** — both strictly below and exactly equal — returns a single-element array whose element equals the input.
- **Just-above-maxStep** — 0.06/0.05 → 2 sub-steps, each ≤ maxStep, sum = dt.
- **Large spike** — 0.5 s (tab-defocus scenario) → exactly 10 sub-steps at maxStep 0.05, each ≤ maxStep, sum = dt.
- **Range sweep** — 9 deltas spanning 1 ms → 2.5 s; sum invariance and per-sub-step bound asserted for every one.
- **CF-04 guarantee, pinned to real config** — `config.bomb.fallSpeed * config.loop.maxStepSeconds` computed from production tunables, asserted `< config.grid.rowHeight`, AND pinned to the exact first-pass number `45`. If a future edit weakens the fallSpeed/maxStep/rowHeight relationship the assertion breaks.

Both suites read the real `config`. Assertions are specific values (not merely `> 0` / `!== null`), so they do not weaken to pass. Meets the plan's *"specific-value assertions"* requirement and the `test-design` requirement-to-test linkage.

**Regression coverage.** All 85 Phase 01–03 tests remain green. No pre-existing test was modified. INV-1 core-purity scan in `test/config.test.js` still passes (ok 9).

**Untested surface (explicit).** `neon.js`, `BootScene.js`, and `GameScene.js` cannot be `import`ed under `node:test` — they reference `Phaser` at class/definition time. Their gate is `node --check` (parse) plus the manual DoD browser check (CF-01). This is the plan-recognized boundary (§7.1 note and node-plan §2 for `NEON-ART`/`SCENE-BIND`), not a coverage gap. The scene is kept thin (INV-3 preserved) so the untested surface is bounded and non-logical.

---

## 5. Validation Results

Reviewer independently reran the full gate on the current branch head (no cached results relied upon):

### 5.1 `node --test` — full suite

```
# tests 99
# suites 0
# pass 99
# fail 0
```

Breakdown: 85 (Phases 01–03, regression, unchanged) + 7 (`tint`) + 7 (`loop`) = 99. Matches the stabilization report.

### 5.2 `node --check` on every changed `.js`

| File | Result |
|---|---|
| `src/render/tint.js` | OK |
| `src/render/loop.js` | OK |
| `src/render/neon.js` | OK |
| `src/scenes/BootScene.js` | OK |
| `src/scenes/GameScene.js` | OK |
| `src/main.js` | OK |

### 5.3 INV-1 core-purity scan

The `INV-1: no src/core/ module references phaser, document, or window` subtest of `test/config.test.js` is green (subtest `ok 9`). Independent grep over `src/core/` confirms no `phaser`, `document`, or `window` reference. New Phaser code lives strictly in `src/render/neon.js` and `src/scenes/*.js`.

### 5.4 Failure classification

No failures to classify. Per skill `failure-classification` (call `takumi_get_skill("failure-classification")` for the routing rule): no implementation failure, no test-regression failure, no environment failure. No remediation loop required on validation grounds.

---

## 6. Structural Evaluation

Applied the five-dimension rubric from skill `code-review-rubric` (call `takumi_get_skill("code-review-rubric")` for details) against the delivered code. Every finding is judged against the design in `10-tdd.md` and `12-phase-plan.md`, not personal preference.

### 6.1 Invariant compliance
- **INV-1 (core purity):** New Phaser code lives only in `src/render/neon.js` and `src/scenes/*.js`. The two new pure helpers under `src/render/` remain Phaser/DOM-free (they use only their arguments and standard `Math`). Automated scan green.
- **INV-2 (deterministic randomness):** `GameScene` seeds the RNG with `Date.now()`. INV-2 scopes only `src/core/`; the render layer is explicitly allowed to seed from the clock (plan §T6, TDD Q on session variety). No `Math.random` inside `src/core/`.
- **INV-3 (one-way state ownership):** `GameScene` only reads `model.getState()` snapshots (which are `Object.freeze`'d in `simulation.js:305–334`) and calls the four public model methods (`dropBomb`, `tick`, `getState`, `consumeEvents` — though the last is not called this phase). No direct field mutation. Confirmed by inspection.
- **INV-5 (bomb cooldown):** Scene forwards `pointer.worldX` to `model.dropBomb`. The cooldown gate + one-bomb constraint is enforced inside `dropBomb` (`simulation.js:141–144`). No scene-side timing.
- **INV-7 (value & tint bounds):** Value bounds are enforced by the accepted model; the tint mapping is the new pure helper, unit-tested for monotonicity and endpoint fidelity across the full [1,30] range. Brick tint is derived from *current* `brick.value` each frame, so partial-damage bricks correctly show their reduced-value colour (TDD PRD Q3 decision).

**No invariant violations.**

### 6.2 Contract conformance
The `GameModel ↔ render` contract (TDD §4.3) is preserved: `new GameModel({ config, rng })`, `dropBomb(x)`, `tick(dtSeconds)`, `getState()`, `consumeEvents()`, `reset()`. The scene consumes it faithfully — no field access outside the documented snapshot shape (`bricks[]`, `bomb`, `score`, `status`), no timing decisions in the scene.

The `neon.js` module exports a stable public contract: `generateTextures(scene)` plus the four `TEX_*` constants and the `TEXTURE_KEYS` bundle. `GameScene` imports the named constants — no string-literal texture keys leak into the scene.

### 6.3 Architectural drift
None. The delivered layering matches TDD §4.1 exactly:
- `src/core/` — Phaser-free simulation (untouched this phase).
- `src/render/` — Phaser-free pure helpers (`tint.js`, `loop.js`) AND the Phaser-coupled texture factory (`neon.js`).
- `src/scenes/` — thin Phaser scenes.

Additive `config.loop` block sits under `src/core/config.js` and doesn't change any Phase 01–03 asserted value (`test/config.test.js` still green).

### 6.4 Hidden coupling / boundary leakage
- No leak of Phaser into `src/core/` (INV-1 scan).
- No leak of the tint mapping into `neon.js` — the factory emits neutral white and never imports `tint.js`, keeping the `RENDER-CORE` ↔ `NEON-ART` seam clean (as required by the node-plan §2 independence contract).
- `GameScene` imports `columnCenterX` from the core (allowed — pure geometry helper). It does not import any model-internal helper (`_advanceBomb`, `_seedInitialRows`, etc.). It reads `config.grid.rowHeight` for sprite centring — this is a design constant already public.
- No timers, no `setTimeout`, no wall-clock in `src/core/` (INV-2 preserved).

### 6.5 Validation blind spots
- The Phaser-coupled modules (`neon.js`, `BootScene.js`, `GameScene.js`) have no headless unit test — this is a plan-recognized boundary, mitigated by the thinness of the scene and the CF-01 manual DoD browser check. Not a blind spot the tests could hide (parsing is verified; logic-bearing code is in the pure helpers, which are tested).
- The tint & loop tests use specific-value assertions and the real production `config`, so a weakened assertion or a stale test-side copy of the constants would not go undetected.
- No skipped, `xtest`, or `.only` markers in the two new suites.

**Summary: zero blocking structural findings. Two advisory-only notes captured in `40-code-review.md`.**

---

## 7. Issues Found

**None blocking.** No `changes_requested` conditions met. Two advisory-only observations (non-blocking, do not open a remediation loop — recorded in `40-code-review.md` for the record only):

- **ADV-1:** `pendingEvents` accumulates unbounded across a session because Phase 04 correctly does not drain `consumeEvents()` (juice is Phase 05). At the observed event rate (spawns every 2.5 s, collisions on tap) and a ~30–45 s session, memory impact is negligible; Phase 05 will drain the queue as designed. This is by explicit scope, not a defect.
- **ADV-2:** `pointerdown` guards against `status === 'gameover'` before calling `dropBomb`, even though `dropBomb` itself returns `false` when `status !== 'playing'` (`simulation.js:141`). Belt-and-suspenders; not incorrect and consistent with the plan's *"stop accepting input"* wording. No action required.

Neither observation blocks phase closure or warrants a remediation loop (an advisory does not clear the loop's cost bar — three additional agent runs + full revalidation for a non-defect would be pure churn).

---

## 8. Manual DoD / Deferred Items

**Manual DoD (CF-01) — human step, not automatable.** All automated preconditions listed by the plan §3 Manual DoD are satisfied:
- Every Phaser module parses (`node --check` OK).
- Full test regression + new unit suites green (99/99).
- INV-1 core-purity scan green.
- Model construction path (Boot → GameScene → `new GameModel(...)`) is present and imports resolve.

The actual browser boot + tap + rise-to-gameover verification remains an operator step, re-deferred consistent with plan §10 (CF-01 disposition) and stabilization report §Outstanding.

**CF-02** (remove `Test.txt`) and **CF-03** (main.js scale-token warning) — re-deferred per plan §10; correctly untouched this phase (out of scope for a rendering phase).

**CF-04** — discharged in scope via `fixedSteps` + `config.loop.maxStepSeconds`; the CF-04 travel-vs-row-height assertion is pinned in `test/loop.test.js` (`travelPerTick === 45`).

---

## 9. Recommendation

**`accept`.**

Phase 04 satisfies every automated closure criterion:
- All seven tasks (T1–T7) delivered per plan; no scope creep, no out-of-scope files touched.
- 99/99 tests pass (85 Phase 01–03 regression unchanged + 14 new unit tests).
- Every changed `.js` parses clean under `node --check`.
- INV-1..8 preserved; INV-3/INV-5/INV-7 actively and correctly exercised.
- CF-04 fully discharged; CF-01 automated preconditions met, manual step re-deferred to human DoD.
- No blocking correctness, completeness, or structural findings.

The single closure gate is cleared. No `remediation_loop` is required (the two advisory observations do not clear the loop's cost bar). Downstream `resolve` may proceed with documentation reconciliation and next-phase determination.

**No ADR emission.** No material architectural decision was reached or changed during this review — the design was set in earlier phases (TDD §4.1/§4.3/§4.4) and the plan absorbs CF-04 within the accepted architecture (a pure helper, not a boundary change). No new decision meets both the "architecturally significant" and "hard-to-reverse" bar.
