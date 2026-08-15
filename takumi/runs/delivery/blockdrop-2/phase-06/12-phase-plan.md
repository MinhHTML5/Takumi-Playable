# Phase Plan: Phase 06 — Game-Over Screen & Restart CTA

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 06
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: `../phase-05/32-carry-forward.md`
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Phase Goal

Close the session loop. Deliver the **game-over screen** (fade-in overlay, final score, and a fake
`Play` CTA) and wire the **game-over → screen → fresh-restart** flow so a completed session can be
replayed (PRD Goals 3, 5, 9; phases.md Phase 06). This is the **final integration phase**: it also
consumes the remaining carry-forward items (CF-01 manual DoD walkthrough, CF-02 `Test.txt` cleanup,
CF-03 `main.js` scale-token observability) and defines the full manual DoD walkthrough script (§13).

This is the smallest safe delivery slice that closes the loop while preserving every invariant:

- **Advances the feature:** it delivers the last missing gameplay requirement (a game-over
  presentation and a working restart), completing the PRD's Definition of Done except for the
  human-only browser walkthrough (CF-01).
- **Preserves invariants:** the game-over/restart flow is **render-layer only**. It reads the
  model's existing `getState().status === 'gameover'` and final `score`, and restarts by
  **re-constructing** a fresh `GameModel` (the accepted mechanism per TDD §4.1 / §4.3) — no
  `src/core/` rule, API, or event-shape change. INV-1..8 are structurally preserved; INV-6 (clean
  restart == initial state) is proven headlessly by a new re-construction/reset integration test.
- **Coherent validation boundary:** the phase's genuine headless logic — the game-over screen
  layout math and the restart-equivalence contract — is isolated into a pure, Phaser-free helper
  (`src/render/gameOverLayout.js`) and a `node:test` integration test, both validated in Node. The
  Phaser-coupled scene/transition wiring is parse-checked (`node --check`), whole-suite regression
  gated, and carried to the manual DoD (CF-01) — exactly the pattern Phases 04–05 used for their
  scene surfaces.

---

## 2. Scope

### In-Scope
- A new **pure, Phaser-free** render helper `src/render/gameOverLayout.js`:
  - `gameOverLayout(config)` → deterministic screen-space positions/dimensions for the title, the
    final-score readout, and the `Play` CTA rectangle, all derived from `config.design` and
    `config.gameOver.screen`. No Phaser/DOM reference.
- `test/gameOverLayout.test.js` — `node:test` unit coverage for the layout helper.
- A new **restart-equivalence integration test** `test/restart.integration.test.js` proving INV-6
  for the actual restart mechanism: after a session is driven to `gameover`, a freshly
  **re-constructed** `GameModel` (what the scene does on CTA) and a `reset()` model each equal the
  canonical initial state (status `playing`, time 0, score 0, no bomb, difficulty 0, full
  brick layout all alive, brick values ∈ [1,30]).
- An **additive** `config.gameOver.screen` block in `src/core/config.js` (fade duration, overlay
  colour/alpha, title/score/CTA text + colours + sizes, CTA rectangle dimensions). Purely additive
  under the existing `gameOver` key; changes no existing value and introduces no INV-1 forbidden
  substring (`phaser`/`document`/`window`), so every `test/config.test.js` assertion and the
  core-purity scan stay green.
- A new Phaser scene `src/scenes/GameOverScene.js`:
  - Receives the final score via scene init data (`{ score }`).
  - Fades in a semi-transparent neon overlay, a "GAME OVER" title, the final score, and a fake
    `Play` CTA button (drawn with Phaser primitives — no `neon.js` change), positioned via
    `gameOverLayout(config)` and styled from `config.gameOver.screen`.
  - On CTA activation, restarts a **fresh** `GameScene` (stops itself and `scene.start('GameScene')`,
    which re-runs `GameScene.create()` → a brand-new `GameModel`). No high-score persistence (PRD §3).
- `src/main.js` change: register `GameOverScene` in the scene list; **CF-03** — add a `config.debug`-
  gated `console.warn` when a scale token is unrecognised (the existing FIT/CENTER_BOTH fallback is
  preserved unchanged).
- `src/scenes/GameScene.js` change: on reaching `gameover` (after the final effect burst is drained),
  launch `GameOverScene` **once** with the final score; and re-initialise the per-session scene
  fields in `create()` so a `scene.start` restart begins from a clean pool (Phaser reuses the scene
  instance across restart, so constructor-only initialisation would carry stale sprite references).
- **CF-02** — remove the pre-existing empty `Test.txt` (final integration cleanup).
- `phase-06/stabilization-report.md` (debug output).

