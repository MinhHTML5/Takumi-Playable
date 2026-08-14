# Phase Plan: Phase 03 — Simulation Loop: Collision, Rising & Game Over

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 03
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: `../phase-02/32-carry-forward.md`
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Phase Goal

Deliver the **complete headless game model**: the deterministic simulation loop that composes
the Phase 02 primitives (RNG, difficulty/value scaling, grid/row helpers, scoring) into a playable
rules engine — with **no rendering and no Phaser dependency**.

This phase adds two Phaser-free core modules:

1. `src/core/collision.js` — a pure resolver of a **single** bomb↔brick interaction
   (greater / lesser / exact), returning the interaction's state deltas.
2. `src/core/simulation.js` — the orchestrating **`GameModel`**: owns all mutable game state and
   advances it each tick (rising bricks, spawn timer, falling bomb, the collision cascade,
   exact-match row clears, scoring integration, the one-bomb cooldown gate, and game-over
   detection), exposing the stable public API defined in TDD §4.3.

This is the **smallest safe slice** that produces a fully validatable game: the heavy, subtle logic
(collision cascade, difficulty-driven game-over timing) becomes exercisable headlessly in Node
*before* any rendering exists (Phase 04). It is a coherent validation boundary — every rule and the
end-to-end session can be asserted with `node --test` with zero browser surface.

Within the phase, `collision.js` is a genuine seam of independence (a pure function with its own
unit suite, validatable alone); `simulation.js` composes it. The `GameModel` and its in-tick
cascade are a single atomic unit — the cascade lives inside `tick` and cannot be validated apart
from the model — so they stay in one build node (see the node plan).

---

## 2. Scope

### In-Scope
- `src/core/collision.js`: pure `resolveCollision` for one bomb↔brick interaction — the three
  outcome rules of INV-8 expressed as returned deltas (no state ownership, no row iteration).
- `src/core/simulation.js`: the `GameModel` class with the TDD §4.3 API — `new GameModel({ config,
  rng })`, `dropBomb(x)`, `tick(dtSeconds)`, `getState()`, `consumeEvents()`, `reset()`.
- The tick pipeline: advance time & difficulty level, decrement cooldown, run the spawn timer,
  rise the brick stack, advance the falling bomb, run the collision cascade down the bomb's column,
  apply exact-match full-row clears (via `grid.clearRow`), integrate scoring (via `scoring.addValue`),
  and detect game-over when the stack reaches the top.
- A per-tick `pendingEvents` queue drained by `consumeEvents()` (juice hooks for Phases 04–05):
  `spawn`, `explosion`, `rowClear`, `gameover`.
- **Additive** simulation tunables in `src/core/config.js` if the loop needs them (e.g. initial
  row count, game-over top boundary). Additive only — no change to any value asserted by the
  existing `test/config.test.js`.
- Unit, integration, and contract tests under `test/` for the above.

### Out-of-Scope
- Any rendering, Phaser scene wiring, textures, tint mapping, input handling, or juice visuals
  (Phases 04–05).
- `GameOverScene` / restart UI (Phase 06).
- Editing `src/main.js`, `index.html`, `src/scenes/*`, or `vendor/*`.
- Changing existing accepted `config.js` values, or any Phase 02 core module's behavior.
- Empirical *final* palette/art (Phase 04+) and manual browser DoD checks (Phase 04, CF-01).
- Removing `Test.txt` (CF-02) and the scale-token debug warning (CF-03) — neither is in this
  pure-core phase's scope (see §10).

This section prevents phase bleed. Nothing out-of-scope appears in the Task Inventory.

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `src/core/collision.js` — pure single-interaction resolver.
- `src/core/simulation.js` — the `GameModel` orchestrator.
- `test/collision.test.js` — unit coverage of the three collision rules and boundaries.
- `test/simulation.test.js` — unit + contract coverage of the model (dropBomb gate, tick mechanics,
  scoring, reset, value bounds, public API shape).
- `test/simulation.integration.test.js` — integration coverage: multi-brick cascade, exact-match
  row clear aggregate, and the no-input session reaching game-over within the ~30–45 s window.
- Additive simulation tunables in `src/core/config.js` (only if required by the loop).

