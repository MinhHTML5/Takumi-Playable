# Phase Plan: Phase 02 — Simulation Core: Values, Grid & Scoring

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 02
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: `../phase-01/32-carry-forward.md`
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Phase Goal

Deliver the deterministic, **Phaser-free** primitives that later phases compose into the live game:
value generation (seedable RNG + difficulty scaling), the grid/brick/bomb **data model** (with a
row-clear helper), and score accumulation. Everything here is headlessly testable in Node via the
existing `node:test` harness.

This is the smallest safe slice that advances the feature while preserving architectural
invariants: it introduces **no simulation loop, no collision resolution, and no rendering** (those
are Phase 03 and Phase 04). Each module is an independent validation surface — RNG determinism,
difficulty bounds/drift, grid helpers, and scoring monotonicity can each be validated on their own,
and the four together leave the system coherent (a set of pure modules plus their unit tests, with
the shell from Phase 01 untouched).

Traceability: this phase realizes the "Simulation Core (`src/core/*.js`)" components in TDD §4.1
(`rng.js`, `difficulty.js`, `grid.js`, `scoring.js`) and the value/scoring parts of the data model
in TDD §4.2, and it is the phase where invariants **INV-2** (deterministic randomness) and **INV-4**
(scoring correctness) first become enforceable, plus the value-bounds half of **INV-7**.

---

## 2. Scope

### In-Scope
- `src/core/rng.js` — a **seedable, deterministic, injectable** RNG (the only randomness source in
  the core). Same seed ⇒ identical sequence. No `Math.random`, no wall-clock. (INV-2, R4)
- `src/core/difficulty.js` — pure functions mapping elapsed simulated time → the brick-value
  distribution and the bomb-value distribution, drawing through an **injected** RNG. Brick values
  always clamped to `[1,30]`; distribution centers drift **upward** as elapsed time increases.
  (INV-7 value bounds, R2)
- `src/core/grid.js` — the brick / row / bomb **data model** in abstract game units: brick and row
  constructors, row/column lookup helpers, and the **row-clear helper** (mark a row's alive bricks
  cleared and report the value removed). Pure data + helpers; no motion stepping, no collision.
- `src/core/scoring.js` — pure score accumulation from value removed/cleared; **monotonically
  non-decreasing**; supports reset to 0 for clean restart. (INV-4)
- Unit tests for each module under `test/` exercised by `npm test` (`node --test`).
- An **INV-2 purity assertion** (grep-style) verifying no `Math.random` / wall-clock read exists in
  `src/core/`.

### Out-of-Scope
- `src/core/collision.js` and `src/core/simulation.js` — the tick loop, collision cascade, rising
  motion, spawn timer, cooldown gate, and game-over detection (**Phase 03**).
- Any rendering, the neon-art factory (`src/render/neon.js`), tap→column input, tint-mapping helper,
  and juice effects (**Phase 04 / 05**).
- The game-over screen and restart CTA (**Phase 06**).
- Any change to `index.html`, `src/main.js`, or the Phase 01 scenes.
- Empirical tuning of difficulty constants to hit the 30–45 s window — that requires the running
  loop and is asserted by an **integration** test in **Phase 03** (R2). Phase 02 only guarantees the
  *shape*: bounded values and upward drift.
- Changes to `src/core/config.js` — all constants this phase needs already exist there; do **not**
  add or rename config keys.

Anything above under Out-of-Scope must not appear in the Task Inventory.

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `src/core/rng.js` + `test/rng.test.js`
- `src/core/difficulty.js` + `test/difficulty.test.js`
- `src/core/grid.js` + `test/grid.test.js`
- `src/core/scoring.js` + `test/scoring.test.js`
- `takumi/runs/delivery/blockdrop-2/phase-02/stabilization-report.md` (debug node output)

### Exit Criteria
- [ ] Implementation tasks complete (T1–T4)
- [ ] Required validation commands pass — `npm test` green with all four new suites plus the
      existing `config.test.js` (including the INV-1 core-purity scan over the new modules)