### Out-of-Scope
- Any change to `src/core/*` **logic**, the `GameModel` public API, or its event shape (the
  game-over signal and final score are consumed as-is; the only `src/core/` edit is the additive
  `config.gameOver.screen` data block).
- Any change to the simulation, difficulty, collision, scoring, rendering of bricks/bomb/danger
  line, or Phase 05 juice effects (all accepted in Phases 02–05 and preserved).
- New neon textures / any `src/render/neon.js`, `tint.js`, `loop.js`, `effects.js` change; audio;
  `index.html`; `vendor/`.
- Ad-network SDKs, store redirects, external clickthrough, analytics, install tracking, high-score
  persistence, menus/level-select (PRD §3 — the CTA is a **fake** `Play` that only restarts).
- Executing the manual mobile-portrait browser DoD walkthrough (CF-01) — the headless lane has no
  browser; the walkthrough is **defined** here (§13) and its execution remains a human step (§10).

This section prevents phase bleed. Nothing listed as out-of-scope appears in the Task Inventory.

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `src/render/gameOverLayout.js` (pure helper) + `test/gameOverLayout.test.js`.
- `test/restart.integration.test.js` (INV-6 re-construction/reset restart contract).
- Additive `config.gameOver.screen` block in `src/core/config.js`.
- `src/scenes/GameOverScene.js` (new scene) + `src/main.js` registration (+ CF-03 warning).
- `src/scenes/GameScene.js` game-over transition + clean-restart field re-init.
- Removal of `Test.txt` (CF-02).
- The manual DoD walkthrough script (§13 of this plan) for the operator/human (CF-01).
- `phase-06/stabilization-report.md`.

### Exit Criteria
- [ ] Implementation tasks (T1–T8) complete.
- [ ] Required validation commands pass (`node --test` full suite green; `node --check` clean on
      every changed `.js`).
- [ ] Game-over screen fades in with the final score and a fake `Play` CTA, and each element is
      positioned via `gameOverLayout` / styled from `config.gameOver.screen` (structural review;
      **visible** confirmation is the deferred manual DoD, CF-01).
- [ ] Activating the CTA restarts a **fresh** session equal to the initial state — score 0, no bomb,
      fresh bricks, `status: 'playing'` — proven headlessly by `test/restart.integration.test.js`
      (integration on re-construction/reset). (INV-6)
- [ ] The game-over transition is render-only and **does not alter simulation outcomes** — the
      Phase 02–05 tests still pass **unchanged** (regression).
- [ ] Debug stabilization completed; `Test.txt` removed (CF-02).
- [ ] Review completed with `accept` (correctness + structural).
- [ ] No invariant violations introduced (INV-1..8 preserved; core-purity scan still green).
- [ ] Carry-forward items from Phase 05 (CF-01, CF-02, CF-03) were explicitly evaluated (§10).
- [ ] All remediation loops resolved (loop review `accept`), if any are opened.

---

## 4. Task Inventory (Canonical Scope)

Every build, debug, and review node traces back to a task here. No lane may invent work outside
this inventory.

### T1 — Additive `config.gameOver.screen` block
- Task ID: T1
- Type: implementation
- Description: Extend `src/core/config.js` with an **additive** `screen` sub-block under the existing
  `gameOver` key (which currently holds only `topY`). Suggested first-pass values (all tunable):
  `fadeMs: 500`; `overlayColor: 0x05010a`; `overlayAlpha: 0.72`;
  `title: { text: 'GAME OVER', color: '#ff1744', sizePx: 72 }`;
  `score: { prefix: 'SCORE ', color: '#39ff14', sizePx: 56 }`;
  `cta: { label: 'PLAY', width: 360, height: 132, fillColor: 0x39ff14, textColor: '#05010a',
  textSizePx: 60 }`. Change **no** existing value (including `gameOver.topY`) and introduce **no**
  forbidden substring (`phaser`/`document`/`window`, case-insensitive — verify the chosen labels
  and keys, e.g. no `window`/`shadow`-style token) so the INV-1 core-purity scan and every existing
  `test/config.test.js` assertion stay green.
- Files / Areas: `src/core/config.js` (additive only).
- Outputs: `src/core/config.js`.
- Test Intent (`unit`, regression): `test/config.test.js` passes unchanged; the INV-1 purity scan
  over `src/core/` still reports zero violations with the new block present.
- Validation Commands: `node --test test/config.test.js`; `node --check src/core/config.js`.
- Dependencies: none (same node as T2/T3 — the layout helper and its test read these values).
- Carry Forward References: enables CF-01's visible game-over presentation (styling tunables).

