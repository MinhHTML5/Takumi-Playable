# TDD: Neon Bomb Brick Playable (blockdrop-2)

## 0. Metadata

- Feature Slug: blockdrop-2
- Related PRD: `./00-prd.md`
- Owners:
  - Product: Operator (via intake)
  - Architecture: lane:arch / stage:baseline
  - Build: lane:build (per-phase)
- Status: In Delivery — Phases 01–05 accepted
- Last Updated: 2026-08-15

---

## 1. Overview

We are building a **standalone mobile-portrait HTML5 playable ad** using Phaser 3. The player
taps to drop a numbered bomb from the top of the screen onto rising rows of numbered neon bricks.
Collisions resolve by numeric comparison (greater / lesser / exact), bricks push upward over time,
and the game ends when bricks reach the top. The experience is a short (~30–45 s) escalating
survival loop with neon art, juice effects, value-based scoring, and a game-over screen whose fake
`Play` CTA restarts the game.

- **Problem being solved:** The repo has no game shell. We must deliver a self-contained, polished,
  immediately-understandable playable that runs in a mobile browser in portrait orientation.
- **High-level approach:** A **pure simulation core** (deterministic, Phaser-free, seeded-RNG) owns
  all game state and rules; **thin Phaser scenes** render that state and forward input. This keeps
  the difficult logic (collision cascade, difficulty scaling, scoring, game-over) fully testable
  headlessly in Node, and isolates the browser/rendering concern to an adapter layer.
- **Key systems involved:** Phaser 3 runtime (rendering, input, particles, camera), a simulation
  core (plain ES modules), procedurally-generated neon art (Phaser Graphics → textures), and a
  `node:test`-based test harness that exercises the core without a browser.
- **What success looks like:** The playable boots in portrait, the bomb-vs-brick rules behave
  exactly as specified, bricks rise and end the game at the top, values scale upward over time,
  score reflects value removed/cleared, the neon visuals + juice are present, and the game-over
  CTA restarts a fresh session. All core rules are covered by passing unit/integration tests.

**Implemented state after Phase 05:** The repository contains the accepted 720×1280 Phaser shell,
vendored Phaser 3.80.0 runtime, central Phaser-free tunables, and a `node:test` harness. Phase 02
added the deterministic RNG, elapsed-time difficulty/value functions, immutable grid/row helpers,
and monotonic score accumulator under `src/core/`. Phase 03 added the pure collision resolver and
the deterministic `GameModel`, including rising/spawn timing, bomb cooldown and cascade, exact-row
clears, scoring, reset, events, and game-over detection. Phase 04 added pure tint and fixed-step
helpers, generated-once procedural neon textures, and the thin `GameScene` adapter that renders
model snapshots, forwards pointer input, and advances the model through bounded sub-steps. Phase
05 added pure effect helpers, an idempotent neutral particle texture, a reusable capped particle
emitter, event-driven explosion bursts and row-clear shake, brick spawn fade-in, and a pulsing
danger line. The complete core remains Phaser/DOM-free and deterministic; the accepted suite now
covers 108/108 tests. The game-over presentation remains planned for Phase 06. This state is
grounded in Phase 05 review node `1c072521-caaf-4349-9a3f-28143e4285b7`, which recorded `accept`
with no blocking or non-blocking findings.

---

## 2. In-Scope and Out-of-Scope (Technical)

### In-Scope
- Phaser 3 game bootstrapped for mobile-portrait with responsive scaling.
- Deterministic simulation core: grid of brick rows, rising motion, spawn timer, single falling
  bomb, collision resolution cascade, difficulty scaling, scoring, cooldown gate, game-over
  detection.
- Procedurally-generated neon art (background, bricks, bomb, danger line, explosion particles,
  game-over UI) — no external asset files.
- Green→red tint mapping driven by numeric value for bricks and bomb.
- Game feel: pulsing danger line, explosion particles, brick spawn fade-in, screen shake on
  exact-match row clears, game-over fade-in.
- Game-over overlay with final score and a fake `Play` CTA that restarts the playable.
- `node:test` unit + integration coverage of the simulation core.

### Out-of-Scope
- Ad-network SDKs, single-file ad packaging, store redirects, clickthrough, analytics, install
  tracking (PRD §3).
- High-score persistence, accounts, menus, level select, progression (PRD §3).
- Player choice over bomb values (random scaling only, PRD §3).
- Operator-supplied asset files; all art is generated in-engine (PRD §3).
- Automated browser/end-to-end/visual-regression testing. Visual + feel correctness is verified
  manually against the DoD checklist; automated validation covers logic only.

---

## 3. System Context

