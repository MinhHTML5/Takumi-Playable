# Node Plan: Phase 02 — Simulation Core: Values, Grid & Scoring

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 02
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Rules

This document defines the authoritative execution sub-graph for Phase 02: the `build` and `debug`
nodes that planning materializes via `phase_execution_set`. `review` (the closure gate) and
`resolve` are provided by the `delivery_loop` and attach automatically after this sub-graph.
Aliases are stable identifiers; dependencies reference aliases only. Every node traces to Task
Inventory scope in `12-phase-plan.md` and must not expand beyond its Work Packet.

**Decomposition.** Phase 02 splits into **four build roots along module/validation seams** — one per
pure core module — plus a single debug node. Three roots are independent and run in parallel
(`P02-BUILD-RNG`, `P02-BUILD-GRID`, `P02-BUILD-SCORING`); `P02-BUILD-DIFFICULTY` depends on
`P02-BUILD-RNG` because its roll functions take the RNG instance as a **required input** (a real
data dependency, not incidental ordering). Each module is an independent validation surface, so
splitting keeps per-node context tight and lets a failure in one module retry without the others.

**Global core-purity constraint (all build nodes).** The existing `test/config.test.js` scans every
`*.js` under `src/core/` and fails if the lowercased contents contain `phaser`, `document`, or
`window` — **including comments and strings**. New modules must avoid those substrings entirely; in
particular the difficulty range functions are named `brickValueRange` / `bombValueRange`, never
`…Window`. INV-1 is therefore auto-enforced for the new modules with no additional test.

---

## 2. Node List

### Node: `P02-BUILD-RNG`
- Alias: `P02-BUILD-RNG`
- Lane: `lane:build`
- Title: `lane:build Phase 02 Build: Seedable Deterministic RNG (INV-2)`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md`  (§4.1 `rng.js`, §4.4 INV-2)
  - `../30-risk-register.md`  (R4)
  - `./12-phase-plan.md`  (T1)
  - `src/core/config.js`  (read-only; no changes)
- Outputs (paths):
  - `src/core/rng.js`
  - `test/rng.test.js`
- Work Packet (strict scope):
  - **T1** — Implement `src/core/rng.js`: export `createRng(seed)` returning an RNG with
    `next() -> float in [0,1)` and `nextInt(minInclusive, maxInclusive) -> integer in [min,max]`.
    Use a small deterministic PRNG (e.g. mulberry32 over a uint32 seed). Per-instance state only;
    two instances from the same seed produce identical sequences. **No** `Math.random`, no
    wall-clock (`Date`/`performance`), no Phaser/DOM. Obey the global core-purity constraint (§1).
  - Implement `test/rng.test.js` (`node:test` + `node:assert/strict`): determinism (same seed ⇒
    identical `next`/`nextInt` sequences), seed sensitivity (different seeds differ), `next()` ∈
    `[0,1)`, `nextInt` bounds incl. `nextInt(5,5)===5` and reachability of both endpoints over a
    large sample, and an **INV-2 core-purity guard** that reads every `*.js` under `src/core/` and
    asserts none contains (case-insensitive) `math.random`, `date.now`, `new date`, or
    `performance.now`.
  - Do NOT implement difficulty, grid, scoring, collision, simulation, or any rendering.
- Validation Commands:
  - `npm test`   (equivalently `node --test`)
- Validation Classes:
  - `unit`

### Node: `P02-BUILD-DIFFICULTY`
- Alias: `P02-BUILD-DIFFICULTY`
- Lane: `lane:build`
- Title: `lane:build Phase 02 Build: Difficulty & Value Scaling (INV-7 bounds)`
- Priority: `1`
- Depends On: `[P02-BUILD-RNG]`
- Inputs (paths):
  - `../10-tdd.md`  (§4.1 `difficulty.js`, §4.4 INV-7)
  - `../30-risk-register.md`  (R2)
  - `./12-phase-plan.md`  (T2)
  - `src/core/config.js`  (read-only: `difficulty`, `bomb.value`, `values`)
  - `src/core/rng.js`  (from `P02-BUILD-RNG` — required input to the roll functions)
- Outputs (paths):
  - `src/core/difficulty.js`
  - `test/difficulty.test.js`
- Work Packet (strict scope):
  - **T2** — Implement `src/core/difficulty.js` (pure; reads only `config` + injected `rng`, never
    time itself — elapsed is a parameter). Export:
    - `difficultyLevel(elapsedSeconds, config)` — integer `floor(elapsed / difficulty.levelInterval)`
      capped at `difficulty.maxLevel`.
    - `brickValueRange(elapsedSeconds, config) -> { min, max }` — bounds within `[1,30]`,
      non-decreasing in elapsed.
    - `bombValueRange(elapsedSeconds, config) -> { min, max }` — bounds clamped to `[1,30]`,
      non-decreasing in elapsed.
    - `rollBrickValue(elapsedSeconds, rng, config)` — integer in `brickValueRange`, guaranteed
      `∈ [1,30]`.
    - `rollBombValue(elapsedSeconds, rng, config)` — integer in `bombValueRange`, guaranteed
      `∈ [1,30]`.
    Curve constants come from `config.difficulty` / `config.bomb.value`; **do not add or rename
    config keys**. Obey the global core-purity constraint (§1) — use `brickValueRange` /
    `bombValueRange`, never `…Window`.
  - Implement `test/difficulty.test.js`: hard bound (all draws ∈ `[1,30]` at elapsed 0 / mid / huge),
    upward drift (ranges non-decreasing in elapsed; seeded sample mean at later elapsed ≥ earlier
    within a tolerance), bomb range scales upward, difficulty level capped at `maxLevel`, and
    determinism (same seed + elapsed ⇒ identical roll). Seed the RNG via `createRng` from
    `src/core/rng.js`.
  - Do NOT implement collision, the tick loop, the 30–45 s timing assertion (Phase 03), or any
    rendering.
- Validation Commands:
  - `npm test`
- Validation Classes:
  - `unit`

### Node: `P02-BUILD-GRID`
- Alias: `P02-BUILD-GRID`
- Lane: `lane:build`
- Title: `lane:build Phase 02 Build: Grid/Brick/Bomb Data Model & Row-Clear Helper`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md`  (§4.1 `grid.js`, §4.2 data model)
  - `../30-risk-register.md`
  - `./12-phase-plan.md`  (T3)
  - `src/core/config.js`  (read-only: `grid`, `design`)
