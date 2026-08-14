# Phase 01 — Review

- Feature: blockdrop-2
- Phase: 01 — Playable Shell & Test Harness
- Reviewer Node: 8dae50e7-00e4-4266-9248-9d5e75269d48 (lane:review / stage:review)
- Context: Phase review (closure gate)
- Date: 2026-08-14
- Environment: node v22.22.1; headless (no service contract for this phase)

---

## 1. Review Summary

**Recommendation: `accept`.**

Phase 01 delivers a bootable mobile-portrait Phaser shell plus a Phaser-free tunables
module and a `node:test` harness that both smoke-tests the tunables and enforces
architectural invariant **INV-1** (core purity). All authoritative headless gates
pass in a single clean pass; debug required zero repairs. The implementation matches
the phase plan and the TDD; no gameplay, rendering-beyond-background, input, or
juice logic has leaked in.

Verdict: correct, complete, and structurally sound. Ready for `resolve`.

---

## 2. Task Completion Status

| Task | Type | Expected Outputs | Status |
|---|---|---|---|
| T1 — Project scaffold & test harness | implementation | `package.json` (`type: module`, `test → node --test`), `src/`, `src/core/`, `src/scenes/`, `test/` layout | ✅ complete |
| T2 — Tunables module | implementation | `src/core/config.js` covering full TDD §4.1 set, Phaser-free (INV-1) | ✅ complete |
| T3 — Config smoke + core-purity test | test | `test/config.test.js` (keys/types/bounds + INV-1 grep assertion) | ✅ complete |
| T4 — Phaser runtime acquisition | implementation | `vendor/phaser.min.js` (~1.18 MB) referenced by `index.html` | ✅ complete (vendored path succeeded — no CDN fallback needed) |
| T5 — Phaser shell (config, boot, neon background) | implementation | `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js` | ✅ complete |
| Debug stabilization | debug | `stabilization-report.md`, all gates green | ✅ complete (0 repairs) |

All five build tasks are present and traceable to Phase 01 Task Inventory scope.
No task overshot its scope (no simulation, tint mapping, input, juice, or
render/neon.js factory work leaked in — all correctly deferred to Phases 02–06).

---

## 3. Implementation Quality Assessment

### 3.1 `src/core/config.js`
- Exports both a named `config` and a default `config` (test asserts these reference
  the same object).
- Covers **every** tunable named in TDD §4.1 and the phase plan §2:
  - `design { width: 720, height: 1280 }` — matches PRD Q1 / TDD §4.1.
  - `scale { mode: 'FIT', autoCenter: 'CENTER_BOTH' }` — **string tokens**, correctly
    delegated to enum mapping in `main.js` (preserves INV-1).
  - `grid { columns: 6, rowHeight: 120 }` — columnWidth = 720/6 = 120, matches the
    portrait grid layout implied by the design resolution.
  - `rise { speed: 40 }`, `spawn { interval: 2.5 }` — positive, sane bounds.
  - `bomb { fallSpeed: 900, cooldown: 0.5, value: { base, variance, growthPerLevel } }`
    — cooldown ≈ 0.5 s (PRD Q5); bomb-value scaling params present.
  - `values { brickMin: 1, brickMax: 30 }` — matches INV-7.
  - `difficulty { levelInterval, valueDriftPerLevel, riseSpeedGrowthPerLevel, maxLevel }`
    — full curve param set (upward drift, per-level growth, cap).
  - `tint { low: 0x39ff14, high: 0xff1744 }` — green/red integer colours, distinct.
  - `particles.maxConcurrent: 120` — performance backpressure cap (TDD §7).
  - `debug: false` — diagnostics off by default.
- Pure data — **no logic, no `import`, no `phaser`/`document`/`window` reference**.
  INV-1 respected.
- First-pass values are acceptable per the phase plan (final tuning is Phase 02–03
  scope).

