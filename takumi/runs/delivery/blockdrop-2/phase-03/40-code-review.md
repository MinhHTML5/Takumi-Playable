# Code Review Report: Phase 03 — Simulation Loop

## 0. Metadata

- Feature Slug: `blockdrop-2`
- Phase: 03
- Reviewer Node: `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40`
- Files Reviewed:
  - `src/core/collision.js` (new)
  - `src/core/simulation.js` (new)
  - `src/core/config.js` (additive: `grid.initialRows`, `gameOver.topY`)
  - `test/collision.test.js` (new)
  - `test/simulation.test.js` (new)
  - `test/simulation.integration.test.js` (new)
- Verdict: **accept** (no blocking findings)

---

## 1. Code Quality Findings

### 1.1 `src/core/collision.js` — pass

- Clear single-purpose module with a focused JSDoc header explaining the INV-8
  contract and the scoring-ownership convention (`exact` scores 0 here on purpose).
- Straightforward branching: three exact-return branches, each returning the
  documented delta object. No hidden control flow, no defensive coding beyond what
  the T1 contract requires.
- No dependencies on other core modules — genuinely pure, as required.
- Export convention (`export function` + `export default { … }`) matches the rest
  of `src/core/`.

**No findings.**

### 1.2 `src/core/simulation.js` — pass

- Well-scoped module docstring covers the INV-1/2/3 discipline and the
  render-layer contract. Method-level JSDoc explains gates, ordering, and
  return-shape invariants.
- Tick pipeline is expressed in a single sequential method with numbered comments
  matching the T3 pipeline exactly (time+difficulty → cooldown → spawn → rise →
  bomb+cascade → game-over). Easy to audit against the specification.
- Private helpers (`_seedInitialRows`, `_spawnRowAt`, `_advanceBomb`, `clampInt`,
  `gameOverTopYOf`, `initialRowsOf`) are minimal and each has a clear
  responsibility. The `_advanceBomb` extraction keeps `tick` readable.
- Event emission is centralised inside `_advanceBomb` and the spawn/game-over
  branches; every event object carries the documented `type` and a payload useful
  for downstream juice (row / col / x / y / value).
- Snapshot construction in `getState()` uses `Object.freeze` on every nested
  object (bricks, bomb, danger, root). Verified by the "non-aliasing" contract test.

**Minor observations (informational, not blocking):**