### T2 — Pure game-over layout helper (`gameOverLayout.js`)
- Task ID: T2
- Type: implementation
- Description: Implement `src/render/gameOverLayout.js`, a **pure, Phaser/DOM-free** module
  (imports cleanly under plain Node; no `Phaser`/`window`/`document` reference) exporting
  `gameOverLayout(config)` → an object of screen-space positions/dimensions computed from
  `config.design` (`width`, `height`) and `config.gameOver.screen.cta` (`width`, `height`):
  - `title: { x, y }` — horizontally centred (`x = width/2`), placed in the upper third
    (e.g. `y = height * 0.34`).
  - `score: { x, y }` — horizontally centred, below the title (e.g. `y = height * 0.46`).
  - `cta: { x, y, width, height, left, top, right, bottom }` — a horizontally-centred rectangle
    (centre `x = width/2`, e.g. centre `y = height * 0.64`) using the configured CTA `width`/
    `height`, with the derived edge coordinates for hit-region/interaction use. The rectangle must
    lie fully within `[0, width] × [0, height]`.
  - House convention: a named export plus a `default` export bundle.
  - Deterministic and side-effect-free; same `config` in → identical object out.
- Files / Areas: `src/render/gameOverLayout.js` (new).
- Outputs: `src/render/gameOverLayout.js`.
- Test Intent (`unit`): see T3.
- Validation Commands: `node --test test/gameOverLayout.test.js`; `node --check src/render/gameOverLayout.js`.
- Dependencies: T1 (reads `config.gameOver.screen`); same node.

### T3 — Layout helper tests (`gameOverLayout.test.js`)
- Task ID: T3
- Type: test
- Description: Author `test/gameOverLayout.test.js` implementing the T2 Test Intent:
  - title and score are horizontally centred at `config.design.width / 2`.
  - the CTA rectangle uses the configured `config.gameOver.screen.cta.width`/`height` and its
    `left/top/right/bottom` are consistent with its centre `x/y` and size.
  - the CTA rectangle lies fully within `[0, width] × [0, height]` (no off-screen button).
  - title `y` < score `y` < CTA centre `y` (vertical order top→bottom).
  - all returned coordinates/dimensions are finite numbers.
  - determinism: two calls with the same config return deeply-equal objects.
  - (robustness) a cloned config with different `design`/`cta` dimensions re-centres correctly.
- Files / Areas: `test/gameOverLayout.test.js` (new).
- Outputs: `test/gameOverLayout.test.js`.
- Test Intent (`unit`): as above; suite green under `node --test`.
- Validation Commands: `node --test test/gameOverLayout.test.js`.
- Dependencies: T2 (same node — implementation + its only test stay together).

