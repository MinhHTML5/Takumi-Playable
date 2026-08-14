# Phase 01 — Code Review Report

- Feature: blockdrop-2
- Phase: 01 — Playable Shell & Test Harness
- Reviewer Node: 8dae50e7-00e4-4266-9248-9d5e75269d48
- Scope: repository files added or modified across build nodes P01-BUILD-CORE-HARNESS
  and P01-BUILD-SHELL, plus the harness `package.json`.
- Date: 2026-08-14

---

## 1. Files Reviewed

| Path | Task | Purpose |
|---|---|---|
| `package.json` | T1 | ESM + `node --test` harness wiring; no runtime npm deps |
| `src/core/config.js` | T2 | Single source of truth for tunables; Phaser-free (INV-1) |
| `test/config.test.js` | T3 | Smoke assertions + INV-1 core-purity grep |
| `index.html` | T4, T5 | Portrait viewport, mount, vendored Phaser + module entry |
| `vendor/phaser.min.js` | T4 | Pinned Phaser 3.80.0 runtime, ~1.18 MB, vendored path succeeded |
| `src/main.js` | T5 | Phaser Game config; string-token → enum boundary |
| `src/scenes/BootScene.js` | T5 | Minimal boot; immediately starts GameScene |
| `src/scenes/GameScene.js` | T5 | Plain neon vertical-gradient background |
| `src/scenes/.gitkeep` | T1 | Scaffold placeholder (harmless alongside real scenes) |

Not scoped to review (pre-existing / out of Phase 01 scope): `Test.txt` (empty
stray at repo root, commit `4b13f39`, predates Phase 01).

---

## 2. Code Quality Findings

### 2.1 `src/core/config.js`
- **Structure:** single exported `config` object (named + default). Grouped by
  concern (design, scale, grid, rise, spawn, bomb, values, difficulty, tint,
  particles, debug). Comments explain **why** each value exists and cross-reference
  TDD sections and PRD questions where relevant — not restating **what** the code
  literally does.
- **Naming:** consistent; string tokens (`'FIT'`, `'CENTER_BOTH'`) chosen
  deliberately to mirror Phaser's enum names, keeping the mapping site in
  `main.js` trivial.
- **Type safety:** all numerics use plain numbers; no `undefined`/`NaN` risks.
  `columnWidth = design.width / columns = 120` is a clean integer.
- **Deferred concerns properly annotated:** first-pass tuning values note that
  Phases 02–03 finalize them; bomb `value` scaling params are named for their
  future consumer (difficulty logic).
- **INV-1 preservation:** literal-only content — no `import`, no `phaser` /
  `document` / `window` substrings anywhere in the file (confirmed by the
  purity test).
- Finding: none. Advisory only — the `bomb.value.growthPerLevel` and
  `difficulty.valueDriftPerLevel` have slightly overlapping intent (both raise
  values with difficulty). Phase 02–03 tuning will disambiguate them; no
  refactor needed now.

### 2.2 `test/config.test.js`
- **Structure:** flat `test()` calls per concern group, one file, imports only
  `node:test`, `node:assert/strict`, and `node:fs`/`node:path`/`node:url` — no
  third-party test dependencies (aligned with the `node --test` mandate).
- **Assertion quality:** specific-value asserts (720, 1280, 1, 30) rather than
  weak truthiness checks. Would fail meaningfully on off-by-one and copy-paste
  regressions.
- **Purity test design:** recursive walk over `src/core/`, `files.length > 0`
  guard against tautological pass, per-file substring scan with structured
  violation messages. Case-insensitive substring is coarse but errs conservative
  for an invariant — the correct direction.
- Finding: none. Note only — the FORBIDDEN list could grow (`localStorage`,
  `navigator`, `fetch`) in later phases if additional DOM/network primitives
  need blocking; not required for Phase 01.

### 2.3 `src/main.js`
- **Structure:** thin — imports, two lookup tables, one config-object literal,
  one game construction. This is the correct shape for a Phaser boot.
- **Boundary discipline:** the string-token → `Phaser.Scale.*` enum mapping is
  the single boundary and it lives on the Phaser side, exactly as the TDD
  prescribes. `config.js` never sees a Phaser symbol.
- **Fallback behaviour:** `?? Phaser.Scale.FIT` and `?? Phaser.Scale.CENTER_BOTH`
  keep the shell booting on unknown tokens. Silent, but shell-resilience-appropriate.
- **Runtime coupling:** relies on the browser `Phaser` global provided by the
  vendored script — commented and intentional (not imported so INV-1's spirit
  extends here; no bundler is required).
- Finding: none blocking. Advisory (repeated from `30-review.md` §7): a
  `debug`-gated `console.warn` when a scale token is missing from the lookup
  would surface config drift earlier; deferrable.

### 2.4 `src/scenes/BootScene.js`
- Minimal, single-purpose. `create()` immediately transitions to `GameScene`.
- No preload work — matches the phase plan (procedural neon-art factory is
  Phase 04). Correctly leaves the seam for later phases to attach texture
  generation.
- Finding: none.

### 2.5 `src/scenes/GameScene.js`
- Draws a vertical gradient via 64 horizontal `fillRect` bands, interpolated
  between a deep-indigo top and a near-black bottom, plus a camera clear colour
  underneath. Simple, procedural, no textures — matches the "plain neon
  background only" mandate.
- Uses `config.design.{width, height}` for gradient bounds (no duplicated
  literals).