### 3.2 `src/main.js`
- Imports `./core/config.js`, `./scenes/BootScene.js`, `./scenes/GameScene.js` and
  uses the browser `Phaser` global (never imports it — the vendored `phaser.min.js`
  supplies it before the module runs).
- Maps `config.scale.mode` and `config.scale.autoCenter` string tokens onto
  `Phaser.Scale.*` enums via a lookup, with `?? FIT / CENTER_BOTH` fallbacks — this
  is the correct place for the string→enum boundary and keeps `config.js` engine-
  agnostic.
- Builds Phaser `Game` config with `type: AUTO`, `width/height` from
  `config.design`, `scene: [BootScene, GameScene]`, `parent: 'game'` matching the
  mount element in `index.html`, and `backgroundColor: '#000000'` so the
  letterbox reads as backdrop.
- Instantiates `new Phaser.Game(gameConfig)` and exports it as default.

### 3.3 `src/scenes/BootScene.js`
- Minimal boot scene: `create()` immediately `this.scene.start('GameScene')`. No
  heavy asset work this phase, matching the phase plan comment that the neon-art
  factory belongs to Phase 04. Correctly scoped as a stable seam for later phases.

### 3.4 `src/scenes/GameScene.js`
- Renders a **plain neon background only** — a procedural vertical gradient (64
  horizontal bands, deep neon indigo → near-black) via Phaser Graphics, plus a
  camera clear colour underneath. No simulation, no input, no juice. Matches the
  T5 mandate exactly.
- Uses `config.design.{width,height}` for the gradient bounds — no hard-coded
  resolution duplication.

### 3.5 `index.html`
- Portrait viewport meta (`width=device-width, initial-scale=1, maximum-scale=1,
  user-scalable=no, viewport-fit=cover`) — locks zoom so the FIT letterbox reads
  cleanly (R7 mitigation).
- `<div id="game">` mount element referenced by `main.js` `parent: 'game'`.
- Loads `./vendor/phaser.min.js` (classic script) **before** the module
  `./src/main.js` — correct ordering so the `Phaser` global exists when the
  module runs.
- Base CSS fills the viewport with `#000`, hides overflow.

### 3.6 `package.json`
- `"type": "module"` — matches ESM imports across the tree.
- `"scripts": { "test": "node --test" }` — matches the authoritative gate.
- **No runtime `dependencies` block** — Phaser is delivered to the browser via the
  vendored file, per the T4 mandate.

---

## 4. Test Coverage Assessment

`test/config.test.js` provides **9 subtests** — one positive assertion per required
tunable group plus the INV-1 purity check. Assertions are meaningful (specific
values, not just truthiness):

- Design resolution: `design.width === 720`, `design.height === 1280` (exact).
- Scale: type-checks (string tokens, enforcing the boundary that lets INV-1 hold).
- Grid: `columns` positive integer, `rowHeight > 0`.
- Motion: `rise.speed > 0`, `spawn.interval > 0`.
- Bomb: `fallSpeed > 0`, `cooldown > 0` **and** `<= 5` (upper bound guards against
  regressions that push cooldown out of the ~0.5 s target range).
- Bomb value scaling: `bomb.value` object with `base > 0`.
- Brick value range (INV-7): `brickMin === 1`, `brickMax === 30`, `brickMin <
  brickMax`.
- Difficulty: `difficulty` object with `levelInterval > 0`.
- Tint: both endpoints defined, numeric, **distinct** — catches the copy-paste
  regression where both endpoints get the same colour.
- Particles/debug: `particles.maxConcurrent > 0`, `debug === false`.

**INV-1 purity test** (subtest 9):
- `collectJsFiles(CORE_DIR)` walks `src/core/` recursively, filters `*.js`.
- Asserts `files.length > 0` (non-tautology guard: if the directory is empty, the
  test fails rather than silently passing).
- Reads each file and looks for `phaser`, `document`, `window` (case-insensitive
  substring). This is genuinely enforceable: if a future core module adds
  `import 'phaser'` or a stray `document.getElementById(...)`, the test fails
  with a precise message identifying file and token. Verified passing on
  current `config.js`.