### Exit Criteria
- [ ] Implementation tasks complete (T1, T3; plus additive config in T3 if needed)
- [ ] Required validation commands pass (`node --test` green; INV-1 purity scan still green)
- [ ] Debug stabilization completed
- [ ] Review completed with `accept` (correctness + structural)
- [ ] No invariant violations introduced (INV-1, INV-2, INV-4, INV-5, INV-6, INV-7, INV-8 hold)
- [ ] Carry-forward items from the prior phase were explicitly evaluated (§10)
- [ ] All remediation loops resolved (loop review `accept`)

Phase-specific exit criteria (from `20-phases.md` §Phase 03):
- [ ] All three collision rules behave exactly as specified, including the multi-brick cascade and
      the exact-match full-row clear (unit + integration). **(INV-8)**
- [ ] `dropBomb` respects the cooldown and the single-active-bomb rule (unit). **(INV-5)**
- [ ] A headless session (spawn → rise → no input) reaches game-over, and under the tuned seed
      lands within ~30–45 s of simulated time (integration). **(R2)**
- [ ] `GameModel`'s public API returns the state/event shape defined in TDD §4.3 (contract).

---

## 4. Task Inventory (Canonical Scope)

Every build, debug, and review node traces back to these tasks. No lane may invent work outside
this inventory.

### T1 — Implement `collision.js` (single bomb↔brick resolver)

- Task ID: T1
- Type: implementation
- Description: A pure, Phaser-free function that resolves **one** bomb↔brick interaction by numeric
  comparison and returns the resulting deltas. It owns **no** state and performs **no** row
  iteration — it maps `(bombValue, brickValue)` to an outcome per INV-8. Exact API:
  `resolveCollision(bombValue, brickValue) -> result`, where `result` is:
  - **greater** (`bombValue > brickValue`):
    `{ outcome: 'greater', brickDestroyed: true, bombSurvives: true, newBombValue: bombValue - brickValue, brickRemainingValue: 0, triggersRowClear: false, scoreGained: brickValue }`
  - **lesser** (`bombValue < brickValue`):
    `{ outcome: 'lesser', brickDestroyed: false, bombSurvives: false, newBombValue: 0, brickRemainingValue: brickValue - bombValue, triggersRowClear: false, scoreGained: bombValue }`
  - **exact** (`bombValue === brickValue`):
    `{ outcome: 'exact', brickDestroyed: true, bombSurvives: false, newBombValue: 0, brickRemainingValue: 0, triggersRowClear: true, scoreGained: 0 }`
  - **Scoring ownership (avoid double-count):** for `exact`, `scoreGained` is `0` here **on
    purpose** — the entire-row value (hit brick + Σ remaining row bricks) is scored by
    `simulation.js` via `grid.clearRow`'s `clearedValue` (T3), keeping a single source of truth for
    the row-clear award (INV-8: `score += hitBrickValue + Σ remaining row values`).
- Files / Areas: `src/core/collision.js`.
- Outputs: `resolveCollision` (named export) + a `default` export object mirroring the module
  functions, matching the house convention of the other core modules.
- Test Intent: (see T2) unit-verify each of the three outcome branches and their exact delta
  fields, including the boundary between greater/exact (`bomb == brick`) and lesser/exact.
- Validation Commands: `node --test test/collision.test.js`
- Dependencies: none (pure function; no import of other core modules required).

### T2 — Unit tests for `collision.js`

- Task ID: T2
- Type: test
- Description: Assert every INV-8 branch and its full delta object. Cover: greater with
  `newBombValue = bombValue - brickValue` and `scoreGained = brickValue`; lesser with
  `brickRemainingValue = brickValue - bombValue`, `bombSurvives: false`, `scoreGained = bombValue`;
  exact with `triggersRowClear: true`, both destroyed, `scoreGained: 0`. Include boundary values
  (e.g. bomb one above / one below / equal to brick; brick at value 1 and 30).
- Files / Areas: `test/collision.test.js`.
- Outputs: passing `node:test` suite for `collision.js`.
- Test Intent: unit-test `resolveCollision` for the positive (each outcome resolves to the
  specified deltas), negative-adjacent (a `greater` input never reports `bombSurvives:false`; a
  `lesser` input never destroys the brick), and edge (equality boundary; min/max brick values)
  cases — each assertion specific to the exact delta value, not a truthiness check.
