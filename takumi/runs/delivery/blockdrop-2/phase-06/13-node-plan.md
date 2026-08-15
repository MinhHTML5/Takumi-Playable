# Node Plan: Phase 06 — Game-Over Screen & Restart CTA

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 06
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Rules

This document defines the authoritative execution sub-graph planning materializes via
`phase_execution_set`: the `build` and `debug` nodes. `review` and `resolve` come from the
`delivery_loop` and attach automatically after this sub-graph. Aliases are stable identifiers;
dependencies reference aliases only. Each node is a strict execution scope and must not expand
beyond its Work Packet. Every node traces to Task Inventory scope (T1–T8) in `12-phase-plan.md`.

**Decomposition rationale.** Phase 06 is the final integration phase and reuses the proven
render-phase pattern: isolate the phase's genuine headless logic into pure/tested roots, keep the
Phaser-coupled scene wiring thin and parse-checked, and converge on a stabilize node.

- `P06-BUILD-CORE` owns the phase's only **pure, headlessly-validatable presentation logic**: the
  `gameOverLayout(config)` helper (game-over screen geometry) with its `node:test` suite, plus the
  **additive** `config.gameOver.screen` tunables the helper and scene read. The helper and its only
  test stay in one node (lower-bound rule — do not separate a change from its only test), and the
  additive config lives with them because they are its only consumers this phase.
- `P06-BUILD-RESTART-CONTRACT` owns the **headless restart-equivalence integration test**
  (`test/restart.integration.test.js`) proving INV-6 for the re-construction/reset mechanism the
  scene uses. It imports only the accepted `src/core/` model — it neither produces nor consumes any
  render output — so it is an **independent parallel root**; forcing an order versus CORE would be
  incidental serialization, not a real input constraint.
- `P06-BUILD-GAMEOVER-SCENE` owns the new `GameOverScene.js` (fade-in overlay, final score, fake
  `Play` CTA → fresh restart) and its `main.js` registration (+ CF-03 scale-token warning). It has a
  **real** import dependency on CORE (`gameOverLayout` + `config.gameOver.screen`), so it converges
  after CORE.
- `P06-BUILD-GAMEOVER-TRANSITION` owns the `GameScene.js` change (once-only launch of
  `GameOverScene` at game-over + clean-restart field re-init). It has a **real** dependency on the
  scene node: it launches the `'GameOverScene'` key and passes the `{ score }` init-data contract
  that scene consumes, so the scene must exist first (prevents contract drift on the mutual
  scene↔scene loop).

The Phaser-coupled nodes (GAMEOVER-SCENE, GAMEOVER-TRANSITION, and the `main.js` edit) cannot be
imported under `node:test` (they reference the `Phaser` global at class/definition time), so their
gate is `node --check` (parse) + the whole-suite `node --test` regression + the manual DoD browser
check (CF-01, plan §13) — the same pattern Phases 01/04/05 used. Keeping them thin (INV-3) bounds the
untested surface.

The phase changes **no** `src/core/` logic and **no** `GameModel` API/event shape (the only
`src/core/` edit is the additive `config.gameOver.screen` data block), so the entire Phase 02–05
suite (108 tests) runs as **unchanged regression** — its staying green with the game-over/restart
wiring in place is the phase's proof that the render-only close-out did not alter any simulation
outcome.

---

## 2. Node List

### `P06-BUILD-CORE`
- Alias: `P06-BUILD-CORE`
- Lane: `lane:build`
- Title: `lane:build Phase 06 Build: Game-Over Layout Helper & config.gameOver.screen`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Render/Input Layer + GameOverScene, §4.4 INV-1/INV-7)
  - `../30-risk-register.md` (R3 Phaser testability)
  - `./12-phase-plan.md` (T1, T2, T3)
  - `src/core/config.js` (`design`, existing `gameOver.topY`, `tint` — read-only except the additive
    `gameOver.screen` block below)
  - `test/config.test.js` (the asserted values + INV-1 purity scan that must stay green)
  - `src/render/tint.js`, `src/render/effects.js` (existing pure-helper convention reference, read-only)