- No simulation, input, particles, or juice — correct scope discipline.
- Finding: none. Advisory — the gradient endpoints are not in `config.tint` (they
  are scene-local literals). This is deliberate: `config.tint.low/high` are the
  brick/bomb value-tint endpoints (Phase 04 mapping), not background palette.
  Keeping them separate is right; no refactor.

### 2.6 `index.html`
- Portrait viewport meta locks zoom (`maximum-scale=1.0, user-scalable=no`) —
  necessary for R7 (portrait-scaling correctness).
- Mount element `<div id="game">` matches `main.js` `parent: 'game'`.
- Vendored Phaser loaded via classic `<script>` **before** the ES module — the
  correct ordering so `Phaser` is defined when `main.js` executes.
- Base CSS fills the viewport with black; overflow hidden. Letterbox reads as
  backdrop.
- Finding: none.

### 2.7 `package.json`
- `"type": "module"` — matches `.js` ESM usage; no CommonJS/ESM mismatch.
- `"scripts.test": "node --test"` — canonical harness command.
- No `dependencies`/`devDependencies` — deliberate: Phaser is delivered to the
  browser via the vendored file, not via npm.
- Metadata (`name`, `version`, `private`, `description`, `license`) is present
  and sensible.
- Finding: none.

### 2.8 Stabilization report (`stabilization-report.md`)
- Records commands executed, outcomes, INV-1 confirmation, T4 vendored path
  status, and the pre-existing `Test.txt` note. No repairs applied (none
  needed).
- Finding: none.

---

## 3. Architecture Compliance

- **Two build roots along a validation seam** (core-harness vs shell) matches
  the node plan and cleanly isolates Phaser-dependent code from headless-
  testable code. Verified in the delivered layout.
- **INV-1 (Core purity)** is preserved and **automatically enforced** by the
  purity test — the single most important structural safety net for the whole
  feature.
- **No premature simulation** — `src/core/` currently contains only `config.js`
  (data). No `rng.js`, `difficulty.js`, `scoring.js`, `grid.js`, `collision.js`,
  or `simulation.js` yet — correctly reserved for Phase 02+.
- **No premature render-layer work** — `src/render/neon.js` and the tint-mapping
  helper are absent, as they should be until Phase 04.
- **Scene topology** matches TDD §4.1: BootScene → GameScene (GameOverScene
  arrives Phase 06). BootScene is the stable seam.
- **Design resolution and scaling** (720×1280 FIT + CENTER_BOTH) match PRD Q1
  and the R7 mitigation.
- **No new abstractions or premature indirection** — the map lookups in `main.js`
  and the gradient loop in `GameScene` are the simplest correct shapes.

**Architecture verdict:** compliant with the TDD; no drift.

---

## 4. Security Considerations

- **Client-only playable, no network surface** — no auth, no data collection,
  no remote fetches, no `eval`.
- **Pinned Phaser runtime, vendored locally** — the sole external dependency is
  version-pinned (`phaser@3.80.0`) and served from the repo, eliminating
  supply-chain / version-drift risk of the primary dependency (R1 mitigation,
  TDD §6).
- `index.html` does **not** load any script from an external origin (CDN fallback
  was not needed; primary vendored path succeeded).
- No secrets, credentials, or PII in any file.

**Security verdict:** no findings. Risk surface is negligible for this phase.

---

## 5. Performance Observations

- **Boot-time gradient** is drawn once in `GameScene.create()` (64 `fillRect`s)
  and not redrawn per frame — matches TDD §7 ("Generate neon textures once at
  boot and reuse; avoid per-frame Graphics redraws").
- **No per-frame allocations** in the shell (this phase has no `update()` work).
- **`particles.maxConcurrent: 120`** is a small, mobile-friendly cap; consumed
  in Phase 05.
- **Vendored Phaser** (~1.18 MB) is a one-time load; acceptable for a
  self-contained playable per PRD Q6 (no hard file-size constraint).
- Manual DoD (portrait letterboxing at 720×1280) will confirm no per-frame
  scaling artifacts.

**Performance verdict:** no findings for Phase 01. Correct scope discipline
avoids the traps that would matter later (per-tick allocations, particle
uncappedness, etc.).

---

## 6. Summary

| Dimension | Status |
|---|---|
| Correctness | ✅ All required tasks and outputs delivered |
| Completeness | ✅ Exit criteria met (headless gates; manual DoD deferred to resolve/operator) |
| Structural integrity | ✅ INV-1 preserved and enforced; no drift; no coupling leaks |
| Test coverage | ✅ Adequate for Phase 01 scope (unit + purity) |
| Security | ✅ No findings |
| Performance | ✅ Correct scope discipline; TDD §7 hot-path caveats honoured pre-emptively |
| Code quality | ✅ Clean, well-commented, no dead code or premature abstraction |

**Overall: no blocking findings. `accept`.**

Advisory items (non-blocking, non-remediation):
- Stray empty `Test.txt` at repo root — pre-existing, resolve/carry-forward
  candidate.
- Silent `?? FIT / ?? CENTER_BOTH` fallback in `main.js` scale-token lookup —
  a future debug-gated `console.warn` would surface config drift earlier.

Neither warrants opening a `remediation_loop` (both fail the "bounded, blocking,
in-scope defect" test — one is pre-existing and out of Phase 01 scope, the other
is a defensive advisory).