- [ ] Debug stabilization completed
- [ ] Review completed with `accept` (correctness + structural)
- [ ] No invariant violations introduced — INV-1 (new core modules import no Phaser/DOM), INV-2
      (determinism + no `Math.random`/wall-clock in core), INV-4 (scoring monotonic & correct),
      INV-7 value bound (brick values ∈ `[1,30]`)
- [ ] Carry-forward items from Phase 01 were explicitly evaluated (see §10)
- [ ] All remediation loops resolved (loop review `accept`), if any were opened

---

## 4. Task Inventory (Canonical Scope)

Every build, debug, and review node traces back to a task here. No lane may invent work outside
this inventory.

> **Global core-purity constraint (applies to T1–T4).** The existing `test/config.test.js` scans
> **every** `*.js` file under `src/core/` and fails if its (lowercased) contents contain the
> substring `phaser`, `document`, or `window` — **including comments and string literals**.
> Therefore the new modules must not use those words anywhere. In particular, name the
> distribution-range functions `brickValueRange` / `bombValueRange` (**never** `…Window`), and do
> not write "window"/"document" in comments. This is auto-enforced — INV-1 needs no new test.

### T1 — Seedable deterministic RNG (`rng.js`)
- Task ID: T1
- Type: implementation
- Description: Implement a small, seedable, deterministic PRNG (e.g. mulberry32-style over a uint32
  seed) as the single randomness primitive for the core. Export a factory that returns an RNG
  instance; no module-level mutable state shared across instances.
- Files / Areas: `src/core/rng.js`, `test/rng.test.js`
- Outputs:
  - `createRng(seed: number) -> Rng` where `Rng` exposes:
    - `next() -> number` — float in `[0, 1)`
    - `nextInt(minInclusive: number, maxInclusive: number) -> number` — integer in `[min, max]`
      inclusive (assumes `min <= max`)
  - Deterministic: two instances built from the same seed yield identical `next()` / `nextInt()`
    sequences.
- Test Intent (unit, INV-2 / R4):
  - **Determinism (positive):** two `createRng(1234)` instances produce identical sequences over
    the first N `next()` calls and N `nextInt(1,30)` calls.
  - **Seed sensitivity (negative):** `createRng(1)` and `createRng(2)` produce sequences that are
    not identical over N draws.
  - **`next()` range (edge):** across N draws every value is `>= 0` and `< 1`.
  - **`nextInt` bounds (edge):** across N draws `nextInt(1,30)` is always an integer in `[1,30]`;
    `nextInt(5,5)` always returns `5`; boundary values `min` and `max` are both reachable over a
    large sample.
  - **Core-purity / INV-2 (guard):** read every `*.js` under `src/core/` and assert none contains
    (case-insensitive) `math.random`, `date.now`, `new date`, or `performance.now` — no direct
    randomness or wall-clock in the core.
- Validation Commands: `npm test`
- Dependencies: none

### T2 — Difficulty / value scaling (`difficulty.js`)
- Task ID: T2
- Type: implementation
- Description: Pure functions mapping elapsed simulated seconds → difficulty level and → the brick-
  and bomb-value distributions, drawing concrete values through an **injected** RNG. Consumes only
  `config` (difficulty, bomb.value, values) and the RNG — reads no time itself (elapsed is passed
  in). Curve constants come from `config.difficulty` / `config.bomb.value`; do not add new config
  keys. Exact internal curve is the build's choice provided the invariants below hold.
- Files / Areas: `src/core/difficulty.js`, `test/difficulty.test.js`
- Outputs (public API):
  - `difficultyLevel(elapsedSeconds, config) -> number` — integer level, `floor(elapsed /
    config.difficulty.levelInterval)` capped at `config.difficulty.maxLevel`.
  - `brickValueRange(elapsedSeconds, config) -> { min, max }` — the current brick-value distribution
    bounds; both ends within `[config.values.brickMin, config.values.brickMax]` (i.e. `[1,30]`) and
    **non-decreasing** in `elapsedSeconds`.
  - `bombValueRange(elapsedSeconds, config) -> { min, max }` — the current bomb-value bounds,
    clamped to `[1,30]` and **non-decreasing** in `elapsedSeconds`.
  - `rollBrickValue(elapsedSeconds, rng, config) -> number` — integer drawn within
    `brickValueRange`, guaranteed `∈ [1,30]`.
  - `rollBombValue(elapsedSeconds, rng, config) -> number` — integer drawn within `bombValueRange`,
    guaranteed `∈ [1,30]`.
