# Phase Review: Phase 03 — Simulation Loop: Collision, Rising & Game Over

## 0. Metadata

- Feature Slug: `blockdrop-2`
- Phase: 03
- Reviewer Node: `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40`
- Recommendation: **accept**
- Last Updated: 2026-08-14

---

## 1. Review Summary

**Verdict: accept.** Phase 03 delivered the complete headless game model as scoped by
`12-phase-plan.md`. Every deliverable is present, every task is implemented per its
contract, `node --test` runs green (**85/85 pass, 0 fail**), and the INV-1 core-purity
scan enforced by `test/config.test.js` still holds with the two new core modules
added. All eight phase-plan exit criteria are satisfied and no blocking, in-scope
defect was found.

- Correctness: verified — collision outcomes and the `GameModel` behaviours match
  the T1 / T3 contracts and TDD §4.3.
- Completeness: verified — T1, T2, T3, T4, T5 are all delivered; T6 is confirmed by
  the debug node's stabilization report and re-executed here.
- Validation coverage: verified — unit, integration, and contract classes are all
  populated and green; assertions are specific-value (not truthiness) throughout.
- Structural soundness: verified — INV-1 through INV-8 are all preserved, module
  boundaries are respected, and the model owns state (INV-3) via a frozen /
  non-aliasing snapshot API.

No remediation loop is opened. Downstream `resolve` may proceed.

---

## 2. Task Completion Status

| Task | Type           | Deliverable(s)                                         | Status |
|------|----------------|--------------------------------------------------------|--------|
| T1   | implementation | `src/core/collision.js` (`resolveCollision` + default) | ✅ Complete |
| T2   | test           | `test/collision.test.js` (9 tests)                     | ✅ Complete |
| T3   | implementation | `src/core/simulation.js` (`GameModel` + default); additive `src/core/config.js` (`grid.initialRows`, `gameOver.topY`) | ✅ Complete |
| T4   | test           | `test/simulation.test.js` (18 tests)                   | ✅ Complete |
| T5   | test           | `test/simulation.integration.test.js` (5 tests)        | ✅ Complete |
| T6   | validation     | full `node --test` green; INV-1 scan green             | ✅ Complete |

No scope creep observed. No file was modified outside the phase's allowed surface
(`src/core/collision.js`, `src/core/simulation.js`, `src/core/config.js` additive
only, and the three phase test files). `src/main.js`, `src/scenes/*`, `index.html`,
`vendor/*` are untouched. The existing asserted `config.js` values (design, scale,
grid.columns / rowHeight, rise.speed, spawn.interval, bomb, values, difficulty,
tint, particles, debug) are all unchanged; only the two additive tunables were
introduced. The Phase 01–02 test suites remain green.

---

## 3. Implementation Quality Assessment

### 3.1 `src/core/collision.js` (T1)

- Pure function: no state ownership, no row iteration, no imports of other core
  modules. Matches the T1 contract byte-for-byte for all three INV-8 outcomes
  (`greater`, `lesser`, `exact`).