- **Current architecture summary:** Phase 01 established a standalone Phaser browser shell and
  an offline headless test harness. `index.html` loads the vendored Phaser 3.80.0 runtime before
  the ES-module entry; `src/main.js` maps engine-agnostic scale tokens onto Phaser enums and starts
  `BootScene` → `GameScene`. Phases 02–03 established the complete pure simulation core in
  `src/core/rng.js`, `difficulty.js`, `grid.js`, and `scoring.js`; dynamic purity guards cover the
  full core tree. `collision.js` resolves individual interactions and `simulation.js` owns the
  deterministic `GameModel` and its tick pipeline. Phases 04–05 bind that model to Phaser through
  pure tint, fixed-step, pulse, and particle-budget helpers; generated-once procedural textures;
  and a snapshot- and event-driven `GameScene`.
- **Relevant modules/services:** `index.html`, `src/main.js`, `src/scenes/BootScene.js`,
  `src/scenes/GameScene.js`, `src/core/config.js`, `rng.js`, `difficulty.js`, `grid.js`,
  `scoring.js`, `collision.js`, `simulation.js`, `src/render/tint.js`, `loop.js`, `neon.js`, their
  eleven `node:test` suites, and `vendor/phaser.min.js`.
- **Relevant data flows:** Browser host → Phaser boot → generated texture registration →
  `GameScene`; pointer input → `GameModel.dropBomb`; Phaser frame delta → bounded `fixedSteps` →
  `GameModel.tick`; read-only snapshots → brick/bomb/danger-line/score reconciliation; drained
  model events → explosion bursts, brick spawn fades, and row-clear shake. Nothing is persisted
  and nothing leaves the browser tab.
- **Current constraints:** Must use Phaser (PRD §5). Must run standalone in a browser, mobile
  portrait first. No network/backend. No ad-network packaging required this version.

> There is no generated `REPO_MAP.md` to reference. Current implementation state is recorded by
> Phase 05 review node `1c072521-caaf-4349-9a3f-28143e4285b7` and its accepted review artifact.

---

## 4. Architecture

### 4.1 Components and Responsibilities

- **Entry / Host (`index.html`, `src/main.js`)**
  - Delivery status: Implemented and accepted in Phase 01.
  - Responsibility: Load the Phaser 3 runtime, define the game config (portrait design resolution,
    scale mode, scene list), and start the game.
  - Owned by repo: Takumi-Playable.
  - Integration points: Instantiates Phaser `Game`; registers scenes.

- **Config / Tunables (`src/core/config.js`)**
  - Delivery status: Implemented and accepted in Phase 01; values remain intentionally tunable
    for the logic phases.
  - Responsibility: Single source of truth for all tunable constants — design resolution, grid
    dimensions, rise speed, spawn interval, bomb fall speed, cooldown, value ranges, difficulty
    curve parameters, tint endpoints. No logic, no Phaser import.
  - Integration points: Imported by both the simulation core and the render layer.

- **Simulation Core (`src/core/*.js`) — the heart, Phaser-free**
  - Delivery status: Implemented and accepted through Phase 03. Phase 02 delivered RNG,
    difficulty/value scaling, grid/row helpers, and scoring; Phase 03 delivered collision
    resolution and the orchestrating `GameModel`.
  - `rng.js`: seedable deterministic RNG (injectable); the only randomness source in the core.
  - `difficulty.js`: pure functions mapping elapsed time → brick value and → bomb value ranges
    (distribution drifts upward over time; brick values clamped to [1,30]).
  - `scoring.js`: pure accumulation of score from value removed/cleared.
  - `grid.js`: brick-row / brick / bomb data model in abstract game-unit coordinates; row and
    column helpers; row-clear helper.
  - `collision.js`: pure resolution of a single bomb↔brick interaction (greater / lesser / exact)
    returning the resulting state deltas and score gained.
  - `simulation.js`: the **GameModel** — owns full mutable state and orchestrates the tick:
    advance rising bricks, run spawn timer, advance the falling bomb, apply the collision cascade
    (a bomb may chew through multiple bricks in its column in one fall), detect exact-match row
    clears, apply scoring, enforce the drop cooldown, and detect game-over. Exposes a stable
    public API (see 4.3) consumed by the render layer.
  - Responsibility: Deterministic, headless-testable game logic. Contains **no** Phaser/DOM/timer
    references and never reads wall-clock time or `Math.random` directly.

- **Neon Art Factory (`src/render/neon.js`)**
  - Delivery status: Implemented and accepted through Phase 05 for the background, brick, bomb,
    danger-line, and neutral particle textures.
  - Responsibility: Procedurally generate and idempotently register reusable neon textures. Brick,
    bomb, and danger-line bases are neutral white so per-instance tinting remains accurate.
  - Integration points: `BootScene.create()` calls `generateTextures(this)` before starting
    `GameScene`; the scene imports stable texture-key constants.