- **CQ-1 (advisory)** — `_advanceBomb` treats the bomb as a point when checking
  overlap:
  `bomb.y >= brick.y && bomb.y <= brick.y + this.rowHeight`.
  Under real config (`fallSpeed = 900`, `dt = 1/60`), per-tick displacement is
  ~15 units vs. `rowHeight = 120`, so a single-tick jump-past cannot happen. The
  simplification is consistent with the T3 wording ("resolve every alive brick in
  the bomb's column that the bomb now overlaps") and does not affect any current
  test or invariant. Consider a comment on `_advanceBomb` in a future phase to
  make the assumption explicit, or move to a swept-segment overlap
  (`prevY..currY`) if `fallSpeed * dt` is ever raised above `rowHeight`.

- **CQ-2 (advisory)** — The class field `this.time` shadows JS's `time` in some
  editors' semantic search, but is contained to the class and unambiguous in
  context; no action required. Naming is otherwise consistent with the TDD.

### 1.3 `src/core/config.js` — pass

- Both additive keys (`grid.initialRows`, `gameOver.topY`) are pure data with a
  short comment explaining their role and the R2 tuning relationship.
- No existing asserted value changed; `test/config.test.js` remains green.
- No forbidden token introduced (`gameOver` is safe; `topY` is safe). Verified by
  the INV-1 scan.

**No findings.**

### 1.4 Test files — pass

- All three new test files use specific-value assertions (`assert.deepEqual` on
  the full delta object, `assert.equal` on the exact expected numeric). No
  truthiness placeholders.
- `scriptedRng` and `makeConfig` factories are duplicated across
  `simulation.test.js` and `simulation.integration.test.js`. This is idiomatic for
  keeping unit files self-contained and does not warrant extraction; noted only
  because it appears in two files.
- Test names describe the assertion (`INV-8 greater: brick dies, bomb value
  reduced, bomb survives, score += brickValue`), which makes suite output an
  audit trail against the invariants.

**No findings.**

---

## 2. Architecture Compliance

- **INV-1 (core purity).** Recursively scanned `src/core/` for `phaser`,
  `document`, `window` — no matches. Enforced automatically by
  `test/config.test.js` on every `node --test` run. Both new modules are engine-
  and DOM-free.
- **INV-2 / R4 (determinism).** All randomness in `simulation.js` flows through
  the injected `rng` (`rollBrickValue`, `rollBombValue`). No `Math.random`, no
  `Date.now()`, no wall-clock read. `dt` is always a parameter passed in by the
  caller. Reproducibility from a seed is asserted by the R2 test at three seeds.
- **INV-3 (one-way ownership).** `GameModel` owns all mutable state (`bricks`,
  `bomb`, `score`, `pendingEvents`, timers, difficulty state). `getState()`
  returns a `Object.freeze`d snapshot with cloned nested objects; the contract
  test confirms a prior snapshot is not affected by a subsequent `tick`.
- **INV-4 (monotonic scoring).** All score updates route through
  `scoring.addValue`, which clamps non-positive/non-finite deltas to zero. Every
  cascade branch scores the correct value at the correct point (greater =
  brickValue, lesser = bombValue, exact = clearedValue).
- **INV-5 (single bomb + cooldown).** `dropBomb` gates in the order `status →
  cooldown → active bomb`, each guarded independently. Cooldown reset to
  `config.bomb.cooldown` on a successful drop; decays via `Math.max(0, ...)` in
  `tick`.
- **INV-6 (clean reset).** `reset()` re-initialises every field to its
  constructor-time state and re-seeds the initial rows via `_seedInitialRows`.
  Structural equality vs. a fresh model is asserted.
- **INV-7 (value bounds `[1,30]`).** `resolveCollision`'s `lesser` branch cannot
  reduce a brick below 1 (only fires when `bombValue < brickValue`); rolled
  values come from `difficulty.rollBrickValue` / `rollBombValue`, which clamp to
  `[values.brickMin, values.brickMax]`. Asserted across a 600-tick real-config
  session.
- **INV-8 (collision fidelity).** All three outcomes match the specification;
  the multi-brick cascade behaviour and the exact-match aggregate row-clear
  scoring (owned by the model via `grid.clearRow`) are asserted.
- **TDD §4.3 API surface.** Constructor, method signatures, snapshot shape, and
  event set match the design. Read-only-snapshot requirement is honoured.

**No architecture-compliance findings.**

---

## 3. Security Considerations

- No network, filesystem, or subprocess access is introduced. Both new modules
  are pure computation on numeric inputs.
- No deserialisation of untrusted input; `dropBomb(x)` clamps `x` to a valid
  column integer, so a caller cannot address out-of-range columns.
- No `eval`, `Function`, or dynamic import. No prototype-pollution surface:
  option objects are consumed by property read only.

**No security findings.**

---

## 4. Performance Observations

- **Tick complexity.**
  - Rise loop is `O(bricks)` (one arithmetic op per brick per tick).
  - Cascade is `O(bricks in column)` per active bomb; capped by `columns *
    initialRows + spawn-generated rows`, i.e. a small constant in practice.
  - `topEdgeY` is `O(bricks)`; called once per tick and again in `getState()`
    (twice per tick under typical use). Acceptable at this scale (a few dozen
    bricks); if profiling later flags it, cache the value inside `tick`.
- **`getState()` allocation.** Every call allocates a new frozen object plus one
  per brick and the bomb. This is required for INV-3 (no aliasing). At typical
  frame rates (60 Hz) with tens of bricks, this is a few hundred small
  allocations per second — well within budget for a browser-side game and not a
  concern for the headless suite.
- **Spawn loop.** `while (spawnAccumulator >= interval)` correctly handles
  arbitrarily large `dt` without missing intervals; the loop bound is
  `dt / interval`, bounded in normal play.

**No performance findings.**

---

## 5. Summary

Two new pure ES modules totalling ~260 LoC (plus additive config and ~570 LoC of
tests) deliver the complete headless simulation loop. Code is clean,
well-commented, exhibits no defensive coding beyond what the contracts require,
and every architectural invariant is preserved. `node --test` reports 85/85 green;
the INV-1 core-purity scan enforced within the suite remains green.

**Verdict: accept.** No blocking findings; the two advisory items (CQ-1, CQ-2)
are informational and do not warrant a remediation loop.