- Test Intent (unit, INV-7 value bound / R2 / INV-2):
  - **Hard bound (edge, INV-7):** over N seeded draws at several elapsed points (0, mid, very large),
    `rollBrickValue` is always an integer in `[1,30]`; likewise `rollBombValue`.
  - **Upward drift (positive, R2):** for `t2 > t1`, `brickValueRange(t2).min >= brickValueRange(t1).min`
    and `.max >= .max`; and the **sample mean** of many seeded `rollBrickValue(t2,…)` draws is
    `>=` the mean at `t1` (assert with a tolerance margin, fixed seed). Same monotonic-mean check
    for `rollBombValue`.
  - **Bomb range scales upward (positive):** `bombValueRange` bounds are non-decreasing in elapsed.
  - **Cap (edge):** `difficultyLevel` never exceeds `config.difficulty.maxLevel`; ranges at a huge
    elapsed value stay within `[1,30]` (no overflow past the cap).
  - **Determinism (positive, INV-2):** same seed + same elapsed ⇒ identical rolled value(s).
- Validation Commands: `npm test`
- Dependencies: T1 (RNG is a required input to the roll functions and their tests)

### T3 — Grid / brick / bomb data model + row-clear helper (`grid.js`)
- Task ID: T3
- Type: implementation
- Description: The abstract-game-unit **data model** and pure helpers for bricks, rows, and bomb
  position — no motion stepping, no spawn timing, no collision resolution (those live in Phase 03's
  `simulation.js` / `collision.js`). Reads grid geometry from `config.grid`.
- Files / Areas: `src/core/grid.js`, `test/grid.test.js`
- Outputs (public API — augments the illustrative TDD §4.2 shape with a stable `row` id so the
  row-clear helper is robust under later rising motion):
  - `createBrick({ id, row, col, value, y }) -> Brick` where
    `Brick = { id, row, col, value, y, alive: true, fadeInProgress: 0 }`.
  - `createRow({ row, values, y, startId, config }) -> Brick[]` — build one brick per column
    (`values.length === config.grid.columns`), each with `col = index`, shared `row` and `y`,
    sequential ids from `startId`, `alive: true`.
  - `columnCenterX(col, config) -> number` — x center of a column in game units
    (`col * (config.design.width / config.grid.columns) + half-column`).
  - `rowBricks(bricks, row) -> Brick[]` — the **alive** bricks belonging to `row`.
  - `columnBricks(bricks, col) -> Brick[]` — the **alive** bricks in `col`, sorted by `y` (prep for
    the Phase 03 bomb cascade).
  - `clearRow(bricks, row) -> { bricks, cleared, clearedValue }` — the **row-clear helper**: return
    an updated bricks collection with every alive brick in `row` marked `alive: false`, the list of
    `cleared` bricks, and `clearedValue` = sum of their values. Other rows untouched.
  - `topEdgeY(bricks) -> number | null` — smallest `y` among alive bricks (closest to the top), used
    later as the game-over/danger metric; `null` when no bricks are alive.
- Test Intent (unit):
  - **createRow (positive):** produces `config.grid.columns` bricks with `col` `0..columns-1`,
    identical `row`/`y`, unique sequential ids, all `alive`.
  - **rowBricks / columnBricks (positive + edge):** return only alive bricks; exclude a brick after
    it is marked not alive; `columnBricks` is sorted by `y`.
  - **clearRow (positive + edge):** marks all alive bricks of the target row not alive and returns
    `clearedValue` = sum of *alive* values only (a row with one already-dead brick sums the
    remainder); leaves bricks in other rows unchanged; clearing an empty/dead row returns
    `clearedValue === 0`.
  - **topEdgeY (edge):** returns the min alive `y`; returns `null` for an all-dead/empty collection.
  - **columnCenterX (positive):** column 0 and the last column map to the expected centers for the
    720-wide, 6-column design.