**Coverage judgment:** Adequate for Phase 01 scope per the phase plan §7.1. The
only validation class required this phase is `unit` (config smoke + INV-1); both
are exercised. `integration` and `contract` are correctly deferred to Phase 03
when the `GameModel` API and cross-module simulation exist.

**Edge cases from phase plan §7.7:**
- ESM loader compatibility → confirmed by import succeeding under `node --test`
  with `"type": "module"`.
- Purity assertion non-tautology → covered by `files.length > 0` guard and the
  actual file-scan logic (asserted violations list is `deepEqual [...]`).
- `node --check` on shell files despite browser-global `Phaser` reference →
  confirmed passing for all three shell files.
- Portrait letterboxing at 720×1280 → manual DoD, cannot be automated this phase.

No obvious coverage blind spots for Phase 01. Test assertions are specific and
would fail meaningfully on the regressions they target — not weakened to pass.

---

## 5. Validation Results

### 5.1 Unit (authoritative)

Command: `npm test` (equivalently `node --test`)

Result: **PASS** — 9/9 subtests, 0 failures, duration ≈ 264 ms.

```
# tests 9
# pass 9
# fail 0
```

Re-executed in this review to confirm reproducibility on the current worktree
state (independent of the debug report). Same outcome.

### 5.2 Structural — shell syntax integrity

Command: `node --check src/main.js && node --check src/scenes/BootScene.js &&
node --check src/scenes/GameScene.js`

Result: **PASS** — all three files parse cleanly. `node --check` does not
resolve/execute imports, so the reference to the browser-only `Phaser` global
does not fail parsing (per phase plan §7.7 edge case).

### 5.3 Manual DoD (browser boot)

Not executable in this headless review lane. The phase plan §7 and TDD §2 both
codify visual/browser correctness as a manual DoD step, not an automated gate.
The **structural preconditions** for a successful boot are all in place:

- `vendor/phaser.min.js` exists (~1.18 MB) and loads before the module.
- `index.html` mount element is present and referenced by `main.js` (`parent:
  'game'`).
- Portrait viewport meta is set.
- `main.js` builds a valid Phaser `Game` config from `config.design`.
- `GameScene.create()` draws a visible gradient across the design bounds.

An operator opening `index.html` in a mobile-portrait browser should see the
neon gradient. Recorded as a DoD manual check for `resolve` / carry-forward
acknowledgement, not a blocking gate for review.

### 5.4 Classification (per `failure-classification` skill)

No failures observed. Nothing to classify as implementation, test-regression,
or environment failure. No remediation-loop trigger.

---

## 6. Structural Evaluation

Evaluated against the five dimensions from `code-review-rubric`:

### 6.1 Invariant compliance
- **INV-1 (Core purity):** ✅ Preserved. `src/core/config.js` is pure data with no
  imports; the enforcement test scans every `*.js` under `src/core/` and passes.
  The string-token pattern for `scale` correctly delegates enum resolution to the
  boundary in `main.js`.
- **INV-2 (Deterministic randomness):** ✅ Not touched this phase (no RNG,
  `Math.random`, or wall-clock read anywhere in `src/core/`). Reserved for Phase 02+.
- **INV-3 (One-way state ownership):** ✅ Not touched — no `GameModel` exists yet.
- **INV-4..INV-8:** ✅ Not applicable this phase (require gameplay code); the
  tint endpoints for INV-7 are in place ready for the Phase 04 mapping helper.

### 6.2 Contract conformance
- No `GameModel ↔ render` contract exists yet (Phase 03 scope). This phase
  establishes the pre-contract shell only. `main.js` builds Phaser's `Game`
  config using the documented `Phaser.Scale.*` and `Phaser.AUTO` API — no
  Phaser API misuse identified.