- Outputs (paths):
  - `src/core/grid.js`
  - `test/grid.test.js`
- Work Packet (strict scope):
  - **T3** — Implement `src/core/grid.js` as the pure data model + helpers (no motion stepping, no
    spawn timing, no collision). Export `createBrick`, `createRow`, `columnCenterX`, `rowBricks`,
    `columnBricks`, `clearRow` (the row-clear helper returning `{ bricks, cleared, clearedValue }`),
    and `topEdgeY` (min alive `y`, `null` when none) — signatures per `12-phase-plan.md` §4 T3. Add
    a stable `row` id to the brick shape (`{ id, row, col, value, y, alive, fadeInProgress }`).
    Obey the global core-purity constraint (§1).
  - Implement `test/grid.test.js`: `createRow` yields `config.grid.columns` alive bricks with correct
    cols / shared row+y / unique ids; `rowBricks`/`columnBricks` return only alive bricks
    (`columnBricks` sorted by `y`); `clearRow` marks the target row's alive bricks dead, sums only
    alive values, leaves other rows untouched, and returns `0` for an empty/dead row; `topEdgeY`
    returns min alive `y` and `null` when empty; `columnCenterX` maps col 0 and the last column to
    the expected centers for 720×6.
  - Do NOT implement rising motion, spawn logic, collision, simulation, or rendering.
- Validation Commands:
  - `npm test`
- Validation Classes:
  - `unit`