- Validation Commands: `node --test test/collision.test.js`
- Dependencies: T1.

### T3 — Implement `simulation.js` (`GameModel` orchestrator)

- Task ID: T3
- Type: implementation
- Description: The stateful, Phaser-free `GameModel` that owns all game state and advances it each
  tick, composing the Phase 02 primitives and T1's resolver. Contract (TDD §4.3):
  - `new GameModel({ config, rng })` — construct a fresh session. On construction, seed the initial
    brick layout: `initialRows` rows stacked at the bottom of the playfield (bottom-anchored,
    one brick per column via `grid.createRow`, values drawn with `difficulty.rollBrickValue(0, rng,
    config)`), `time = 0`, `score = 0` (via `scoring.createScore`), `bomb = null`,
    `cooldownRemaining = 0`, `status = 'playing'`, empty `pendingEvents`.
  - `dropBomb(x) -> boolean` — attempt to drop a bomb. Returns `false` (no state change) when
    `cooldownRemaining > 0` **or** a bomb is already active (INV-5). On success: snap `x`
    (game-unit horizontal position) to a column `col = clamp(floor(x / columnWidth), 0, columns-1)`
    where `columnWidth = config.design.width / config.grid.columns`; create the single active bomb
    at the top (`y = 0`, at `col`) with value `difficulty.rollBombValue(time, rng, config)`; set
    `cooldownRemaining = config.bomb.cooldown`; emit an `explosion`-precursor is **not** required
    here (drop is silent; detonation events come from the cascade). Returns `true`.
  - `tick(dtSeconds) -> void` — advance the whole simulation by `dt`, in this order:
    1. `time += dt`; recompute `difficultyLevel = difficulty.difficultyLevel(time, config)`.
    2. `cooldownRemaining = max(0, cooldownRemaining - dt)`.
    3. **Spawn timer:** accumulate elapsed; each time it reaches `config.spawn.interval`, spawn a
       new bottom row (values via `rollBrickValue(time, rng, config)`), append a `spawn` event, and
       carry the remainder.
    4. **Rise:** move every alive brick toward the top by `riseSpeed * dt`, where
       `riseSpeed = config.rise.speed + difficultyLevel * config.difficulty.riseSpeedGrowthPerLevel`.
       (Rising decreases a brick's `y`; the top boundary is `y = 0`.)
    5. **Bomb fall + cascade:** if a bomb is active, advance it downward by
       `config.bomb.fallSpeed * dt`, then resolve every alive brick in the bomb's column that the
       bomb now overlaps, **top-down**, via `resolveCollision`:
       - *greater* → mark the brick dead, `score += brickValue`, set the bomb's value to
         `newBombValue`, emit `explosion`; the bomb **survives and continues** (may overlap the next
         brick this same tick — hence the cascade "chews through" the column).
       - *lesser* → reduce the brick's `value` to `brickRemainingValue` (brick stays alive),
         `score += bombValue`, remove the bomb, emit `explosion`; cascade ends.
       - *exact* → clear the hit brick's **entire row** via `grid.clearRow(bricks, row)`,
         `score += clearedValue` (= hit brick + Σ remaining row values), remove the bomb, emit
         `explosion` **and** a `rowClear` event (the screen-shake trigger, INV-8); cascade ends.
       - If the bomb passes the bottom of the playfield with no terminal interaction, remove it
         (a miss); no score change.
       All score updates go through `scoring.addValue` (INV-4). Brick values stay in `[1,30]`
       throughout (INV-7) — a `lesser` reduction never drops a brick below 1 because it only
       applies when `bombValue < brickValue`.
    6. **Game-over:** after rising, if the topmost alive brick has reached the top boundary
       (`grid.topEdgeY(bricks) <= gameOverTopY`, with `gameOverTopY = 0` unless an additive config
       tunable is introduced), set `status = 'gameover'` and emit a `gameover` event once. A model
       in `gameover` ignores further `tick`/`dropBomb` mutations.
  - `getState() -> readonly snapshot` — return a read-only snapshot the render layer consumes:
    `{ time, status, score, difficultyLevel, bricks: [...brick snapshots], bomb: {…}|null,
    danger: { topEdgeY } }`. Returned data must not alias internal mutable state (return copies /
    frozen objects) so callers cannot mutate the model except through its methods (INV-3).
  - `consumeEvents() -> Event[]` — drain and return the `pendingEvents` accumulated since the last
    call; a subsequent call with no intervening tick returns `[]`. Event shape: `{ type, ...payload }`
    with `type ∈ { 'spawn', 'explosion', 'rowClear', 'gameover' }` (payloads may carry e.g. `col`,
    `row`, `x`, `value` for downstream juice).
  - `reset() -> void` — return the model to its initial structural state (score 0, `bomb` null,
    `status: 'playing'`, `time` 0, `pendingEvents` empty, a freshly seeded `initialRows` layout),
    equal in structure to a freshly constructed model (INV-6).
  - **Additive config:** if the loop needs `initialRows` and/or `gameOverTopY`, add them to
    `src/core/config.js` (`grid.initialRows`, `rise`/`gameOver` key) as pure data — additive only,
    no change to existing asserted keys, no new forbidden tokens (INV-1).
  - **Difficulty/timing tuning (R2):** tune `initialRows` and the existing `config.rise` /
    `config.difficulty` / `config.spawn` values so a fixed-seed, no-input session reaches game-over
    within ~30–45 s of simulated time (asserted by T3's integration test). Tuning touches
    `config.js` data only.
- Files / Areas: `src/core/simulation.js`, `src/core/config.js` (additive only).
- Outputs: `GameModel` (named export) + `default` export, matching house convention.
- Test Intent: (see below — this task's tests live in `test/simulation.test.js` and
  `test/simulation.integration.test.js`) the dropBomb gate (INV-5), tick mechanics (rise, spawn,
  cooldown decay), the cascade rules and row-clear aggregate (INV-8), monotonic scoring (INV-4),
  value bounds (INV-7), clean reset (INV-6), the public API/event contract (TDD §4.3), and the
  session game-over window (R2).
- Validation Commands: `node --test`
- Dependencies: T1 (uses `resolveCollision`); consumes Phase 02 `rng.js`, `difficulty.js`,
  `grid.js`, `scoring.js`, `config.js`.

### T4 — Unit + contract tests for `GameModel`

- Task ID: T4
- Type: test
- Description: Unit- and contract-test the model in isolation with an injected seeded RNG and
  hand-constructed states:
  - **INV-5 (cooldown / single bomb):** `dropBomb` returns `false` while `cooldownRemaining > 0`
    and while a bomb is already active; returns `true` and creates exactly one bomb otherwise; a
    drop becomes possible again only after the cooldown has ticked down.
  - **Tick mechanics:** bricks rise by the expected `riseSpeed * dt`; a new row spawns after
    `spawn.interval` of accumulated time; `cooldownRemaining` decays to 0 and floors there.
  - **INV-8 single-step outcomes at model level:** greater reduces bomb value and keeps it active;
    lesser reduces the brick value and removes the bomb; exact clears the whole row.
  - **INV-4 (scoring):** score is monotonically non-decreasing across a scripted tick sequence and
    equals the cumulative value removed (partial + destruction + row clear).
  - **INV-7 (value bounds):** every brick value observed via `getState()` stays within `[1,30]`.
  - **INV-6 (reset):** after `reset()`, the structural snapshot equals a freshly constructed
    model's (score 0, no bomb, `status: 'playing'`, `time` 0, brick count `= initialRows`).
  - **Contract (TDD §4.3):** `getState()` returns the documented shape and does not alias internal
    state (mutating the returned snapshot leaves a subsequent `getState()` unchanged); `dropBomb`
    returns a boolean; `consumeEvents()` returns an array that drains (second call `[]`); event
    objects carry a `type` in the documented set.
- Files / Areas: `test/simulation.test.js`.
- Outputs: passing `node:test` suite.
- Test Intent: named, specific assertions per bullet above — positive, negative (drop refused on
  cooldown / when active; score never decreases), and edge (cooldown exactly at 0; brick value at
  the [1,30] boundaries) — each asserting the concrete expected value.
- Validation Commands: `node --test test/simulation.test.js`
- Dependencies: T3.

### T5 — Integration tests: cascade, row clear, and session game-over window

- Task ID: T5
- Type: test
- Description: Exercise the wired model end-to-end with a seeded RNG:
  - **Multi-brick cascade (INV-8):** construct a column of alive bricks whose values sum below a
    dropped bomb's value; drive `tick` until the bomb falls through them; assert the bomb destroys
    multiple bricks in one fall, its value decreases by each brick value, and the score increases by
    the sum of destroyed values.
  - **Exact-match full-row clear (INV-8):** set up a row where the bomb hits a brick of equal value;
    assert the entire row is cleared, `score += hitBrickValue + Σ remaining row values`, and a
    `rowClear` event is emitted (screen-shake trigger).
  - **Session game-over window (R2):** run a no-input session under the tuned fixed seed, stepping
    `tick` with a fixed `dt` (e.g. 1/60 s) until `status === 'gameover'`; assert the accumulated
    simulated `time` at game-over falls within the ~30–45 s window (assert a concrete inclusive
    range, e.g. `>= 25 && <= 50`, with the target being 30–45; the exact bounds are set by the
    tuned config and documented in the test).
- Files / Areas: `test/simulation.integration.test.js`.
- Outputs: passing `node:test` suite.
- Test Intent: integration-verify the cross-module wiring (collision + grid + scoring + difficulty
  under the model's tick) produces the specified cascade, row-clear aggregate, and game-over timing
  — assertions specific to computed score/time/brick-count, never truthiness.
- Validation Commands: `node --test test/simulation.integration.test.js`
- Dependencies: T3 (and T1 transitively).

### T6 — Full-suite validation & purity re-confirmation

- Task ID: T6
- Type: validation
- Description: Run the entire headless suite and confirm the INV-1 core-purity scan (already in
  `test/config.test.js`, which recursively scans `src/core/` for the forbidden substrings
  `phaser`/`document`/`window`) still passes with the two new core modules present. No new test
  framework; `node --test` only.
- Files / Areas: whole repo (`test/`, `src/core/`).
- Outputs: green `node --test` run; INV-1 scan green.
- Test Intent: confirm no regression in the Phase 01–02 suites and that `collision.js` +
  `simulation.js` introduce no forbidden token (e.g. no identifier literally named `window`).
- Validation Commands: `node --test`
- Dependencies: T2, T4, T5.

---

## 5. Task Breakdown (Human Organization)

### 5.1 Core-logic Tasks
- Task: single-interaction resolver
  - Task ID: T1
  - Files/Areas: `src/core/collision.js`
  - Notes: pure function, no state, no row iteration; exact delta contract in T1. Exact-case
    `scoreGained: 0` (row-clear scoring owned by the model) to avoid double counting.
  - Depends on: none
- Task: `GameModel` orchestrator
  - Task ID: T3
  - Files/Areas: `src/core/simulation.js`, `src/core/config.js` (additive tunables only)
  - Notes: TDD §4.3 API; tick order and cascade rules pinned in T3; R2 tuning is `config.js` data.
  - Depends on: T1

### 5.2 Test Tasks
- Task: collision unit suite
  - Task ID: T2
  - Files/Areas: `test/collision.test.js`
  - Depends on: T1
- Task: model unit + contract suite
  - Task ID: T4
  - Files/Areas: `test/simulation.test.js`
  - Depends on: T3
- Task: integration suite (cascade, row clear, session window)
  - Task ID: T5
  - Files/Areas: `test/simulation.integration.test.js`
  - Depends on: T3

### 5.3 Cross-Cutting Tasks
- Task: full-suite + purity validation
  - Task ID: T6
  - Files/Areas: `test/`, `src/core/`
  - Notes: executed by the debug node during stabilization.
  - Depends on: T2, T4, T5

---

## 6. Dependency Notes (Human Explanation)

- **T1/T2 before T3/T4/T5** because the model composes `resolveCollision`; the resolver is a clean
  seam that is unit-validatable on its own, so it lands and passes first, giving the heavier model
  node a verified dependency (smaller blast radius).
- **T3 is not split from its cascade** because the collision cascade lives inside `tick` and the two
  can only be validated together — splitting them would fragment an atomic change and create an
  illusory seam.
- **Debug stabilization (T6)** depends on all implementation + test tasks being present so it can
  run the whole `node --test` suite and stabilize any failures.
- **Review** depends on the debug node.
- **Closure readiness** depends on review recording `accept` and any remediation loop's review
  recording `accept`.

---

## 7. Validation Plan

### 7.1 Validation Classes

Required for this phase:
- `unit` — `collision.js` outcome rules (T2); `GameModel` dropBomb gate, tick mechanics, scoring,
  value bounds, reset (T4).
- `integration` — cross-module wiring under the model's tick: multi-brick cascade, exact-match row
  clear aggregate, and the no-input session game-over window (T5).
- `contract` — `GameModel` public API/event shape per TDD §4.3 (T4).

Optional for this phase:
- None. (No environment, no external services — pure Node logic.)

### 7.2 Validation Commands

Authoritative gates (run by debug during stabilization):

- Unit tests: `node --test test/collision.test.js` and `node --test test/simulation.test.js`
- Integration tests: `node --test test/simulation.integration.test.js`
- Contract tests: covered within `node --test test/simulation.test.js` (API/event-shape assertions)
- Full suite (all classes + Phase 01–02 regression + INV-1 purity scan): `node --test`
- Migrations / reset steps: none
- Seed steps: none (tests construct their own seeded RNG via `createRng`)
- Build / lint: none configured; `node --test` is the sole gate

All required commands must pass before the phase may exit. The single authoritative command is
`node --test` (equivalently `npm test`); it discovers every `test/*.test.js` file.

### 7.3 Completion Artifact Validation

Each node concludes with a `takumi_complete` call carrying a valid artifact:
- `schema_version`: 1; `node_id` matches the claimed node; `run_id` matches the run.
- `status` / `outcome` per result; `summary`; `directives`.
- All lanes: `close_node` with reason. When commits are made: `record_repo_changes` with repo,
  branch, and real 40-char commit SHAs.

### 7.4 Debug Stabilization Contract

Debug executes the validation commands, diagnoses failures, applies **bounded** repairs within
this phase's task scope (small logic bugs in `collision.js` / `simulation.js`, off-by-one in the
tick/cascade, spawn-timer remainder handling, test fixture/seed issues, R2 tuning of `config.js`
data), reruns, and repeats until green or a stop condition is hit. Debug must not add feature work
or touch out-of-scope files (§2).

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** (never defer to a remediation loop) when:
- an architecture invariant (INV-1..8) cannot be satisfied without a design change,
- required functionality is missing from the plan,
- the defect needs a design/architecture decision the node is not authorized to make,
- the defect reveals a broader systemic issue.

Debug may defer to a remediation loop (or apply bounded stabilization) only for a bounded-fixable
defect when any of: more than 3 repair cycles on the same failure class; the same failure repeats
after repair; or (n/a here — no environment) the environment cannot be stabilized. A remediation
loop is only for a concrete, bounded fix a build node can implement without a new design decision.
**R2 timing note:** if the fixed-seed session cannot be tuned into the window by `config.js` data
alone and would require reshaping the loop's mechanics, that is a design question — block and name
it, do not loop indefinitely.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it validates correctness and scope compliance, the sufficiency
of the unit/integration/contract evidence (INV-8/5/4/6/7 coverage, the R2 window assertion, the
contract-shape assertions), and structural integrity / invariant preservation (INV-1 purity, INV-3
one-way ownership via the encapsulated API). Blocking, in-scope defects open bounded
`remediation_loop`s (`build → debug → review`) that rejoin at resolve. The phase closes only when
the phase review and every loop review record `accept`. Loops are bounded (`max_self_recurrence:
5`); on exhaustion with issues remaining, review escalates with `status: blocked`.

### 7.7 Edge Cases to Validate

- Bomb value exactly one above / one below / equal to a brick value (greater/lesser/exact boundary).
- Brick value at the `[1,30]` extremes; a `lesser` reduction never produces a value `< 1`.
- Bomb that chews through **multiple** bricks in a single fall (cascade) and one that exits the
  bottom without a terminal interaction (miss — no score change, bomb removed).
- Exact match on a row with some columns already cleared (row-clear aggregate = only alive bricks).
- `dropBomb` rejected while a bomb is active and while `cooldownRemaining > 0`; accepted exactly at
  `cooldownRemaining == 0` with no active bomb.
- Spawn timer with `dt` larger/smaller than `spawn.interval` (remainder carried correctly; no
  missed or doubled spawns for a single interval crossing).
- Game-over emitted exactly once; no further state mutation after `status === 'gameover'`.
- `getState()` snapshot cannot mutate internal state; `consumeEvents()` drains (second call empty).
- `reset()` yields a structural initial state equal to a fresh construct.

---

## 8. Environment Contract

**No runtime environment required.** The entire phase validates with local `node --test` over pure
Phaser-free ES modules. No server, browser, container, credential, or seed service is involved.

---

## 9. Risk Touchpoints

- **R2 — Difficulty / session-length tuning.** Exercised heavily this phase: the no-input session
  must reach game-over within ~30–45 s under a fixed seed. Mitigation: keep all timing/curve
  constants in `config.js`; the integration test (T5) asserts the window under the worst case
  (no player input) so tuning is measurable and reproducible.
- **R4 — Determinism.** The whole loop draws randomness only through the injected `rng`; tests use
  fixed seeds and assert reproducible outcomes (INV-2). Mitigation: no wall-clock reads, no
  `Math.random`, `dt` and `elapsed` always passed in.
- **INV coverage.** INV-8 (collision fidelity), INV-5 (cooldown/single bomb), INV-4 (scoring),
  INV-6 (clean reset), INV-7 (value bounds), INV-1 (purity), INV-3 (one-way ownership) are all
  exercised by this phase's tests / structure.

---

## 10. Carry Forward Consumption

Prior phase (`../phase-02/32-carry-forward.md`) has three open items. Each is evaluated:

- Carry Forward ID: **CF-01** — execute the mobile-portrait browser boot + neon-background check.
  - Source: Phase 01 review manual DoD item, re-deferred by Phase 02.
  - Disposition: **Deferred again.**
  - Rationale: Phase 03 is pure Phaser-free core logic and introduces **no** browser or rendering
    surface to validate. The check remains correctly placed at Phase 04 (Rendering & Input Binding),
    before relying on the shell for rendering integration.
  - Related Task IDs: none.

- Carry Forward ID: **CF-02** — remove the pre-existing empty `Test.txt` in a scoped cleanup task.
  - Source: Phase 01 review advisory, re-deferred by Phase 02.
  - Disposition: **Deferred again.**
  - Rationale: Phase 03 contains no repository-cleanup task; it touches only `src/core/` and
    `test/`. Deleting unrelated tracked content during a pure-core logic phase would obscure
    provenance. Remains scheduled for the next phase with an explicit cleanup task, or final
    integration cleanup in Phase 06.
  - Related Task IDs: none.

- Carry Forward ID: **CF-03** — consider a debug-only warning for unknown scale configuration
  tokens.
  - Source: Phase 01 review advisory / code review, re-deferred by Phase 02.
  - Disposition: **Deferred again.**
  - Rationale: The scale-token mapping lives in `src/main.js` (the Phaser boundary), which Phase 03
    does not touch. The accepted fallback is safe; the warning is an observability improvement best
    made when the input/render boundary is next modified (Phase 04).
  - Related Task IDs: none.

Every open carry-forward item is addressed explicitly; none is silently ignored.

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES (INV-1 through INV-8, TDD §4.4).
- Any invariant modifications: NONE. Phase 03 implements the behavior INV-4/5/6/7/8 describe and
  preserves INV-1/2/3.
- Risk register regression concerns: NONE new. R2 and R4 are exercised and mitigated as in §9.
- Deferred work impact review: CF-01/02/03 remain deferred (§10); none affects Phase 03 correctness.
- Prior carry-forward reviewed: YES.
- Carry-forward items brought into scope this phase: NONE.
- Carry-forward items deferred again: CF-01, CF-02, CF-03.

---

## 12. Phase Closure Contract

Required base sequence: **build → debug → review → resolve.**

- Build roots: `P03-BUILD-COLLISION` (T1, T2) and `P03-BUILD-SIMULATION` (T3, T4, T5), the latter
  depending on the former.
- Debug: `P03-DEBUG-STABILIZE` (T6) depends on `P03-BUILD-SIMULATION`.
- Review (the single closure gate) and resolve are provided by the `delivery_loop`; review depends
  on the debug node, resolve depends on review (and on any remediation-loop review nodes).

The phase exits only when the phase review records `accept` **and** every remediation-loop review
records `accept`. Only then does resolve reconcile artifacts and close the phase.