- Outputs (paths):
  - `src/render/gameOverLayout.js`
  - `test/gameOverLayout.test.js`
  - `src/core/config.js` (additive `gameOver.screen: { ... }` sub-block only)
- Work Packet (strict scope):
  - Implement **T1**: extend `src/core/config.js` with an **additive** `screen` sub-block under the
    existing `gameOver` key (currently `{ topY: 0 }`): `fadeMs: 500`, `overlayColor: 0x05010a`,
    `overlayAlpha: 0.72`, `title: { text: 'GAME OVER', color: '#ff1744', sizePx: 72 }`,
    `score: { prefix: 'SCORE ', color: '#39ff14', sizePx: 56 }`, `cta: { label: 'PLAY', width: 360,
    height: 132, fillColor: 0x39ff14, textColor: '#05010a', textSizePx: 60 }`. Change **no** existing
    value (including `gameOver.topY`) and add **no** forbidden substring (`phaser`/`document`/
    `window`, case-insensitive) so every `test/config.test.js` assertion and the INV-1 core-purity
    scan stay green.
  - Implement **T2**: `src/render/gameOverLayout.js`, pure and Phaser/DOM-free (must import cleanly
    under plain Node; no `Phaser`/`window`/`document`). Export `gameOverLayout(config)` →
    `{ title: {x,y}, score: {x,y}, cta: {x,y,width,height,left,top,right,bottom} }` computed from
    `config.design` and `config.gameOver.screen.cta`:
    - `title.x = score.x = cta.x = config.design.width / 2` (horizontally centred).
    - `title.y ≈ height * 0.34`, `score.y ≈ height * 0.46`, `cta.y ≈ height * 0.64` (top→bottom).
    - `cta.width/height` from `config.gameOver.screen.cta`; derive `left = x - width/2`,
      `right = x + width/2`, `top = y - height/2`, `bottom = y + height/2`; the rectangle must lie
      fully within `[0, width] × [0, height]`.
    - Deterministic, side-effect-free; named export plus a `default` export bundle.
  - Implement **T3**: `test/gameOverLayout.test.js` — title/score horizontally centred at
    `design.width/2`; CTA rect uses the configured `cta.width`/`height` and its `left/top/right/
    bottom` are consistent with its centre and size; the CTA rect lies fully within
    `[0,width] × [0,height]`; `title.y < score.y < cta.y`; all values finite numbers; two calls with
    the same config are deeply equal; a cloned config with different `design`/`cta` dimensions
    re-centres.
  - Do **not** touch scenes, `main.js`, `neon.js`, `tint.js`, `loop.js`, `effects.js`, `index.html`,
    vendor, or any `src/core/*` file other than the additive `config.gameOver.screen` block; do not
    import Phaser or the DOM in `gameOverLayout.js`.
- Validation Commands:
  - `node --test test/gameOverLayout.test.js`
  - `node --test test/config.test.js`
  - `node --check src/render/gameOverLayout.js`
  - `node --check src/core/config.js`
- Validation Classes:
  - `unit`

### `P06-BUILD-RESTART-CONTRACT`
- Alias: `P06-BUILD-RESTART-CONTRACT`
- Lane: `lane:build`
- Title: `lane:build Phase 06 Build: Restart-Equivalence Integration Test (INV-6)`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.3 GameModel API incl. `reset()`, §4.4 INV-6/INV-7)
  - `./12-phase-plan.md` (T4)
  - `src/core/simulation.js`, `src/core/config.js`, `src/core/rng.js` (accepted model — read-only)
  - `test/simulation.test.js`, `test/simulation.integration.test.js` (existing INV-6 unit test +
    drive-to-game-over pattern to mirror — read-only reference)
- Outputs (paths):
  - `test/restart.integration.test.js`