### Node: `P02-BUILD-SCORING`
- Alias: `P02-BUILD-SCORING`
- Lane: `lane:build`
- Title: `lane:build Phase 02 Build: Score Accumulation (INV-4)`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md`  (§4.1 `scoring.js`, §4.4 INV-4)
  - `../30-risk-register.md`
  - `./12-phase-plan.md`  (T4)
  - `src/core/config.js`  (read-only)
- Outputs (paths):
  - `src/core/scoring.js`
  - `test/scoring.test.js`
- Work Packet (strict scope):
  - **T4** — Implement `src/core/scoring.js`: `createScore() -> { total: 0 }`,
    `addValue(scoreState, delta) -> newState` (total increases by `delta`; non-positive/non-finite
    delta never decreases the total — clamp negatives to 0), and `reset(scoreState) -> { total: 0 }`.
    Pure; returns new state objects (no mutation of the input). No dependency on rng/difficulty/grid.
    Obey the global core-purity constraint (§1).
  - Implement `test/scoring.test.js`: accumulation over a positive-delta sequence equals the running
    sum; monotonic non-decrease after every `addValue` including negative/`NaN`/`undefined` deltas;
    zero delta leaves total unchanged; `reset` returns `total === 0` and does not mutate the input.
  - Do NOT implement collision/cascade scoring, the tick loop, or rendering.
- Validation Commands:
  - `npm test`
- Validation Classes:
  - `unit`

### Node: `P02-DEBUG-STABILIZE`
- Alias: `P02-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 02 Debug: Stabilize Simulation-Core Modules`
- Priority: `1`
- Depends On: `[P02-BUILD-RNG, P02-BUILD-DIFFICULTY, P02-BUILD-GRID, P02-BUILD-SCORING]`
- Inputs (paths):
  - `./12-phase-plan.md`
  - `./13-node-plan.md`
  - `src/core/rng.js`, `src/core/difficulty.js`, `src/core/grid.js`, `src/core/scoring.js`
  - `test/rng.test.js`, `test/difficulty.test.js`, `test/grid.test.js`, `test/scoring.test.js`
  - `src/core/config.js`, `test/config.test.js`  (existing INV-1 scan now covers the new modules)
- Outputs (paths):
  - `takumi/runs/delivery/blockdrop-2/phase-02/stabilization-report.md`
- Work Packet (strict scope):
  - Execute the phase validation command `npm test`.
  - Diagnose any failure, apply bounded repairs within Phase 02 task scope (T1–T4 modules and their
    tests), and rerun until green or a stop condition is reached.
  - Confirm the INV-1 core-purity scan (existing `config.test.js`) and the INV-2 purity guard
    (`rng.test.js`) are present and passing over the new modules.
  - Produce `stabilization-report.md` recording commands run, outcomes, and any repairs.
- Validation Commands:
  - `npm test`
- Validation Classes:
  - `unit`

#### Debug Scope
Stabilizes the Phase 02 build output (the four pure core modules + their tests) within the
referenced build scope. No new feature work; no collision, simulation loop, rendering, or input.

#### Allowed Repair Surface
- Small implementation bugs in `rng.js` / `difficulty.js` / `grid.js` / `scoring.js` within Phase 02
  scope
- Test discovery / assertion wiring issues in the new `test/*.test.js` files (without weakening the
  behavior being asserted)
- ESM import/path mistakes between the new modules (e.g. difficulty importing rng)
- Accidental core-purity violations (a stray `Math.random`/wall-clock read, or a forbidden
  `phaser`/`document`/`window` substring) — replace with the injected RNG / rename identifiers

#### Stop Conditions
Debug must escalate with `status: blocked` (not defer) if:
- an architecture invariant is genuinely unsatisfiable (e.g. determinism truly requires a wall-clock
  read — a design contradiction)
- required functionality is missing in a way that needs an architecture decision
- more than 3 repair cycles hit the same failure class, or the same failure repeats after repair
  (defer to a remediation loop only if the fix is bounded and concretely stateable; otherwise block)

Debug must **not** weaken, skip, or delete a test to reach green — a skipped test is an unverified
invariant (INV-2 / INV-4 / INV-7).

---

## 3. Validation Classes

- `unit` — required this phase: RNG determinism/bounds, difficulty bounds/drift/determinism, grid
  helper behavior, scoring monotonicity, plus the INV-1 (existing) and INV-2 (new) core-purity
  assertions, all via `node --test`.
- `integration` — none this phase (no cross-module composition yet; the tick loop composes these
  primitives in Phase 03, where the 30–45 s game-over test lives).
- `contract` — none this phase (the `GameModel` public API is introduced and contract-tested in
  Phase 03).

---

## 4. Base Execution Order

```
P02-BUILD-RNG ─────────┬─> P02-BUILD-DIFFICULTY ─┐
                       │                          │
P02-BUILD-GRID ────────┼──────────────────────────┼─> P02-DEBUG-STABILIZE ─> review ─> resolve
                       │                          │
P02-BUILD-SCORING ─────┘                          │
   (RNG, GRID, SCORING are independent parallel roots; DIFFICULTY depends on RNG)
```

- Build nodes are defined here. `P02-BUILD-DIFFICULTY` depends on `P02-BUILD-RNG`
  (`rollBrickValue`/`rollBombValue` take the RNG as a required input). `P02-BUILD-GRID` and
  `P02-BUILD-SCORING` are independent roots and run in parallel with the RNG track.
- `P02-DEBUG-STABILIZE` depends on all four build nodes.
- `review` (closure gate) and `resolve` are provided by the `delivery_loop`. Review depends on
  debug; resolve depends on review (and any remediation-loop review nodes that rejoin).

---

## 5. Graph Constraints

- DAG, no cycles: `RNG → DIFFICULTY → DEBUG`, `GRID → DEBUG`, `SCORING → DEBUG`,
  `DEBUG → review → resolve`.
- Dependencies reference declared aliases only.
- Independent build roots (RNG, GRID, SCORING) run in parallel; DIFFICULTY has a real dependency on
  RNG and follows it.
- Debug depends on all build nodes; review depends on debug; resolve depends on review.

---

## 6. Remediation Loops (Runtime, Not Predefined)

Not predefined. Any build, debug, or review node may open a `remediation_loop`
(`build → debug → review`, rejoining at resolve) at closure for a blocking, in-scope, bounded defect.
Loops run in parallel and are bounded by `max_self_recurrence: 5`. Do not add remediation nodes to
this document.

---

## 7. Priority Contract

All Phase 02 nodes are priority `1` (High) — this simulation core is the foundation Phase 03's loop
and all later gameplay depend on. All values are within the allowed `0–4` range.