- **Render Helpers (`src/render/tint.js`, `src/render/loop.js`, `src/render/effects.js`)**
  - Delivery status: Implemented and accepted through Phase 05.
  - Responsibility: Map values monotonically from configured green→red endpoints, split variable
    frame deltas into bounded simulation steps, calculate the danger-line pulse, and map explosion
    outcomes to budget-capped particle counts. All helpers are Phaser/DOM-free and covered by
    `node:test`.

- **Render/Input Layer (Phaser scenes, `src/scenes/*.js`)**
  - Delivery status: Boot wiring, simulation/render/input binding, and event-driven effects are
    implemented and accepted through Phase 05. `GameOverScene` remains planned for Phase 06.
  - `BootScene.js`: generate art/textures, then start `GameScene`.
  - `GameScene.js`: instantiates a `GameModel`, splits Phaser delta time into bounded steps, renders
    bricks/bomb/danger line and live score from read-only snapshots, maps taps →
    `model.dropBomb(x)`, drains model events for particles/fades/shake, pulses the danger line,
    and freezes on game over. Phase 06 will transition to `GameOverScene`.
  - `GameOverScene.js`: fade in, show final score and the fake `Play` CTA; on CTA/tap, restart a
    fresh `GameScene` (new seed/fresh model).
  - Responsibility: Presentation and input only. **Never** mutates simulation state directly —
    the only way it changes state is by calling `GameModel` methods.

### 4.2 Data and State Model

- **Entities / state objects (all in abstract game units, owned by the simulation core):**
  - `Brick { id, row, col, value, y (top position), alive, fadeInProgress }`
  - `BombState { active, x/col, y, value }` (at most one active bomb).
  - `GameModel state { time, bricks[], bomb, score, cooldownRemaining, difficultyLevel,
    status: 'playing' | 'gameover', rngSeed, pendingEvents[] }` where `pendingEvents` is a
    per-tick list the render layer drains to fire juice (e.g. `explosion`, `rowClear`, `spawn`).
- **Ownership:** The simulation core exclusively owns and mutates this state. Scenes hold a
  reference for reading and call methods to mutate.
- **Persistence model:** None. State is in-memory only and discarded on restart (PRD §3: no
  high-score storage).
- **Migration strategy:** N/A (greenfield, no persisted data).

### 4.3 API / Contract Changes

The only "contract" is the internal **GameModel ↔ render** interface. It must remain stable so the
render layer and tests depend on a fixed shape.

- `new GameModel({ config, rng })` — construct a fresh session.
- `model.dropBomb(colOrX) -> boolean` — attempt to drop a bomb; returns `false` if on cooldown or
  a bomb is already active. Enforces "one bomb per cooldown".
- `model.tick(dtSeconds) -> void` — advance the whole simulation by `dt`; updates positions, runs
  spawn/collision/scoring/game-over, appends to `pendingEvents`.
- `model.getState() -> readonly snapshot` — bricks, bomb, score, status, danger metrics.
- `model.consumeEvents() -> Event[]` — drain and return juice events since last call.
- `model.reset()` / construct anew — return to the initial state for restart.
- Collision overlap uses the bomb's point position. Phase 04 bounds each model tick to 0.05 s via
  `fixedSteps`, so maximum travel is 45 game units versus the 120-unit row height. The relationship
  is pinned by tests; changing bomb speed, row height, or the bound requires preserving it or
  adopting swept overlap. This reconciles Phase 03 review advisory A-1 through Phase 04 tasks
  T3/T4/T6.
- No HTTP endpoints, routes, hubs, DTOs, or schemas exist (standalone browser app).

### 4.4 Invariants (Non-Negotiables)

- **INV-1 (Core purity):** Modules under `src/core/` import nothing from Phaser or the DOM.
  Enforceable: a test imports every core module in plain Node and asserts success; a grep/lint
  check asserts no `phaser` import or `document`/`window` reference in `src/core/`.
- **INV-2 (Deterministic randomness):** All randomness in the core flows through the injected
  `rng`. No direct `Math.random()` and no wall-clock reads in `src/core/`. Enforceable by
  grep-based test; determinism verified by seeded-replay tests.
- **INV-3 (One-way state ownership):** The render layer never mutates simulation state except
  through `GameModel` methods. Enforced by review + the encapsulated model API.
- **INV-4 (Scoring correctness):** Score is monotonically non-decreasing and equals the cumulative
  brick value removed via partial damage, full destruction, and row clears. Test invariant.
- **INV-5 (Bomb cooldown):** At most one bomb is active, and a new bomb cannot be dropped while
  `cooldownRemaining > 0`. Test invariant.