- `exact` correctly returns `scoreGained: 0` and `triggersRowClear: true`, honouring
  the single-source-of-truth scoring rule (row aggregate is scored by
  `simulation.js` via `grid.clearRow`'s `clearedValue`).
- House export convention respected: named `resolveCollision` + `default { resolveCollision }`.

### 3.2 `src/core/simulation.js` (T3)

- Public API (`new GameModel({ config, rng })`, `dropBomb(x)`, `tick(dtSeconds)`,
  `getState()`, `consumeEvents()`, `reset()`) matches TDD §4.3 in shape and semantics.
- Tick order is exactly the T3 pipeline: (1) `time += dt` + recompute
  `difficultyLevel`; (2) cooldown decay floored at 0; (3) spawn timer with
  remainder carry (`while` loop over `spawn.interval`); (4) rise (`riseSpeed * dt`
  where `riseSpeed = rise.speed + difficultyLevel * difficulty.riseSpeedGrowthPerLevel`);
  (5) bomb fall + collision cascade via `_advanceBomb`; (6) game-over detection via
  `topEdgeY(bricks) <= gameOverTopY`, emitted at most once.
- `dropBomb` gates in the correct order (status → cooldown → active bomb) and
  clamps `x` to a column via `clampInt(x / columnWidth, 0, columns-1)`. On success
  it snaps to `columnCenterX(col, config)`, seeds the bomb at `y=0`, rolls the
  value via `difficulty.rollBombValue`, and starts the cooldown.
- Cascade: `greater` keeps the bomb alive and continues iterating (`continue`);
  `lesser` reduces the brick value and consumes the bomb (`return`); `exact` calls
  `grid.clearRow` for the aggregate value, scores via `scoring.addValue`, emits
  both an `explosion` and a `rowClear` event (screen-shake trigger, INV-8), and
  consumes the bomb (`return`). Miss detection (`bomb.y > playHeight`) executes at
  the end when no terminal interaction occurred.
- All score updates flow through `scoring.addValue` (INV-4). Randomness flows only
  through the injected `rng` (INV-2, R4); no wall-clock, no `Math.random`.
- One-way ownership (INV-3): `getState()` returns `Object.freeze`d snapshots with
  copied bricks / bomb objects and a frozen `danger`. Callers cannot mutate the
  model through the snapshot.
- Purity (INV-1): the module never mentions `phaser`, `document`, or `window`
  (verified by the recursive scan in `test/config.test.js`).

### 3.3 Additive `src/core/config.js`

- Two additive tunables: `grid.initialRows: 4` and `gameOver.topY: 0`.
- No existing value asserted by `test/config.test.js` was changed; the config
  smoke test and INV-1 scan remain green.
- Naming avoids all forbidden substrings (`gameOver` — no `window`/`document`).

---

## 4. Test Coverage Assessment

Assessed via the `test-design` rubric (unit / integration / contract taxonomy;
positive, negative, edge coverage per task; specific-value assertions).

### 4.1 Unit — `test/collision.test.js` (9 tests, T2)

- All three INV-8 outcome branches, each asserted with `assert.deepEqual` against
  the exact delta object (no truthiness). Positive cases plus the greater↔exact
  and lesser↔exact equality boundary at brick=12 (bomb 11 / 12 / 13).
- Extremes: brick=1 (exact / greater) and brick=30 (exact / lesser / greater).
- Negative-adjacent guarantees: a `greater` input never reports `bombSurvives:false`;
  a `lesser` input never destroys the brick and never drops below 1 (INV-7).
- Exports shape: named + default parity.

### 4.2 Unit + contract — `test/simulation.test.js` (18 tests, T4)

- Construction: seeds `initialRows * columns` bricks alive, `time` / `score` / bomb
  / `difficultyLevel` at zero, `status: 'playing'`. Constructor rejects a missing rng.
- **INV-5** (three tests): dropBomb succeeds once and creates one bomb at y=0 with
  the rolled value; second drop refused while a bomb is active; refused while
  cooldown > 0 and accepted at exactly `cooldownRemaining == 0`.
- Tick mechanics: rise distance equals `riseSpeed * dt`, including the growth term
  at level 1 (`(10 + 1*2) * 5 = 60`); single-interval crossing spawns exactly one
  row and carries the remainder; a `dt` spanning two intervals spawns two rows.
- **INV-8** (four tests): greater reduces the bomb value and keeps it alive;
  lesser reduces the brick value and removes the bomb; exact clears the whole row
  (score = row sum, rowClear emitted with `clearedValue`); a bomb that exits the
  bottom with no interaction is a miss (no score change).
- **INV-4**: monotonic scoring across a scripted cascade — `[7, 4, 1]` bomb value
  trajectory, final score 9 = 3+3+3 destroyed.
- **INV-7**: 600-tick real-config session — every brick value observed via
  `getState()` stays within `[1,30]`.
- **INV-6**: `reset()` yields a structural state equal to a freshly constructed
  model (status / time / score / bomb / difficultyLevel / brick count / topEdgeY).
- **Contract (TDD §4.3)**: snapshot shape (`time`, `status`, `score`,
  `difficultyLevel`, `bricks`, `bomb`, `danger.topEdgeY`) and per-brick keys;
  snapshot is `Object.isFrozen` and does not alias internal state (prior snapshot
  unchanged after a tick); `dropBomb` returns a boolean; `consumeEvents` drains
  (second call `[]`); every event type is in `{spawn, explosion, rowClear, gameover}`.

### 4.3 Integration — `test/simulation.integration.test.js` (5 tests, T5)

- **Cascade (INV-8)**: bomb 12 through four bricks (value 2 each): 4 `greater`
  explosions, bomb-value trajectory `[10, 8, 6, 4]`, score 8.
- **Row clear**: exact 6-vs-6 on a 3-column row clears everything, score = 18
  (hit + 6 + 6).
- **Row-clear aggregate counts only alive**: after a `greater` kills col-0's brick
  (10), a subsequent exact 7 on col-1 clears the two ALIVE bricks; `rowClear.clearedValue
  == 14`, total score == 24.
- **R2 session window**: no-input session under three seeds (`1, 20260814, 777`),
  `dt = 1/60`; asserts `status === 'gameover'` and `time ∈ [30, 45]`.
- **R2 inertness**: after game-over, exactly one `gameover` event was emitted;
  subsequent `tick`/`dropBomb` are inert.

### 4.4 Validation results

Full suite executed here as a review sanity check:

- Command: `node --test`
- Result: **85 tests pass, 0 fail, 0 skipped, ~547 ms**.
- INV-1 core-purity scan: green (`INV-1: no src/core/ module references phaser,
  document, or window`).
- Debug node's stabilization report (dependency `1e9828c1…`) records the same
  outcome with zero repairs applied.

No test uses `assert.ok(x)` where `x` is a truthy placeholder for correctness; every
correctness check names a specific expected value. Test coverage is adequate per
`test-design`: each phase-plan task has directly traceable tests with positive,
negative-adjacent, and edge cases.

---

## 5. Validation Results

Per §7 of the phase plan:

| Gate                                       | Status | Notes |
|--------------------------------------------|--------|-------|
| `node --test test/collision.test.js`       | pass   | 9/9 tests green |
| `node --test test/simulation.test.js`      | pass   | 18/18 tests green |
| `node --test test/simulation.integration.test.js` | pass | 5/5 tests green |
| `node --test` (full suite, incl. regression + INV-1 scan) | pass | 85/85 tests green |
| Migrations / seeds                          | n/a    | none |
| Build / lint                                | n/a    | none configured |

All required commands are covered by the single authoritative `node --test`
invocation, which discovers every `test/*.test.js`. Debug's stabilization report
matches this outcome. No failure classified as implementation, test-regression, or
environment.

---

## 6. Issues Found

**Blocking (would open a remediation loop): none.**

**Non-blocking (advisory, do not open a loop):**

- **A-1 — Point-model overlap in the bomb cascade.** `_advanceBomb` treats the
  bomb as a single point (`bomb.y >= brick.y && bomb.y <= brick.y + rowHeight`).
  Under the real-config values used by the R2 test (`fallSpeed = 900`,
  `dt = 1/60` → 15 units/tick, `rowHeight = 120`), the bomb cannot jump past a
  brick in one tick, so the current suite exercises the model correctly. This is a
  legitimate simplifying assumption of the physical model, consistent with the
  cascade rules described in T3 ("resolve every alive brick in the bomb's column
  that the bomb now overlaps"). It becomes a concern only if a future config
  increases `fallSpeed * dt` beyond `rowHeight`. Not blocking for Phase 03;
  suggested carry-forward — either document the constraint on the module or add a
  sweep-based overlap for robustness in Phase 04+.

- **A-2 — Spawn remainder is not preserved across `reset()`.** `reset()` sets
  `spawnAccumulator = 0`, which is correct for the initial-state contract; the
  INV-6 test also asserts a fresh initial state, so this is consistent with the
  specification. Called out only for future readers to be aware that a mid-session
  reset intentionally re-baselines the spawn timer.

Neither item satisfies the blocking threshold: neither breaks an invariant, breaks
a task contract, breaks a test, or violates scope. Both are informational.

---

## 7. Structural Evaluation

Assessed against `10-tdd.md` §4.3 / §4.4 (INV-1..8) and §4.1 module intents, using
the `code-review-rubric` five dimensions.

- **Invariant compliance.** All eight invariants are exercised by tests and hold:
  - INV-1 (core purity): recursive scan across `src/core/` finds none of
    `phaser` / `document` / `window`. `gameOver` identifier is safe.
  - INV-2 (determinism): randomness flows only through the injected `rng`; `dt`
    is always a parameter; no wall-clock or `Math.random` anywhere in `src/core/`.
  - INV-3 (one-way ownership): the render layer's read path is `getState()`, which
    returns `Object.freeze`d, non-aliasing snapshots (asserted).
  - INV-4 (monotonic scoring): score flows through `scoring.addValue`, which clamps
    non-positive/non-finite deltas to 0; asserted by the cascade test.
  - INV-5 (single active bomb + cooldown): `dropBomb` gates in the correct order;
    three separate tests exercise refusal-active, refusal-cooldown, and
    acceptance-at-zero.
  - INV-6 (clean reset): compared byte-for-byte against a freshly constructed model.
  - INV-7 (value bounds `[1,30]`): 600-tick real-config sweep asserts every alive
    brick's value stays in range.
  - INV-8 (collision fidelity): unit + integration coverage of all three outcomes,
    the multi-brick cascade, and the exact-match aggregate row clear.

- **Contract conformance.** `GameModel` matches TDD §4.3: construction signature,
  method signatures, return types, event shape (`type ∈ {spawn, explosion,
  rowClear, gameover}`), and snapshot shape. `resolveCollision`'s three delta
  branches match T1 field-for-field.

- **Architectural drift.** None observed. `collision.js` stays a pure resolver;
  `simulation.js` composes the Phase 02 primitives without reaching around them
  (e.g. row clearing flows through `grid.clearRow`; scoring flows through
  `scoring.addValue`; bomb column snapping uses `columnCenterX`). The
  render-boundary discipline holds — no direct rendering, input, or Phaser touchpoints.

- **Hidden coupling / boundary leakage.** None observed. The model owns its
  mutable state as an internal detail (`this.bricks`, `this.bomb`,
  `this.pendingEvents`) and exposes read-only snapshots + methods. No leaky
  reference escapes via `getState()` (asserted).

- **Validation blind spots.** None blocking. The only structural blind spot is
  A-1 above (multi-row overlap in one tick), which is a physical-model
  simplification consistent with the T3 wording and not exercised by the phase's
  test surface because real-config parameters make it impossible.

---

## 8. Recommendation

**`accept`.**

The phase is correct, complete, and structurally sound. All phase-plan exit
criteria (§3) and phase-specific exit criteria (from `20-phases.md` §Phase 03) are
met:

- [x] Implementation tasks complete (T1, T3 + additive config in T3)
- [x] Required validation commands pass (`node --test` green; INV-1 scan green)
- [x] Debug stabilization completed
- [x] Review completed with `accept`
- [x] No invariant violations introduced
- [x] Carry-forward items from the prior phase explicitly evaluated
- [x] All three collision rules behave exactly as specified — unit + integration
- [x] `dropBomb` respects cooldown and single-active-bomb — INV-5 unit tests
- [x] Headless no-input session reaches game-over within [30, 45] s — R2 integration
- [x] `GameModel` public API/event shape matches TDD §4.3 — contract tests

No remediation loop is opened. No `add_phase` is proposed (no new distinct future
scope surfaced). No ADR is emitted — this phase implements the previously recorded
design without any material architectural decision to durably record.

Downstream `resolve` may proceed to reconcile artifacts and determine the next
phase.