- Validation Commands: `npm test`
- Dependencies: none

### T4 — Score accumulation (`scoring.js`)
- Task ID: T4
- Type: implementation
- Description: Pure, monotonic score accumulation from value removed/cleared, with a reset for
  clean restart (supports INV-6 later). No dependency on RNG, difficulty, or grid.
- Files / Areas: `src/core/scoring.js`, `test/scoring.test.js`
- Outputs (public API):
  - `createScore() -> ScoreState` — initial `{ total: 0 }`.
  - `addValue(scoreState, delta) -> ScoreState` — return a new state whose `total` increases by
    `delta`; a non-positive or non-finite `delta` must **never decrease** the total (clamp negatives
    to 0). (INV-4)
  - `reset(scoreState) -> ScoreState` — return an initial `{ total: 0 }` state (restart support).
- Test Intent (unit, INV-4):
  - **Accumulation (positive):** applying a sequence of positive deltas yields the exact running
    sum.
  - **Monotonic (invariant):** after each `addValue`, `total` is `>=` the previous total for any
    delta, including negative/`NaN`/`undefined` deltas (which leave the total unchanged).
  - **Zero delta (edge):** `addValue(s, 0)` leaves `total` unchanged.
  - **Reset (positive, restart support):** `reset` returns `total === 0` and does not mutate the
    passed-in state (fresh object).
- Validation Commands: `npm test`
- Dependencies: none

---

## 5. Task Breakdown (Human Organization)

There is no backend/frontend split — this is a single-repo (Takumi-Playable), pure-logic phase. All
tasks are core-logic tasks under `src/core/` with co-located tests under `test/`.

### 5.1 Core-logic Tasks
- Task: Seedable RNG
  - Task ID: T1
  - Files/Areas: `src/core/rng.js`, `test/rng.test.js`
  - Notes: Foundation for determinism (INV-2). Also carries the INV-2 core-purity grep guard.
  - Depends on: —
- Task: Difficulty / value scaling
  - Task ID: T2
  - Files/Areas: `src/core/difficulty.js`, `test/difficulty.test.js`
  - Notes: Draws through the injected RNG; brick values clamped `[1,30]`; ranges drift upward.
  - Depends on: T1 (RNG is a required input)
- Task: Grid data model + row-clear helper
  - Task ID: T3
  - Files/Areas: `src/core/grid.js`, `test/grid.test.js`
  - Notes: Pure data model only; no motion/collision. Adds a stable `row` id to the brick shape.
  - Depends on: —
- Task: Scoring accumulator
  - Task ID: T4
  - Files/Areas: `src/core/scoring.js`, `test/scoring.test.js`
  - Notes: Monotonic (INV-4); reset supports later clean restart.
  - Depends on: —

### 5.2 Frontend Tasks
- None this phase (no rendering; Phaser scenes are untouched).

### 5.3 Cross-Cutting Tasks
- Core-purity enforcement: INV-1 is auto-covered for the new modules by the existing
  `test/config.test.js` scan; INV-2's no-`Math.random`/wall-clock guard is added within T1's test.
  No standalone task node — folded into T1 and the existing harness.

---

## 6. Dependency Notes (Human Explanation)

- **T2 depends on T1** because `rollBrickValue` / `rollBombValue` take the RNG instance produced by
  `createRng` as a required input, and T2's tests seed that RNG to assert determinism and drift.
  This is a **real input dependency**, not incidental ordering.
- **T1, T3, T4 are independent roots** — RNG, the grid data model, and the scoring accumulator share
  no inputs and can be built and validated in parallel. Do not serialize them.
- **Debug stabilization** depends on all four build tasks because it runs the whole `npm test` suite
  over the combined core.
- **Review** depends on debug; **closure readiness** depends on review `accept` (and any
  remediation-loop reviews rejoining at resolve).

---

## 7. Validation Plan

### 7.1 Validation Classes

