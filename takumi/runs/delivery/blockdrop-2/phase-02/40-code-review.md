# Phase 02 — Code Review Report

**Node:** Phase Review (`d77b016e-5282-449c-a35c-51e6deb4cb95`)
**Scope:** The four Phase 02 simulation-core modules and their test suites.
**Overall verdict:** clean — no blocking findings, no advisory items above
the "worth mentioning" bar.

---

## 1. Code Quality Findings

### 1.1 `src/core/rng.js`
- Mulberry32 step is implemented with `Math.imul` and explicit `| 0` /
  `>>> 0` coercions, so 32-bit arithmetic stays in the fast-path integer domain
  and the returned float is exactly `uint32 / 2^32 ∈ [0, 1)`. Clean and
  standard.
- `toUint32` gracefully handles any finite `seed`; non-finite seeds fall back
  to 0, so `createRng(NaN)` or `createRng(undefined)` never produces an
  undefined stream. The determinism contract holds under any input.
- `nextInt` uses `Math.floor(next() * (max - min + 1)) + min` — correct
  inclusive-inclusive integer draw because `next()` is strictly `< 1`. The
  `span === 1` case (`nextInt(k, k)`) returns `k` deterministically. Verified
  by test.
- Per-instance state is closed over by `next()`; there is no module-level
  mutable state and no cross-instance leakage. Verified by
  `test/rng.test.js:67` "per-instance state is isolated".

### 1.2 `src/core/difficulty.js`
- `difficultyLevel` clamps to `[0, maxLevel]` (defensive against negative
  elapsed) and floors to an integer. Matches T2 contract exactly.
- `clampInt` floors first, then clamps — safe under any real-valued center or
  drift because the arithmetic never propagates non-integers past this
  helper.
- Every roll flows through the **injected** rng (`rng.nextInt(min, max)`).
  There is no module-level import of `rng.js`, so difficulty is genuinely
  seedable-from-outside. This is the pattern INV-2 mandates and it composes
  well with the future `GameModel` in Phase 03.
- Bomb range uses `base + growthPerLevel * level ± variance` and clamps to
  `[brickMin, brickMax]`. With current config (`base 5`, `growthPerLevel 2`,
  `variance 3`, `maxLevel 12`), values compute to `[2, 8]` at t=0 and
  `[26, 30]` at t=HUGE — a clean saturating climb without ever escaping
  `[1, 30]`.
- Naming conforms to the purity-scan mandate (`brickValueRange`,
  `bombValueRange`, never `…Window`).

### 1.3 `src/core/grid.js`
- Adds a stable `row` id to the brick shape (as recommended by the phase plan
  §4 T3) so `clearRow` can target a row by identity, independent of any later
  `y` mutation.
- `createRow` validates `values.length === config.grid.columns` and throws a
  clear message — good defensive guard against a caller wiring the model
  wrong.
- `clearRow` builds `nextBricks` via `map` and, for bricks in the cleared row,
  returns a fresh `{ ...brick, alive: false }`; other bricks are passed
  through by reference. This is snapshot-immutable for the modified subset,
  which is the pattern the phase-plan T3 contract asks for. The input
  collection is never mutated — verified by
  `test/grid.test.js:104` "clearRow ... leaves other rows intact" and its
  purity assertion at line 121.
- `columnBricks` sorts by `y` with an inline lambda; O(n log n) is fine for
  the small brick counts this playable will ever see (§7 of TDD notes "tens
  of bricks on screen").
- `topEdgeY` returns `null` for empty/all-dead, matching the T3 contract, and
  uses a single-pass loop with a manual comparator (no allocation).

### 1.4 `src/core/scoring.js`
- The whole INV-4 guarantee is expressed by a single `nonDecreasingDelta`
  helper: any non-finite or non-positive delta contributes 0. This makes
  INV-4 impossible to violate accidentally in a downstream caller and is
  covered by `test/scoring.test.js:42, 56, 62, 70`.
- `createScore()`, `addValue()`, `reset()` all return fresh `{ total }`
  objects; the input is never mutated. Verified.

## 2. Architecture Compliance

- **INV-1 (core purity):** No new module imports Phaser or references
  `document`/`window`. Enforced by the pre-existing `test/config.test.js:91`
  scan, which now covers all four new modules. Independent manual grep
  confirms zero matches across `src/core/`.
- **INV-2 (deterministic randomness):** No `Math.random` / `Date.now` /
  `new Date` / `performance.now` occurrences in `src/core/`; the dynamic
  scan at `test/rng.test.js:126` enforces this and covers every new file.
  `difficulty.js` reads no clock — `elapsedSeconds` is always a parameter.
- **INV-3 / INV-5 / INV-6 / INV-8:** Out of scope this phase, correctly
  untouched. They will bind in Phase 03 when `GameModel` and collision land.
- **INV-4 (scoring):** Fully enforced at the primitive layer by
  `nonDecreasingDelta` and covered by four tests.
- **INV-7 value bound:** Every draw path in `difficulty.js` terminates in
  `rng.nextInt(min, max)` with both ends inside `[1, 30]` because
  `brickValueRange` and `bombValueRange` clamp to `[brickMin, brickMax]`.
  The invariant is asserted over 2 000 draws at elapsed 0 / 40 / `HUGE` in
  `test/difficulty.test.js:66, 80`.

## 3. Security Considerations

Not applicable. This is a fully client-side, headless-testable pure-logic
delivery with no network, no persistence, no user-input parsing, no `eval`,
and no external asset load. The mulberry32 PRNG is not cryptographic — and
correctly so; the RNG's role per TDD §5 is deterministic gameplay replay,
not security.

## 4. Performance Observations

- The core is allocation-frugal: RNG draws are pure arithmetic; grid helpers
  are O(n) filters/maps over small collections; scoring is O(1). No hot-path
  concern at Phase 02's problem size (tens of bricks, one bomb).
- `clearRow` builds a new `bricks` array on every call. For the intended
  playable scale this is trivial; a future optimizer could switch to
  structural sharing, but it is not warranted at Phase 02's fidelity.
- `columnBricks` sorts by `y` on every call. Again fine at this scale; the
  Phase 03 tick loop can memoize per-frame if profiling shows it.

## 5. Test Suite Quality

- **Positive / negative / edge / determinism-invariant** dimensions are all
  represented per module (see `30-review.md` §4 for the per-file inventory).
- Statistical assertions (`upward drift`, `endpoint reachability`) use fixed
  seeds and sufficient sample sizes (N=500 / 2 000 / 5 000) to be reliable
  under CI variance.
- Assertions are strict: `deepEqual` on brick shapes, `Number.isInteger`
  everywhere a bound is claimed, explicit inclusive-range checks, and
  mutation-purity guards on grid and scoring.
- The two dynamic core-purity guards (INV-1 in `config.test.js`, INV-2 in
  `rng.test.js`) walk the whole `src/core/` tree at test time, so any future
  file added under `src/core/` is automatically covered — a durable structural
  invariant, not a one-time snapshot.
- No `.skip`, `.todo`, or `.only` markers are present in any suite.

## 6. Recommendation

No code-review changes are requested. The delivered simulation core is
compact, cleanly separated, correctly parameterized (rng and elapsed injected
rather than read from ambient state), and adequately validated. Approved to
proceed to `resolve`.