- Work Packet (strict scope):
  - Implement **T4**: `test/restart.integration.test.js` — drive a `GameModel` (seeded `rng`, a
    small config mirroring the existing integration suite, or the real `config`) to
    `status: 'gameover'` by ticking with no input, then assert the INV-6 restart contract for both
    mechanisms:
    - **Re-construction path** (what `GameScene.create()` does on CTA): construct a brand-new
      `GameModel` with the same `config` and a *different* seed; assert `getState()` is the canonical
      initial state — `status === 'playing'`, `time === 0`, `score === 0`, `bomb === null`,
      `difficultyLevel === 0`, `bricks.length === initialRows * columns`, every brick `alive`, and
      every brick `value` ∈ `[config.values.brickMin, config.values.brickMax]` (INV-7). Values need
      **not** match the played-out session (different seed) — the contract is structural.
    - **Reset path**: call `reset()` on the played-out model; assert the same canonical initial state
      (score 0, no bomb, all bricks alive, `status: 'playing'`, `time 0`).
  - Keep it additive and distinct from the existing `simulation.test.js` INV-6 unit test (which only
    covers `reset()` under an identical seed): this test covers the game-over→re-construction restart
    path the scene actually uses.
  - Do **not** edit any existing test file, any `src/` file, scenes, or config.
- Validation Commands:
  - `node --test test/restart.integration.test.js`
  - `node --test` (regression — the full suite must remain green)
- Validation Classes:
  - `integration`

### `P06-BUILD-GAMEOVER-SCENE`
- Alias: `P06-BUILD-GAMEOVER-SCENE`
- Lane: `lane:build`
- Title: `lane:build Phase 06 Build: GameOverScene (fade-in, score, Play CTA) + scene registration`
- Priority: `1`
- Depends On:
  - `P06-BUILD-CORE`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 GameOverScene, §4.4 INV-3, PRD Goals 8/9)
  - `../00-prd.md` (§3 fake `Play` CTA restarts, no external navigation/persistence)
  - `./12-phase-plan.md` (T5, T6)
  - `../phase-05/32-carry-forward.md` (CF-03)
  - `src/render/gameOverLayout.js`, `src/core/config.js` (`config.gameOver.screen`) — from CORE
  - `src/scenes/BootScene.js`, `src/scenes/GameScene.js` (scene-class convention + `'GameScene'` key,
    read-only reference), `src/main.js` (current scene list + scale-token maps),
    `vendor/phaser.min.js` (Scene / rectangle / text / tween / setInteractive API reference, read-only)
- Outputs (paths):
  - `src/scenes/GameOverScene.js` (new)
  - `src/main.js` (register `GameOverScene`; add CF-03 scale-token warning)
- Work Packet (strict scope):
  - Implement **T5**: `src/scenes/GameOverScene.js`, a new Phaser scene (key `'GameOverScene'`),
    presentation only (never constructs/mutates a `GameModel`; reads only `config` + the pure
    `gameOverLayout` helper; may use the `Phaser` global):
    - `init(data)` → `this.finalScore = (data && Number.isFinite(data.score)) ? data.score : 0`.
    - `create()` → compute `const layout = gameOverLayout(config)` and read `config.gameOver.screen`.
      Add a full-screen overlay rectangle (`this.add.rectangle(0, 0, config.design.width,
      config.design.height, screen.overlayColor).setOrigin(0, 0)`), a `screen.title.text` title at
      `layout.title`, a final-score text `${screen.score.prefix}${this.finalScore}` at
      `layout.score`, and a fake `Play` CTA (a filled `this.add.rectangle` at `layout.cta` using
      `screen.cta.fillColor`/`width`/`height` + a centred `screen.cta.label` text). Start every
      element at `alpha = 0` and tween to target alpha (overlay → `screen.overlayAlpha`, text/CTA →
      `1`) over `screen.fadeMs` (the game-over fade-in).
    - Make the CTA interactive (`setInteractive()`); on `pointerdown` restart:
      `this.scene.stop(); this.scene.start('GameScene');` — re-running `GameScene.create()`
      constructs a fresh `GameModel` (INV-6 by construction). Fake CTA: no external navigation, no
      persistence (PRD §3).
    - Draw the CTA with Phaser primitives — do **not** add a texture to `neon.js`.
  - Implement **T6**: update `src/main.js` — import `GameOverScene` and register it after
    `GameScene` (`scene: [BootScene, GameScene, GameOverScene]`). **CF-03:** when a
    `config.scale.mode`/`config.scale.autoCenter` token is absent from the `SCALE_MODE`/`AUTO_CENTER`
    maps, emit a `config.debug`-gated `console.warn` naming the unrecognised token, then fall back to
    `FIT`/`CENTER_BOTH` (the existing `??` fallback is **preserved** — warning is observability only,
    silent by default). Change nothing else in `main.js`.
  - Do **not** touch `GameScene.js`, `BootScene.js`, `gameOverLayout.js`, `neon.js`, `tint.js`,
    `loop.js`, `effects.js`, `index.html`, vendor, `config.js`, or any `src/core/*` file.