### T4 — Restart-equivalence integration test (`restart.integration.test.js`)
- Task ID: T4
- Type: test
- Description: Author `test/restart.integration.test.js` proving the INV-6 restart contract for the
  **mechanism the scene actually uses** — fresh re-construction — plus the `reset()` path:
  - Build a small config (via the existing helpers used by `test/simulation*.test.js`, or import
    `config` directly) and a seeded `rng`; drive a `GameModel` to `status: 'gameover'` (tick with
    no input until game-over, mirroring the integration suite's approach).
  - **Re-construction path:** construct a brand-new `GameModel` with the same `config` and a
    *different* seed (as `GameScene.create()` does on restart) and assert its `getState()` is the
    canonical initial state: `status === 'playing'`, `time === 0`, `score === 0`, `bomb === null`,
    `difficultyLevel === 0`, `bricks.length === initialRows * columns`, every brick `alive`, and
    every brick `value` ∈ `[config.values.brickMin, config.values.brickMax]` (INV-7). Values need
    **not** equal the pre-game-over session's (different seed) — the contract is structural.
  - **Reset path:** on the played-out model, call `reset()` and assert the same canonical initial
    state (score 0, no bomb, all bricks alive, `status: 'playing'`, `time 0`).
  - This is additive to and distinct from the existing `simulation.test.js` INV-6 unit test (which
    only covers `reset()` under an identical seed); this test covers the game-over→re-construction
    restart path.
- Files / Areas: `test/restart.integration.test.js` (new).
- Outputs: `test/restart.integration.test.js`.
- Test Intent (`integration`): the full game-over→restart cycle yields the initial state through both
  re-construction and `reset()`; green under `node --test`.
- Validation Commands: `node --test test/restart.integration.test.js`.
- Dependencies: none — reads only the accepted `src/core/` model (parallel root).
- Carry Forward References: satisfies the phases.md Phase 06 "integration on `reset`/re-construction"
  exit criterion (INV-6).

### T5 — Game-over scene (`GameOverScene.js`)
- Task ID: T5
- Type: implementation
- Description: Implement `src/scenes/GameOverScene.js`, a new Phaser scene (key `'GameOverScene'`):
  - `init(data)` — store `this.finalScore = (data && Number.isFinite(data.score)) ? data.score : 0`.
  - `create()` — using `gameOverLayout(config)` for positions and `config.gameOver.screen` for
    styling/timing:
    - Draw a full-screen overlay (`this.add.rectangle(0, 0, config.design.width,
      config.design.height, config.gameOver.screen.overlayColor).setOrigin(0,0)`), a "GAME OVER"
      title at `layout.title`, the final score (`${prefix}${this.finalScore}`) at `layout.score`,
      and a fake `Play` CTA (a filled rectangle at `layout.cta` + a centred label). All start at
      `alpha = 0` and tween to their target alpha (overlay to `overlayAlpha`, text/CTA to `1`) over
      `config.gameOver.screen.fadeMs` — the game-over fade-in (PRD Goal 8/9).
    - Make the CTA interactive (`setInteractive()` on the CTA rectangle/zone). On `pointerdown`,
      restart: `this.scene.stop(); this.scene.start('GameScene');` — re-running `GameScene.create()`
      constructs a fresh `GameModel` (INV-6 by construction). No persistence, no external navigation
      (fake CTA, PRD §3).
  - Presentation only: never constructs or mutates a `GameModel`; reads nothing from `src/core/`
    except `config` and the pure `gameOverLayout` helper. May use the `Phaser` global (render layer;
    INV-1 scopes only `src/core/`). Draw the CTA with Phaser primitives — do **not** add a texture
    to `neon.js`.
- Files / Areas: `src/scenes/GameOverScene.js` (new).
- Outputs: `src/scenes/GameOverScene.js`.
- Test Intent: Phaser-coupled — no headless class. Gate: `node --check src/scenes/GameOverScene.js`
  parses; the full `node --test` suite remains green (proves no core regression); structural review
  confirms fade-in, final score, CTA presence, and that restart re-constructs a fresh session.
  Visible correctness is the deferred manual DoD (CF-01).
- Validation Commands: `node --check src/scenes/GameOverScene.js`.
- Dependencies: T1 (`config.gameOver.screen`), T2 (`gameOverLayout`).

### T6 — Register scene + CF-03 scale-token warning (`main.js`)
- Task ID: T6
- Type: implementation
- Description: Update `src/main.js`:
  - Import `GameOverScene` and add it to the `scene` array **after** `GameScene`
    (`scene: [BootScene, GameScene, GameOverScene]`).
  - **CF-03:** when a `config.scale.mode` / `config.scale.autoCenter` token is not present in the
    `SCALE_MODE` / `AUTO_CENTER` maps, emit a `config.debug`-gated `console.warn` naming the
    unrecognised token, then fall back to `FIT` / `CENTER_BOTH` (the existing `??` fallback is
    **preserved** — the warning is observability only, gated so it is silent by default).
  - Change nothing else (no scale-handling behaviour change beyond the optional warning).
- Files / Areas: `src/main.js`.
- Outputs: `src/main.js`.
- Test Intent: Phaser-coupled — no headless class. Gate: `node --check src/main.js` parses; full
  `node --test` remains green. Structural review confirms the scene is registered and the fallback
  behaviour is unchanged (warning is debug-gated).
- Validation Commands: `node --check src/main.js`.
- Dependencies: T5 (imports `GameOverScene`).
- Carry Forward References: CF-03.

### T7 — GameScene game-over transition + clean-restart re-init (`GameScene.js`)
- Task ID: T7
- Type: implementation
- Description: Wire the game-over transition into `src/scenes/GameScene.js` — presentation only,
  never mutating model state (INV-3):
  - In `create()`, re-initialise the per-session scene fields so a `scene.start` restart begins
    clean (Phaser reuses the scene instance across restart and does **not** re-run the constructor,
    so constructor-only fields carry stale references): set `this.brickSprites = new Map()`,
    `this.bombSprite = null`, `this._fadeRows = new Set()`, and a new guard
    `this._gameOverHandled = false`. (Keep the constructor defaults; the create() reset is what makes
    restart clean.)
  - In `update()`, **after** the existing tick loop and the existing `consumeEvents()` effect
    dispatch (so the final explosion/row-clear/shake for the game-ending tick still plays this
    frame), check the latest snapshot: if `status === 'gameover'` and `!this._gameOverHandled`, set
    `this._gameOverHandled = true` and `this.scene.launch('GameOverScene', { score: snapshot.score })`
    (launch, not start — the frozen neon final frame stays visible beneath the fading overlay).
    Guarding with the flag ensures the launch fires exactly once, not every frozen frame.
  - Preserve **all** existing behaviour unchanged: the fixed-step tick loop, event drain, danger-line
    pulse, brick/bomb reconciliation + `valueToTint` refresh (INV-7), the gameover-freeze, and the
    `pointerdown` no-op at game-over. Do not add game rules, read wall-clock for simulation, or read
    model state except via `getState()` / `consumeEvents()`.
- Files / Areas: `src/scenes/GameScene.js`.
- Outputs: `src/scenes/GameScene.js`.
- Test Intent: Phaser-coupled — no headless class. Gate: `node --check src/scenes/GameScene.js`
  parses; the full `node --test` suite remains green (proves no core/model regression); structural
  review confirms the once-only launch with the final score, the clean-restart field re-init, and
  INV-3 (no model-state mutation). Visible correctness is the deferred manual DoD (CF-01).
- Validation Commands: `node --check src/scenes/GameScene.js`; `node --test`.
- Dependencies: T5 (launches the `'GameOverScene'` key with the `{ score }` init-data contract).

### T8 — Final integration cleanup (remove `Test.txt`) + debug stabilization
- Task ID: T8
- Type: cleanup + validation
- Description:
  - **CF-02 cleanup:** remove the pre-existing empty, runtime-inert `Test.txt` at the repo root
    (`git rm -f Test.txt`).
  - **Stabilization:** run the full validation gate, diagnose any failures, apply bounded in-scope
    repairs (within T1–T7 scope), rerun to green, and record results in the stabilization report.
- Files / Areas: `Test.txt` (removal); `phase-06/stabilization-report.md`; bounded repairs within
  T1–T7 scope only.
- Outputs: `phase-06/stabilization-report.md`; `Test.txt` removed.
- Test Intent (`unit` + `integration` + regression `contract`): full `node --test` green (all prior
  Phase 02–05 tests **unchanged** + the new `gameOverLayout` unit tests + the new restart
  integration test); `node --check` clean on every changed `.js`; INV-1 core-purity scan green.
- Validation Commands: see §7.2.
- Dependencies: T1–T7.
- Carry Forward References: CF-02.

---

## 5. Task Breakdown (Human Organization)

This is a single-repo (Takumi-Playable), front-end-only feature; there is no backend/frontend split.

### 5.1 Backend Tasks
- None (no backend in this playable).

### 5.2 Frontend Tasks
- Headless game-over core (layout + config):
  - Task IDs: T1, T2, T3
  - Files/Areas: `src/core/config.js` (additive), `src/render/gameOverLayout.js`,
    `test/gameOverLayout.test.js`
  - Notes: the phase's pure, headlessly-testable layout logic + its tunables, unit-tested in
    isolation.
  - Depends on: none (parallel root).
- Restart contract (headless integration test):
  - Task ID: T4
  - Files/Areas: `test/restart.integration.test.js`
  - Notes: proves INV-6 for the re-construction/reset restart mechanism; imports only the accepted
    `src/core/` model — independent of the render layout root.
  - Depends on: none (parallel root).
- Game-over scene + registration:
  - Task IDs: T5, T6
  - Files/Areas: `src/scenes/GameOverScene.js`, `src/main.js`
  - Notes: the new Phaser scene (fade-in, score, CTA) and its registration; includes CF-03.
  - Depends on: T1/T2 (config + layout helper).
- Game-over transition + clean restart:
  - Task ID: T7
  - Files/Areas: `src/scenes/GameScene.js`
  - Notes: fires the transition once at game-over and makes restart clean; consumes the
    `'GameOverScene'` key + `{ score }` contract from T5.
  - Depends on: T5.

### 5.3 Cross-Cutting Tasks
- Final cleanup + debug stabilization:
  - Task ID: T8
  - Files/Areas: `Test.txt` removal; full validation gate; `stabilization-report.md`
  - Depends on: T1–T7.

---

## 6. Dependency Notes (Human Explanation)

- The **layout/config root** (T1–T3) and the **restart-contract root** (T4) are **independent
  parallel roots**: the layout helper reads `config.gameOver.screen` and centres UI; the restart
  test imports only the accepted simulation core. Neither consumes the other's output, so forcing an
  order between them would be incidental serialization, not a real input constraint.
- The **scene node** (T5/T6) has a **real import dependency** on the layout/config root — it imports
  `gameOverLayout` and reads `config.gameOver.screen` — so it cannot be validated until that root
  exists. `main.js` registration (T6) belongs with the scene because it imports `GameOverScene`.
- The **transition node** (T7) has a **real dependency** on the scene node: it launches the
  `'GameOverScene'` scene key and passes the `{ score }` init-data contract the scene consumes, so
  the scene must exist first (avoids contract drift on the mutual scene↔scene loop).
- **Debug stabilization** (T8) depends on all build nodes: it runs the whole-suite regression +
  parse gate over the combined output and performs the `Test.txt` cleanup.
- Review depends on the debug node; closure readiness depends on review recording `accept` (and any
  remediation-loop reviews accepting).

---

## 7. Validation Plan

### 7.1 Validation Classes

- `unit` — **required.** `gameOverLayout`: centring, CTA-rect derivation + on-screen bounds,
  vertical order, finiteness, determinism. Plus the `config.test.js` regression (additive
  `gameOver.screen` block breaks no existing assertion and the INV-1 scan stays green).
- `integration` — **required (new + regression).** New: `test/restart.integration.test.js` proves
  the game-over→re-construction/reset restart yields the initial state (INV-6). Regression: the
  Phase 02–05 integration suite runs under `node --test` and must pass **unchanged**, proving the
  render-only game-over/restart wiring did not alter any simulation outcome. This is the project's
  own higher-level test expressed as integration validation.
- `contract` — **required (as regression).** No new contract test; the `GameModel` public/event
  shape is unchanged and remains covered by the Phase 03 contract tests. The game-over flow only
  **consumes** the existing `getState().status`/`score` and the `gameover` event shape.

The Phaser-coupled modules (`GameOverScene.js`, `GameScene.js`, `main.js`) cannot be imported under
`node:test` (they reference the `Phaser` global at definition time), so their gate is `node --check`
(parse) + the whole-suite regression + the deferred manual DoD (CF-01, §13) — the same pattern
Phases 01/04/05 used.

### 7.2 Validation Commands

- Unit tests: `node --test test/gameOverLayout.test.js` · `node --test test/config.test.js`
- Integration tests: `node --test test/restart.integration.test.js` · `node --test` (full suite —
  the Phase 02–05 simulation + integration suites must remain green and unchanged)
- Contract tests (regression): covered by the full `node --test` run (Phase 03 `GameModel` API/event
  tests)
- Migrations / reset steps: none
- Seed steps: none
- Build / lint: `node --check src/core/config.js` · `node --check src/render/gameOverLayout.js` ·
  `node --check src/scenes/GameOverScene.js` · `node --check src/scenes/GameScene.js` ·
  `node --check src/main.js`

All required commands must pass before the phase may exit.

### 7.3 Completion Artifact Validation

All node work concludes with a `takumi_complete` call carrying a valid completion artifact
(`schema_version: 1`, matching `node_id`/`run_id`, terminal `status`, `outcome`, `summary`,
`directives`). Required directives: `close_node` (all lanes); `record_repo_changes` with real
40-char SHAs when commits are made. Validated by CompletionService against the `AGENTS.md` schema.

### 7.4 Debug Stabilization Contract

Debug executes §7.2, diagnoses failures, applies bounded repairs **within T1–T7 scope**, reruns to
green, performs the CF-02 `Test.txt` removal, and repeats until pass or a stop condition. Debug must
not introduce new feature work.

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** (never defer to a loop) when: an architecture
invariant (INV-1..8) cannot be satisfied without a design change (e.g. a clean restart appears to
require mutating model state from the scene, contradicting INV-3, or the game-over signal is missing
from the model contract); required functionality is missing in a way needing a design decision; or an
existing Phase 01–05 test would have to change to go green (a regression signalling a design issue,
not a local repair).

Debug may apply bounded stabilization, or defer to a `remediation_loop` for a **bounded,
build-fixable** defect, when: more than 3 repair cycles hit the same failure class; the same failure
repeats after repair. A `node --check` parse failure, a failing **new** `gameOverLayout` unit test, or
a failing **new** restart integration test is a bounded in-scope repair, not a block. The manual DoD
browser check (CF-01) is a human step and is **not** a debug stop condition — debug has no browser
and must not block on it.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it validates correctness + scope compliance, validation evidence,
and structural integrity / invariant preservation (INV-1..8; especially INV-3 — the scenes mutate no
model state — INV-6 — restart == initial state, proven by the new integration test — and the
regression proof that Phase 02–05 outcomes are unchanged). If review finds a blocking in-scope defect
it opens one or more `remediation_loop`s (`build → debug → review`) that rejoin at resolve. The phase
closes only when the phase review and every loop review record `accept`. Loops are bounded
(`max_self_recurrence: 5`); on exhaustion with issues remaining, review escalates `status: blocked`.

### 7.7 Edge Cases to Validate

- `gameOverLayout`: the CTA rectangle never extends beyond `[0, width] × [0, height]`; title/score/CTA
  keep top→bottom vertical order; a cloned config with different `design`/`cta` dimensions re-centres.
- Restart contract: re-construction after game-over yields the initial state under a **different**
  seed (structural equality, not value equality); `reset()` yields the initial state too.
- `GameOverScene.init` with missing/non-finite `data.score` → defaults to `0` (no `NaN` on screen).
- Transition fires **exactly once**: `this._gameOverHandled` prevents re-launching `GameOverScene`
  on every frozen post-game-over frame.
- Clean restart: after `scene.start('GameScene')`, `brickSprites`/`_fadeRows`/`bombSprite`/
  `_gameOverHandled` are re-initialised so no stale sprite reference or lingering game-over guard
  survives (verified structurally; visible correctness is CF-01).
- The final-frame effect burst (explosion/row-clear/shake) still plays before the overlay launches
  (transition check runs after the event drain).
- Regression: with the game-over/restart wiring added, `node --test` reports the identical Phase
  02–05 pass set with no prior test file edited.

---

## 8. Environment Contract

**No runtime environment required for automated validation.** The entire gate runs with local Node
commands (`node --test`, `node --check`) that import no Phaser and need no server, browser, or
network. The only environment that would exercise the *visible* game-over screen, fade-in, CTA feel,
and full boot-to-restart loop is a mobile-portrait browser, and that is the **deferred manual DoD**
(CF-01, §13) — not part of this phase's automated validation and not a debug stop condition.

---

## 9. Risk Touchpoints

- Risk ID: **R3 — Phaser scenes are hard to unit-test** (Mitigated structurally; residual manual).
  - Mitigation in this phase: the phase's real logic (screen layout math + the restart-equivalence
    contract) is extracted into the pure `gameOverLayout.js` and the headless
    `restart.integration.test.js`; the scenes stay thin, parse-checked adapters with no rules and no
    model-state mutation (INV-3). The restart mechanism is re-construction of the already-tested
    `GameModel`, so its correctness rests on the accepted core plus the new INV-6 integration test.