Required for this phase:
- `unit` — all four modules are pure logic validated in isolation: RNG determinism/bounds,
  difficulty bounds/drift/determinism, grid helper behavior, scoring monotonicity. Plus the INV-1
  (existing) and INV-2 (new) core-purity assertions.

Optional for this phase:
- None.

Not applicable this phase:
- `integration` — no cross-module composition exists yet; the value/grid/scoring primitives are
  first composed by the tick loop in **Phase 03**, where the 30–45 s game-over integration test
  (R2) and the collision/cascade coverage (R6) live.
- `contract` — the `GameModel` public API (TDD §4.3) is introduced and contract-tested in
  **Phase 03**; no public contract surface ships in Phase 02.

### 7.2 Validation Commands

Authoritative validation gate for the phase:

- Unit tests: `npm test`   (equivalently `node --test`)
- Integration tests: none this phase
- Contract tests: none this phase
- Migrations / reset steps: none (no persistence)
- Seed steps: none
- Build / lint: none beyond `npm test` (Node ESM parses each module on import; no bundler/linter is
  configured in this repo)

All required commands must pass before the phase may exit. `npm test` must discover and pass the
four new suites **and** the pre-existing `config.test.js` (whose INV-1 scan now also covers the new
`src/core/` modules).

### 7.3 Completion Artifact Validation

Each node concludes with a `takumi_complete` call carrying a valid artifact: `schema_version: 1`,
matching `node_id` / `run_id`, terminal `status`, `outcome`, a `summary`, and `directives`
(`close_node` always; `record_repo_changes` with real 40-char SHAs when commits were made).

### 7.4 Debug Stabilization Contract

The debug node executes `npm test`, diagnoses failures, applies **bounded** repairs within Phase 02
task scope (T1–T4 modules and their tests), and reruns until green or a stop condition is reached.
Debug must not add new feature scope (no collision/simulation/render work) and must not weaken or
skip a test to reach green.

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** (never defer) when:
- an architecture invariant is genuinely unsatisfiable (e.g. determinism cannot hold without a
  wall-clock read — a design contradiction),
- required functionality is missing in a way that needs an architecture decision, or
- the defect reveals a broader systemic issue outside debug authority.

Debug may apply bounded stabilization, or defer a **bounded, concretely-fixable** defect to a
remediation loop, only when: more than 3 repair cycles hit the same failure class, or the same
failure repeats after repair. A defect with no stateable bounded fix must be **blocked**, not looped.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it checks correctness and scope compliance, validation-evidence
sufficiency (do the tests actually fail when the behavior breaks — see §7.7), and structural
integrity / invariant preservation (INV-1, INV-2, INV-4, INV-7 value bound). Blocking in-scope
defects open `remediation_loop`s (`build → debug → review`) that rejoin at resolve; the phase closes
only when the phase review and every loop review record `accept`. Loops are bounded
(`max_self_recurrence: 5`); on exhaustion with issues remaining, review escalates `blocked`.

### 7.7 Edge Cases to Validate

- `nextInt(min, max)` with `min === max` (single-value range) and reachability of both bounds.
- Brick/bomb value draws at very large elapsed time stay within `[1,30]` (curve cap, no overflow).
- Difficulty level capped at `config.difficulty.maxLevel`.
- `clearRow` on a row with some already-dead bricks sums only alive values; on an empty/dead row
  returns `clearedValue === 0`.
- `topEdgeY` on an all-dead / empty collection returns `null`.
- `addValue` with negative / `NaN` / `undefined` delta never decreases the total.
- Determinism: identical seed reproduces identical RNG and difficulty-roll sequences.

---

## 8. Environment Contract

No runtime environment required. The phase validates entirely with the local `node --test` runner
against pure ES modules; there is no server, browser, database, or external service in the loop.

---

## 9. Risk Touchpoints

- **R4 — Non-deterministic core (Phase Most Affected: Phase 02).** Mitigated here directly:
  `rng.js` is the single injected randomness source (INV-2); difficulty and all draws flow through
  it; seeded-replay tests assert reproducibility and a grep guard asserts no `Math.random`/wall-clock
  in `src/core/`.