- Validation Commands:
  - `node --check src/scenes/GameOverScene.js`
  - `node --check src/main.js`
- Validation Classes:
  - (Phaser-coupled — no headless class; parse-checked + manual DoD. The whole-suite `node --test`
    regression gate is verified in `P06-DEBUG-STABILIZE`.)

### `P06-BUILD-GAMEOVER-TRANSITION`
- Alias: `P06-BUILD-GAMEOVER-TRANSITION`
- Lane: `lane:build`
- Title: `lane:build Phase 06 Build: GameScene game-over transition + clean-restart re-init`
- Priority: `1`
- Depends On:
  - `P06-BUILD-GAMEOVER-SCENE`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 Render/Input Layer, §4.3 `getState`/`consumeEvents`, §4.4 INV-3/INV-6)
  - `./12-phase-plan.md` (T7)
  - `src/scenes/GameOverScene.js` (the `'GameOverScene'` key + `{ score }` init-data contract) — from
    GAMEOVER-SCENE
  - `src/scenes/GameScene.js` (current — the freeze-on-game-over `update()`, the constructor field
    init, and the `consumeEvents()` effect dispatch to preserve)
  - `src/core/simulation.js` (game-over `status`/`score` shape, read-only reference),
    `vendor/phaser.min.js` (`scene.launch`/`scene.start` API reference, read-only)
- Outputs (paths):
  - `src/scenes/GameScene.js` (game-over transition + clean-restart field re-init added)
- Work Packet (strict scope):
  - Implement **T7**: add the game-over transition to `src/scenes/GameScene.js` — presentation only,
    never mutating model state (INV-3):
    - In `create()`, re-initialise the per-session scene fields so a `scene.start` restart begins
      clean (Phaser reuses the scene instance across restart and does **not** re-run the constructor):
      set `this.brickSprites = new Map()`, `this.bombSprite = null`, `this._fadeRows = new Set()`,
      and a new guard `this._gameOverHandled = false`. Keep the existing constructor defaults.
    - In `update()`, **after** the existing tick loop and the existing `consumeEvents()` effect
      dispatch (so the final explosion/row-clear/shake for the game-ending tick still plays this
      frame), read the latest snapshot; if `status === 'gameover'` and `!this._gameOverHandled`, set
      `this._gameOverHandled = true` and call
      `this.scene.launch('GameOverScene', { score: snapshot.score })` (launch, not start — the frozen
      neon final frame stays visible beneath the fading overlay). The guard makes the launch fire
      exactly once, not every frozen frame.
    - **Preserve** all existing behaviour unchanged: the fixed-step tick loop, the event drain, the
      danger-line pulse, brick/bomb reconciliation + `valueToTint` refresh (INV-7), the
      gameover-freeze, and the `pointerdown` no-op at game-over. Do not add game rules, read
      wall-clock for simulation, or read model state except via `getState()`/`consumeEvents()`
      (INV-3). May use the `Phaser` global.
  - Do **not** touch `GameOverScene.js`, `main.js`, `BootScene.js`, `gameOverLayout.js`, `neon.js`,
    `tint.js`, `loop.js`, `effects.js`, `index.html`, vendor, `config.js`, or any `src/core/*` file.