- Risk ID: **R2 — Difficulty tuning / session length** (Mitigated headless; browser feel residual).
  - Touchpoint: restart produces a fresh session with a new seed; the new integration test confirms
    the fresh session is a valid initial state, but real replay pacing/feel remains a CF-01 manual
    item.
- Invariant threats: INV-1 (core purity — the only `src/core/` edit is the additive
  `config.gameOver.screen` data block, which adds no forbidden token; the scan stays green), INV-3
  (scenes never mutate model state — they read `getState()` and restart by re-construction), INV-6
  (clean restart == initial state — the primary invariant this phase exercises, proven by the new
  integration test).

---

## 10. Carry Forward Consumption

Prior phase Phase 05 has `../phase-05/32-carry-forward.md` with three open items — each addressed:

- Carry Forward ID: **CF-01** — execute the mobile-portrait browser boot/play walkthrough (now
  including the game-over screen, CTA, and full boot→game-over→restart loop plus Phase 05 effects).
  - Source: Phase 01 manual DoD item, re-deferred through Phase 05.
  - Disposition: **Brought into scope as a defined deliverable; execution deferred to a human
    (known limitation).**
  - Rationale: This is the final phase, so the complete manual DoD walkthrough is now **defined**
    (§13) as the operator's acceptance script. However, the headless execution lane has **no
    browser** and cannot observe canvas rendering, portrait fit, pointer/CTA feel, fade-in, or
    real-device frame rate. Everything headlessly verifiable (restart contract, parse, full
    regression) is covered by this phase's automated gate; the visible walkthrough remains a human
    step. The phase closes on the automated gates + structural review; CF-01's *execution* is
    handed to the operator via §13 and recorded by resolve as the remaining manual acceptance item.
  - Related Task IDs: none (structural review of T5/T7 confirms the wiring; §13 is the human script).