### 6.3 Architectural drift
- No drift. The core/render separation is respected: the only cross-cutting
  import is `GameScene → ../core/config.js`, which is legitimate (design
  resolution is a shared constant, not simulation state).
- The BootScene→GameScene transition is a stable seam. Later phases can extend
  `BootScene.create` to preload procedurally-generated textures without shell
  restructuring.

### 6.4 Hidden coupling / boundary leakage
- **None identified.** `config.js` has zero engine imports; `main.js` is the only
  boundary where string tokens meet Phaser enums. Scenes hold references to
  `Phaser.Scene` via inheritance only — expected for the Phaser framework.
- The FIT/AUTO_CENTER lookup tables in `main.js` fall back to sensible defaults
  (`FIT` / `CENTER_BOTH`) on unrecognised tokens — silent, but the config-side
  test would still catch an invalid string via its structural asserts, and this
  is intentional shell resilience, not a hidden coupling.

### 6.5 Validation blind spots
- The purity check is a **case-insensitive substring** grep. This is coarse (a
  string literal like `'documentation'` in a comment would falsely trip it), but
  in the INV-1 direction the coarseness is **conservative** — it errs toward
  false positives rather than silent failures, which is the right side for an
  invariant guardrail. Not a blocker.
- No test verifies the string-token → Phaser-enum mapping in `main.js`. That
  mapping is exercised only by the manual browser boot. Acceptable for Phase 01
  (the shell is intentionally not headlessly-testable per TDD §2 / phase plan
  §7.1); if a later phase adds a headless boundary test for the mapping, that
  would strengthen coverage.
- No unit test enforces that `values.brickMin < values.brickMax` — actually it
  is asserted (test 5). ✓
- No test enforces that `tint.low !== tint.high` — actually asserted (test 7). ✓

---

## 7. Issues Found

**None blocking.** No `changes_requested` findings.

Two **advisory** observations (non-blocking, not opening a remediation loop):

1. **A stray empty `Test.txt` at repo root** (`4b13f39`, predates Phase 01
   builds) is unrelated to Phase 01 scope. Debug correctly left it untouched
   (outside its bounded repair surface). Recommend `resolve` note it as a
   pre-existing cleanup item — either delete in a later phase's cleanup task or
   record as a carry-forward. Not a review blocker.
2. **Silent fallback in `main.js` scale-token lookup** (`?? Phaser.Scale.FIT` /
   `?? Phaser.Scale.CENTER_BOTH`) — if a future config change puts an unknown
   token there, the shell boots correctly but nothing signals the config drift.
   Not blocking for Phase 01; a future refinement could `console.warn` when
   `debug: true` and a token is missing from the lookup. Note only.

---

## 8. Completeness Against Exit Criteria (Phase Plan §3)

- [x] Implementation tasks complete (T1–T5).
- [x] `node --test` runs and the config smoke + purity test passes.
- [x] `node --check` parses `src/main.js`, `src/scenes/BootScene.js`,
      `src/scenes/GameScene.js` without syntax errors.
- [x] `config.js` exposes the tunable set defined in the TDD and imports no Phaser (INV-1).
- [ ] Page boots in a browser in portrait (720×1280 design, FIT + CENTER_BOTH)
      and renders a neon background — **manual DoD**, structural preconditions
      verified; a headless review cannot execute it. Deferred to `resolve` /
      operator confirmation, non-blocking per phase-plan §7.
- [x] Debug stabilization completed.
- [x] Review completed with `accept` (this document).
- [x] No invariant violations introduced (INV-1 in particular).
- [x] Carry-forward items from the prior phase were explicitly evaluated —
      N/A (first phase).
- [x] All remediation loops resolved — none opened.

---

## 9. Recommendation

**`accept`.** Close the phase-review node; downstream `resolve` proceeds.

No remediation loop opened (no blocking defects). No `add_phase` warranted (no
in-PRD scope gap discovered). No ADR emitted (this phase established the
already-recorded architecture from the TDD without material new decisions).