- Validation Commands:
  - `node --check src/scenes/GameScene.js`
  - `node --test` (regression — the full core + helper suite must remain green after wiring)
- Validation Classes:
  - (Phaser-coupled — no headless class for the scene itself; parse-checked + manual DoD. The
    game-over `status`/`score` it consumes and the no-mutation model contract are covered by the
    Phase 03 `simulation` suite as regression.)

### `P06-DEBUG-STABILIZE`
- Alias: `P06-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 06 Debug: Game-Over Stabilization + final cleanup`
- Priority: `1`
- Depends On:
  - `P06-BUILD-CORE`
  - `P06-BUILD-RESTART-CONTRACT`
  - `P06-BUILD-GAMEOVER-SCENE`
  - `P06-BUILD-GAMEOVER-TRANSITION`
- Inputs (paths):
  - `./12-phase-plan.md`, `./13-node-plan.md`
  - `src/render/gameOverLayout.js`, `src/scenes/GameOverScene.js`, `src/scenes/GameScene.js`,
    `src/main.js`, `src/core/config.js`
  - `test/gameOverLayout.test.js`, `test/restart.integration.test.js`, `test/config.test.js`, and the
    existing `test/*.test.js` suite
  - `Test.txt` (to remove — CF-02)
- Outputs (paths):
  - `stabilization-report.md`
  - `Test.txt` removed
- Work Packet (strict scope):
  - Implement **T8**:
    - **CF-02 cleanup:** remove the pre-existing empty, runtime-inert `Test.txt` (`git rm -f Test.txt`).
    - **Stabilization:** run the full validation gate, diagnose failures, apply bounded in-scope
      repairs, and rerun to green:
      - `node --test` — the complete suite: all existing Phase 02–05 tests (108) must remain
        **unchanged/green** as regression, plus the new `gameOverLayout` unit tests and the new
        `restart.integration.test.js` integration test.
      - `node --check` on every changed `.js`: `src/render/gameOverLayout.js`,
        `src/scenes/GameOverScene.js`, `src/scenes/GameScene.js`, `src/main.js`, `src/core/config.js`.
      - Confirm the INV-1 core-purity scan inside `test/config.test.js` still passes (no Phaser/DOM in
        `src/core/`, including the additive `config.gameOver.screen` block).
    - Record results, the `Test.txt` removal, and any repairs in the stabilization report.
- Validation Commands:
  - `node --test`
  - `node --check src/render/gameOverLayout.js`
  - `node --check src/scenes/GameOverScene.js`
  - `node --check src/scenes/GameScene.js`
  - `node --check src/main.js`
  - `node --check src/core/config.js`
- Validation Classes:
  - `unit`
  - `integration`
  - `contract`

### Debug Scope
Stabilizes the combined Phase 06 build output (layout helper + additive config + restart integration
test + GameOverScene + main.js registration + GameScene transition) within the referenced build
scope, and performs the CF-02 `Test.txt` cleanup. Executes `node --test` and the `node --check` parse
gate, diagnoses, repairs within scope, reruns to green.

### Allowed Repair Surface
- Small logic bugs in `gameOverLayout.js` (centring math, CTA edge derivation, on-screen bounds).
- Test fixture, cloned-config, seeded-drive-to-game-over, or assertion-setup issues in
  `test/gameOverLayout.test.js` / `test/restart.integration.test.js`.
- Additive-only `config.gameOver.screen` correction (a value the helper/scene/tests require) that
  changes **no** value asserted by `test/config.test.js` and adds no forbidden token.
- Syntax/parse errors in the Phaser modules (`GameOverScene.js`, `GameScene.js`, `main.js`) surfaced
  by `node --check` (typos, bad imports, wrong scene key, wrong init-data field).
- Bounded render-wiring fixes wholly within `GameOverScene.js`/`GameScene.js`/`main.js` scope (wrong
  scene key, missing once-only guard, missing clean-restart field re-init, tween/interactive
  parameter mistakes, scene-list ordering) that do not change the model or its API.
- Removal of `Test.txt` (CF-02).