- Carry Forward ID: **CF-02** — remove the pre-existing empty `Test.txt`.
  - Source: Phase 01 review advisory, re-deferred through Phase 05.
  - Disposition: **Included in this phase (T8).**
  - Rationale: This is the designated final integration cleanup phase; the file is runtime-inert and
    unrelated to any prior scope, so removing it now (rather than during focused feature work) keeps
    provenance clean. Assigned to the debug/stabilize node as a bounded cleanup.
  - Related Task IDs: T8.

- Carry Forward ID: **CF-03** — debug-only warning for unknown `src/main.js` scale-configuration
  tokens.
  - Source: Phase 01 review advisory + code review, re-deferred through Phase 05 ("include if it can
    be done without displacing required work; otherwise leave the accepted fallback unchanged").
  - Disposition: **Included in this phase (T6).**
  - Rationale: `main.js` is already being edited this phase to register `GameOverScene`, so adding a
    `config.debug`-gated `console.warn` on an unrecognised scale token is a small, bounded
    observability improvement that touches the same file without displacing the required game-over/
    restart work. The existing FIT/CENTER_BOTH fallback is preserved unchanged; the warning is
    silent by default.
  - Related Task IDs: T6.

Rules honored: every open carry-forward item is addressed explicitly; none is silently ignored; two
are brought into scope (CF-02, CF-03) and one is defined but its execution deferred to a human as a
known limitation with rationale (CF-01).

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES (INV-1..8).
- Any invariant modifications: NONE. The game-over/restart flow is render-only; no core module,
  rule, API, or event shape changes. The only `src/core/` edit is the additive
  `config.gameOver.screen` data block.
- Risk register regression concerns: NONE new. R3 mitigated by extracting layout/restart logic into
  tested pure/headless units and keeping scenes thin; INV-6 is actively exercised and proven by the
  new restart integration test.
- Deferred work impact review: CF-01 brought into scope as a defined walkthrough but execution
  deferred to a human (no browser in lane); CF-02 and CF-03 brought into scope and resolved (T8, T6).
- Prior carry-forward reviewed: YES (`../phase-05/32-carry-forward.md`).
- Carry-forward items brought into scope this phase: CF-02 (T8), CF-03 (T6); CF-01 defined (§13),
  execution deferred to human.
- Carry-forward items deferred again: CF-01 execution only (the manual browser walkthrough — no
  browser in the automated lane).

---

## 12. Phase Closure Contract

Required base sequence: **build → debug → review → resolve.**

Build roots (parallel): `P06-BUILD-CORE` (T1–T3) and `P06-BUILD-RESTART-CONTRACT` (T4). The scene
node `P06-BUILD-GAMEOVER-SCENE` (T5–T6) depends on `P06-BUILD-CORE`; `P06-BUILD-GAMEOVER-TRANSITION`
(T7) depends on `P06-BUILD-GAMEOVER-SCENE`. `P06-DEBUG-STABILIZE` (T8) depends on all four build
nodes → `review` → `resolve` (`review`/`resolve` come from the `delivery_loop`).

Review is the single closure gate. If it requests changes, each remediation loop it opens runs in
parallel and rejoins at resolve. The phase exits only when the phase review records `accept` and
every remediation-loop review records `accept`. Only then does resolve reconcile artifacts, record
CF-01's remaining manual acceptance step, and close the phase (and the feature, as this is the final
phase).