- **INV-6 (Clean restart):** After restart, the model equals a freshly constructed initial state
  (score 0, no bomb, initial brick layout, `status: 'playing'`). Test invariant.
- **INV-7 (Value & tint bounds):** Brick values are always in `[1,30]`; the tint mapping is
  monotonic from green (low) to red (high) across the value range. Test invariant.
- **INV-8 (Collision rule fidelity):** For a single bomb↔brick interaction:
  greater → brick destroyed, bomb continues with `value -= brickValue`, score `+= brickValue`;
  lesser → bomb explodes/removed, `brickValue -= bombValue`, score `+= bombValue`;
  exact → both destroyed + entire row cleared, score `+= hitBrickValue + Σ remaining row values`,
  screen-shake event emitted. Test invariant.

### Decisions on PRD Open Questions (recorded, headless — no operator round-trip)

These are reversible tuning defaults; per the arch clarification protocol they do **not** warrant
an operator round-trip in a headless run. All are centralized in `config.js` for later re-tuning.

- **Design resolution:** 720×1280 (9:16 portrait), Phaser `Scale.FIT` + `CENTER_BOTH` for
  responsive fit across devices. (PRD Q1)
- **Row-clear scoring:** Award the brick's **remaining** value at the moment of clearing (matches
  "value removed or cleared"). (PRD Q2)
- **Partial-damage tint:** Yes — a damaged brick's tint updates immediately to reflect its reduced
  value. (PRD Q3)
- **Bomb drop position:** Drops from the top at the tapped horizontal position (snapped to the
  brick column grid), no aim/preview affordance. (PRD Q4)
- **Cooldown:** ~500 ms first-pass, tunable. (PRD Q5)
- **File-size:** No hard constraint; Phaser runtime is vendored locally (see risk register R1) to
  keep the playable self-contained. (PRD Q6)
- **Phaser delivery / tech:** Phaser 3 (pinned version) referenced by `index.html`; plain ES
  modules, **no bundler required**. Tests use Node's built-in `node:test` runner (`node --test`),
  which needs no installed test framework and never imports Phaser, so validation runs offline.

---

## 5. Observability

- **Logs:** Lightweight `console` diagnostics behind a `config.debug` flag (spawn events, collision
  outcomes, game-over reason). Off by default.
- **Metrics:** None external. An optional in-model debug readout (elapsed time, difficulty level,
  active brick count) may be surfaced during development.
- **Alerts:** N/A (client-only playable).
- **Debug hooks:** Seedable RNG allows deterministic replay of any session for debugging; a fixed
  seed + scripted input reproduces a bug exactly.

---

## 6. Security & Abuse Considerations

- **Auth boundaries:** None — no backend, no auth, no user data.
- **Data exposure risks:** None — nothing is collected, stored, or transmitted.
- **Abuse vectors:** Negligible; a fully client-side game with no network surface. The only
  external dependency is the Phaser runtime, which is version-pinned/vendored to avoid loading
  unexpected code.
- **Mitigations:** Pin/vendor the Phaser runtime; no `eval`, no remote data fetches.

---

## 7. Performance Considerations

- **Hot paths:** Per-frame `model.tick` (position updates + collision checks) and Phaser rendering
  (bricks, glow, particles) on mobile GPUs.
- **Expected scale:** Small — tens of bricks on screen, one bomb, short (~30–45 s) sessions.
- **Caching strategy:** Generate neon textures once at boot and reuse; avoid per-frame Graphics
  redraws. Reuse particle emitters rather than recreating them.
- **Backpressure / limits:** Cap concurrent particles and total brick count; collision checks are
  scoped to the bomb's column, keeping per-tick work near-constant. Target 60 fps on mid-range
  mobile, degrade particle counts if needed.

---

## 8. Rollback / Recovery Strategy

- **Rollback plan:** Greenfield feature on an isolated branch; rollback = revert the branch. No
  production system or data is affected.
- **Compatibility plan:** No backwards-compatibility constraints (PRD §5: no existing shell or
  persisted data). Phaser version is pinned to avoid runtime drift.
- **Data recovery considerations:** None — no persisted state exists.

---

## 9. Open Questions

- Q1: The accepted Phase 03 constants land no-input sessions in the 30–45 s window across the
  three fixed seeds exercised by integration tests. Whether that tuning produces the intended
  duration and feel for real first-time players remains a manual playtest question for the
  browser phases; the tunables remain centralized in `config.js`.
- Q2: Static neon palette endpoints, generated texture treatment, and configurable dynamic effect
  intensity/particle budgets are implemented through Phase 05. Real-device visual feel and frame
  rate remain part of the manual browser walkthrough (CF-01), not an architectural question.