### Stop Conditions
Debug must escalate (`status: blocked`) — or defer to a remediation loop only for a bounded,
build-fixable defect — if:
- more than 3 repair cycles occur on the same failure class,
- an architecture invariant (INV-1..8) cannot be satisfied without a design change (e.g. a clean
  restart appears to require mutating model state from the scene, contradicting INV-3, or the model
  exposes no game-over `status`/`score` to drive the transition),
- a fix requires new feature scope or an out-of-scope file (`neon.js`, model/event changes,
  `index.html`, vendor, high-score persistence),
- an existing Phase 01–05 test would have to change to go green (signals a regression that needs a
  design decision, not a local repair).

Note: a `node --check` parse failure, a failing **new** `gameOverLayout` unit test, or a failing
**new** restart integration test is a bounded in-scope repair, not a block. The manual DoD browser
check (CF-01, plan §13) is a human step and is **not** a debug stop condition — debug cannot run a
browser and must not block on it.

---

## 3. Validation Classes

- `unit` — `gameOverLayout` centring / CTA-rect derivation + on-screen bounds / vertical order /
  finiteness / determinism; plus the `config.test.js` regression (additive `gameOver.screen` block
  breaks nothing, INV-1 scan green).
- `integration` — new `restart.integration.test.js` (game-over→re-construction/reset yields the
  initial state, INV-6); plus the Phase 02–05 integration suite as **regression** under `node --test`,
  which must pass unchanged, proving the render-only game-over/restart wiring altered no simulation
  outcome.
- `contract` — none new; the `GameModel` public API/event shape is unchanged and covered by the
  Phase 03 contract tests (regression). The game-over flow only consumes the existing
  `getState().status`/`score` and the `gameover` event shape.

Phaser-coupled modules cannot be imported under `node:test`; their gate is `node --check` (parse) +
the whole-suite regression + the manual DoD browser check (plan §13). All headless commands run via
`node --test` / `node --check`.

---

## 4. Example Build Node

(See `P06-BUILD-CORE`, `P06-BUILD-RESTART-CONTRACT`, `P06-BUILD-GAMEOVER-SCENE`, and
`P06-BUILD-GAMEOVER-TRANSITION` in §2 — concrete, not illustrative.)

---

## 5. Example Debug Node

(See `P06-DEBUG-STABILIZE` in §2 — concrete, not illustrative.)

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
P06-BUILD-CORE ──→ P06-BUILD-GAMEOVER-SCENE ──→ P06-BUILD-GAMEOVER-TRANSITION ──┐
                                                                                 ├─→ P06-DEBUG-STABILIZE ─→ review ─→ resolve
P06-BUILD-RESTART-CONTRACT ───────────────────────────────────────────────────────┘
```

- Build nodes are defined here (two parallel roots: CORE and RESTART-CONTRACT; the scene chain
  converges from CORE); `review` (closure gate) and `resolve` come from the `delivery_loop`.
- `review` depends on all debug nodes (`P06-DEBUG-STABILIZE`).
- `resolve` depends on `review` (and on any remediation-loop review nodes that rejoin).

---

## 8. Graph Constraints

- The graph is a DAG; no cycles.
- Dependencies reference declared aliases only.
- `P06-BUILD-CORE` and `P06-BUILD-RESTART-CONTRACT` are independent parallel roots (no shared seam:
  the layout helper produces render geometry, the restart test consumes only the simulation core).
- `P06-BUILD-GAMEOVER-SCENE` depends on `P06-BUILD-CORE` (real input: imports `gameOverLayout` +
  `config.gameOver.screen`).
- `P06-BUILD-GAMEOVER-TRANSITION` depends on `P06-BUILD-GAMEOVER-SCENE` (real input: launches the
  `'GameOverScene'` scene key + `{ score }` init-data contract).
- `P06-DEBUG-STABILIZE` depends on all four build nodes.
- Review depends on all debug nodes; resolve depends on review.

---

## 9. Priority Contract

All nodes use priority `1` (High) — Phase 06 delivers the final required gameplay layer (game-over +
restart), completing the feature's automated Definition of Done. All priorities are within `0-4`.