---

## 13. Manual DoD Walkthrough Script (CF-01 — human/operator step)

The automated lane cannot run a browser; this is the operator's acceptance script. Serve the repo
root over a static HTTP server and open `index.html` in a mobile-portrait viewport (e.g. 720×1280 /
device emulation). Confirm each item (maps to PRD §6 Definition of Done):

1. **Portrait boot** — the page boots and renders the neon background centred/letterboxed in portrait.
2. **Rising bricks + danger line** — seeded brick rows are visible at the bottom, rise over time, and
   the top danger line pulses.
3. **Tap to drop / cooldown** — tapping drops a bomb from the tapped column; a second tap during the
   ~0.5 s cooldown is ignored (one bomb at a time).
4. **Collision rules** — observe greater (brick destroyed, bomb continues, value reduced), lesser
   (bomb explodes, brick value reduced), and exact (both destroyed, whole row cleared with screen
   shake).
5. **Neon effects** — explosion particles on detonation, brick spawn fade-in, exact-match screen
   shake, danger-line pulse, and immediate partial-damage tint refresh (green→red by value).
6. **Upward scaling** — brick/bomb values trend higher as the session continues.
7. **Value-based score** — the score increases by the brick value removed/cleared.
8. **Game over** — when bricks reach the top, the game freezes and the game-over screen **fades in**
   with the final score and the fake `Play` CTA.
9. **Restart CTA** — tapping `Play` restarts a **fresh** session (score 0, fresh bricks, no bomb) and
   the loop is fully replayable.
10. **Session length** — a typical no-/low-input session reaches game over in roughly 30–45 s.

Record pass/fail per item; any failure here is a product/tuning finding for the operator, not an
automated-gate blocker (the automated gate has already proven the headless contracts).