- **R2 — Difficulty tuning misses the 30–45 s target (introduced in Phase 02, Most Affected:
  Phase 03).** This phase establishes the *shape* the tuning relies on: every constant stays in
  `config.js`, and tests assert bounded values (`[1,30]`) and **upward drift** without asserting the
  final time window. The empirical 30–45 s assertion is a Phase 03 integration test over the running
  loop — deliberately deferred because no loop exists yet.
- **INV-7 (value bounds) / INV-2 / INV-4** invariant threats from the risk register §2 are exercised
  by the unit suites above.

---

## 10. Carry Forward Consumption

Prior phase (01) `../phase-01/32-carry-forward.md` has three open items. Each is addressed:

- Carry Forward ID: **CF-01** — Execute the mobile-portrait browser boot / neon-background check.
  - Source: Phase 01 review §8 manual DoD item; review node
    `8dae50e7-00e4-4266-9248-9d5e75269d48`.
  - Disposition: **Deferred again.**
  - Rationale: Phase 02 adds only Phaser-free `src/core/` logic and no rendering, shell, or browser
    surface, so there is nothing new to boot-check. The check still belongs before accepting
    Rendering & Input Binding (Phase 04), as originally recommended.
  - Related Task IDs: none.

- Carry Forward ID: **CF-02** — Remove the pre-existing empty `Test.txt` in a scoped cleanup task.
  - Source: Phase 01 review §7 advisory 1 + stabilization report §5; review node
    `8dae50e7-00e4-4266-9248-9d5e75269d48`.
  - Disposition: **Deferred again.**
  - Rationale: Phase 02's scope is a set of new pure-logic core modules; it contains no
    repository-cleanup task, and bundling an unrelated tracked-file deletion into this pure-logic
    slice would blur the phase's validation surface and obscure provenance. It remains best done in
    a phase with an explicit cleanup task, or in Phase 06 final integration cleanup, per the
    original recommendation.
  - Related Task IDs: none.

- Carry Forward ID: **CF-03** — Debug-only warning for unknown scale configuration tokens.
  - Source: Phase 01 review §7 advisory 2 + code review §2.3; review node
    `8dae50e7-00e4-4266-9248-9d5e75269d48`.
  - Disposition: **Deferred again.**
  - Rationale: The scale-token mapping lives in `src/main.js`, which Phase 02 does not touch
    (touching it would violate INV-1 by pulling Phaser-boundary concerns into a core-only phase).
    The warning remains best added when the Phaser input/render boundary is next modified in
    Phase 04, as originally recommended.
  - Related Task IDs: none.

No new carry-forward is created by planning; any Phase 02 deferrals will be authored at phase
closure by resolve.

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES (INV-1, INV-2, INV-4, INV-7 value bound directly exercised;
  INV-3/5/6/8 not in scope this phase and untouched).
- Any invariant modifications: NONE.
- Risk register regression concerns: NONE — no existing behavior is modified; only new `src/core/`
  modules and tests are added. The Phase 01 shell and `config.js` are untouched.
- Deferred work impact review: NONE — the three Phase 01 carry-forward items are all render/shell/
  cleanup concerns with no bearing on this pure-logic phase (see §10).
- Prior carry-forward reviewed: YES.
- Carry-forward items brought into scope this phase: NONE.
- Carry-forward items deferred again: CF-01, CF-02, CF-03.

---

## 12. Phase Closure Contract

Required base sequence: **build → debug → review → resolve**.

- Build: `P02-BUILD-RNG`, `P02-BUILD-DIFFICULTY`, `P02-BUILD-GRID`, `P02-BUILD-SCORING`
  (see `13-node-plan.md`).
- Debug: `P02-DEBUG-STABILIZE` runs the full `npm test` gate.
- Review is the single closure gate; any remediation loops it opens run in parallel and rejoin at
  resolve.

The phase exits only when the phase review records `accept` and every remediation-loop review
records `accept`. Only then does resolve reconcile artifacts (updating `20-phases.md`, the TDD
implemented-state note, and the risk register for R4/R2) and close the phase.
