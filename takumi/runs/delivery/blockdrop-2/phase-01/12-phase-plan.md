# Phase Plan: Phase 01 — Playable Shell & Test Harness

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 01
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: N/A (first phase)
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Phase Goal

Establish the **runtime skeleton and the headless validation harness** for the whole feature: a
bootable mobile-portrait Phaser 3 game that renders a plain neon background, plus the Phaser-free
tunables module (`config.js`) and a `node:test` harness wired through `package.json`.

This is the smallest safe delivery slice because it stands up two independent foundations without
implementing any gameplay:

1. The **Phaser-free core foundation** — `config.js` (single source of truth for tunables) and the
   `node --test` harness — which every later simulation phase (02, 03) builds on and validates
   against. It is validatable entirely headlessly.
2. The **Phaser browser shell** — `index.html`, `src/main.js` config, `BootScene`, `GameScene`
   rendering a neon background — which every later render/feel phase (04–06) attaches to. It is
   validated by manual browser boot plus syntax integrity.

Both preserve the architectural invariants they touch (INV-1 core purity: `config.js` imports no
Phaser) and introduce no gameplay logic, so regression risk is minimal. Neither foundation's
automated gate depends on the Phaser runtime, which decouples validation from Phaser acquisition
(R1).

---

## 2. Scope

### In-Scope
- `package.json` at repo root: `"type": "module"`, `"scripts": { "test": "node --test" }`, project
  metadata, no runtime dependencies (Phaser is delivered to the browser, not via npm install).
- `src/core/config.js` — the tunables module: a single exported config object (or named exports)
  covering **every** tunable the TDD assigns to config (design resolution, scale tokens, grid
  dimensions, rise speed, spawn interval, bomb fall speed, drop cooldown, brick value range
  `[1,30]`, bomb value scaling params, difficulty-curve params, green→red tint endpoints, particle
  cap, debug flag). No logic, **no Phaser/DOM import** (INV-1). First-pass values; final tuning is
  deferred to Phases 02–03.
- `test/config.test.js` — `node:test` smoke test: imports `config.js` successfully, asserts the
  required tunable keys exist with sane types/bounds (e.g. `brickMin === 1`, `brickMax === 30`,
  positive numeric speeds), and a **core-purity assertion** that reads every file under `src/core/`
  and fails if any references `phaser`, `document`, or `window` (INV-1 enforcement).
- `index.html` at repo root — mobile-portrait viewport meta, a mount point, loads the pinned Phaser
  3 runtime (see task T4 for the acquisition contract), and loads `src/main.js` as a module.
- `src/main.js` — builds the Phaser `Game` config from `config.js` values: 720×1280 design
  resolution, `Scale.FIT` + `Scale.CENTER_BOTH`, scene list `[BootScene, GameScene]`, then starts
  the game. Maps the string scale tokens from `config.js` to Phaser enums here (keeps config
  Phaser-free).
- `src/scenes/BootScene.js` — minimal boot scene: performs no heavy asset work this phase, then
  starts `GameScene`. (The procedural neon-art factory is Phase 04 scope.)
- `src/scenes/GameScene.js` — renders a **plain neon background** (a simple procedural gradient/
  solid fill using Phaser Graphics or camera background) and nothing else. No simulation, no input.
- `vendor/` directory (or CDN reference) for the Phaser runtime per the T4 acquisition contract.

### Out-of-Scope (must not appear in Task Inventory)
- Any simulation logic: RNG, difficulty, grid, scoring, collision, tick loop (Phases 02–03).
- The procedural neon-art factory `src/render/neon.js` and real textures (Phase 04).
- Input handling / tap→drop (Phase 04).
- Any juice effects — particles, shake, fade-in, danger-line pulse (Phase 05).
- Game-over scene and restart CTA (Phase 06).
- Green→red tint **mapping function** implementation (Phase 04); only the tint **endpoint
  constants** live in `config.js` this phase.
- Automated browser/end-to-end/visual-regression testing (out-of-scope per TDD §2).

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `package.json` with `test` script and `type: module`.
- `src/core/config.js` exposing the full tunable set, Phaser-free.
- `test/config.test.js` smoke + purity test.
- `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`.
- Phaser 3 runtime made available to the browser (vendored file or pinned CDN reference).

### Exit Criteria
- [ ] Implementation tasks complete (T1–T5).
- [ ] `node --test` runs and the config smoke + purity test passes (unit).
- [ ] `node --check` parses `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`
      without syntax errors.
- [ ] `config.js` exposes the tunable set defined in the TDD and imports no Phaser (INV-1).
- [ ] Page boots in a browser in portrait (720×1280 design, FIT + CENTER_BOTH) and renders a neon
      background (manual DoD check).
- [ ] Debug stabilization completed.
- [ ] Review completed with `accept` (correctness + structural).
- [ ] No invariant violations introduced (INV-1 in particular).
- [ ] Carry-forward items from the prior phase were explicitly evaluated (N/A — first phase).
- [ ] All remediation loops resolved (loop review `accept`), if any opened.

---

## 4. Task Inventory (Canonical Scope)

### T1 — Project scaffold & test harness
- Task ID: T1
- Type: implementation
- Description: Create `package.json` at repo root with `"type": "module"`, a `"test"` script set to
  `node --test`, and project metadata. No runtime npm dependencies. Create the `src/`, `src/core/`,
  `src/scenes/`, and `test/` directory layout.
- Files / Areas: `package.json`, directory scaffold.
- Outputs: `package.json`; empty tracked directory structure (via the files added in later tasks).
- Test Intent: `node --test` (and `npm test`) executes the test runner and discovers `test/`.
- Validation Commands: `npm test` (equivalently `node --test`).
- Dependencies: none.

### T2 — Tunables module (`config.js`)
- Task ID: T2
- Type: implementation
- Description: Implement `src/core/config.js` as the single source of truth for tunables. Export a
  config object covering: `design { width: 720, height: 1280 }`; `scale { mode: 'FIT', autoCenter:
  'CENTER_BOTH' }` (string tokens, mapped to Phaser enums in `main.js`); `grid` dimensions
  (columns, row height in game units); `rise.speed`; `spawn.interval`; `bomb { fallSpeed, cooldown
  }` (cooldown ≈ 0.5 s); `values { brickMin: 1, brickMax: 30 }`; bomb-value scaling params;
  difficulty-curve params (upward drift); `tint { low: <green>, high: <red> }` endpoints;
  `particles.maxConcurrent` cap; `debug: false`. First-pass values are acceptable; they are tuned
  in Phases 02–03. **No Phaser/DOM import; no logic.**
- Files / Areas: `src/core/config.js`.
- Outputs: `src/core/config.js`.
- Test Intent: covered by T3 (key/type/bounds assertions + purity).
- Validation Commands: `npm test`.
- Dependencies: T1.
- Carry Forward References: none.

### T3 — Config smoke + core-purity test
- Task ID: T3
- Type: test
- Description: Implement `test/config.test.js` using `node:test` + `node:assert`. (a) Import
  `config.js` and assert it loads. (b) Assert the required tunable keys are present with correct
  types and bounds — concretely: `design.width === 720`, `design.height === 1280`,
  `values.brickMin === 1`, `values.brickMax === 30`, `bomb.cooldown > 0`, `rise.speed > 0`,
  `spawn.interval > 0`, and that `tint.low`/`tint.high` are defined. (c) **Core-purity assertion
  (INV-1):** read every `*.js` file under `src/core/` and assert none contains `phaser`
  (case-insensitive), `document`, or `window` — failing the test if a forbidden reference is found.
- Files / Areas: `test/config.test.js`.
- Outputs: `test/config.test.js`.
- Test Intent: unit — the test fails if a required tunable is missing/mistyped/out-of-bounds, or if
  any core module imports Phaser/DOM. Covers positive (keys present) and negative (forbidden
  import) cases.
- Validation Commands: `npm test` (`node --test`).
- Dependencies: T2.

### T4 — Phaser runtime acquisition (browser shell dependency)
- Task ID: T4
- Type: implementation
- Description: Make a **pinned** Phaser 3 runtime available to `index.html` (target `phaser@3.80.0`).
  **Primary approach:** vendor `phaser.min.js` into `vendor/phaser.min.js` and reference it with a
  relative `<script src="./vendor/phaser.min.js">` for a self-contained, offline-runnable playable
  (R1 mitigation, TDD §6). **Fallback (no-network sandbox):** if the runtime file cannot be fetched
  in this environment, reference the pinned CDN URL
  `https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js` in `index.html` and record
  "vendor Phaser locally" as a Phase-01 carry-forward item. **Either path is acceptable and neither
  blocks the phase**, because no automated validation gate imports Phaser (INV-1) — `node --test`
  and `node --check` both pass without the runtime present. Do not add Phaser as an npm dependency.
- Files / Areas: `vendor/phaser.min.js` (if vendored), `index.html` (script reference).
- Outputs: the Phaser `<script>` reference resolvable by the browser; `vendor/phaser.min.js` when
  vendoring succeeds.
- Test Intent: manual — browser boot (T5 DoD check) confirms `Phaser` global is defined and the
  canvas renders. No automated gate depends on this task.
- Validation Commands: manual DoD (browser boot); no headless command.
- Dependencies: T1.

### T5 — Phaser shell: config, boot, and neon background
- Task ID: T5
- Type: implementation
- Description: Implement the browser shell. `index.html`: portrait `<meta name="viewport">`, a game
  mount, the Phaser `<script>` (T4), and `<script type="module" src="./src/main.js">`. `src/main.js`:
  import `config.js`, build the Phaser `Game` config — `type: AUTO`, `width: config.design.width`,
  `height: config.design.height`, `scale.mode = Phaser.Scale.FIT`, `scale.autoCenter =
  Phaser.Scale.CENTER_BOTH` (mapping the config string tokens to Phaser enums), `scene: [BootScene,
  GameScene]` — and start the game. `src/scenes/BootScene.js`: minimal boot that immediately starts
  `GameScene` (no heavy asset work this phase). `src/scenes/GameScene.js`: render a plain neon
  background only (simple procedural gradient/solid fill via Phaser Graphics or camera background).
  No simulation, input, or juice.
- Files / Areas: `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`.
- Outputs: the four shell files above.
- Test Intent: (a) structural — `node --check` parses each `.js` shell file with no syntax error;
  `main.js` imports `./core/config.js` and lists both scenes. (b) manual DoD — the page boots in a
  browser in portrait at the 720×1280 design resolution (FIT + CENTER_BOTH) and renders a visible
  neon background.
- Validation Commands: `node --check src/main.js && node --check src/scenes/BootScene.js &&
  node --check src/scenes/GameScene.js`; plus manual browser boot.
- Dependencies: T2 (main.js imports config.js), T4 (Phaser runtime reference).

---

## 5. Task Breakdown (Human Organization)

### 5.1 Core / Headless Tasks (Phaser-free, `node --test`)
- Task: Project scaffold & harness
  - Task ID: T1
  - Files/Areas: `package.json`, dir layout
  - Notes: `type: module`; `test` → `node --test`; no npm runtime deps.
  - Depends on: —
- Task: Tunables module
  - Task ID: T2
  - Files/Areas: `src/core/config.js`
  - Notes: full tunable set from TDD §4.1; Phaser-free (INV-1); first-pass values.
  - Depends on: T1
- Task: Config smoke + purity test
  - Task ID: T3
  - Files/Areas: `test/config.test.js`
  - Notes: keys/types/bounds + `src/core/` purity grep assertion (INV-1).
  - Depends on: T2

### 5.2 Browser Shell Tasks (Phaser, manual boot + `node --check`)
- Task: Phaser runtime acquisition
  - Task ID: T4
  - Files/Areas: `vendor/phaser.min.js` and/or `index.html`
  - Notes: pinned `phaser@3.80.0`; vendor primary, pinned-CDN fallback; never blocks (INV-1).
  - Depends on: T1
- Task: Shell config, boot, neon background
  - Task ID: T5
  - Files/Areas: `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`
  - Notes: 720×1280, FIT + CENTER_BOTH; GameScene renders plain neon background only.
  - Depends on: T2, T4

### 5.3 Cross-Cutting Tasks
- None. (No migrations, no cleanup, no cross-repo work — single repo, greenfield.)

---

## 6. Dependency Notes (Human Explanation)

- **T2 before T3** — the smoke/purity test imports and asserts against `config.js`.
- **T2 before T5** — `main.js` imports `config.js` for the design resolution and scale tokens; this
  is a real input dependency, so the shell build node depends on the core-harness build node.
- **T4 before T5** — `index.html` references the Phaser runtime the shell needs to boot; T4 defines
  where that runtime comes from. (T4 and T5 are owned by the same build node, so this is intra-node
  ordering.)
- **T1 before everything** — the scaffold and `test` script are the ground the rest stands on.
- **Debug stabilization depends on** both build nodes completing (it runs `node --test` and
  `node --check` across the whole phase output).
- **Review depends on** debug. **Closure readiness depends on** review `accept` (and any
  remediation-loop reviews).

The two build roots split along a **validation seam**: the core harness is validated headlessly by
`node --test`; the shell is validated by manual boot + `node --check`. The shell root depends on the
core root only because `main.js` legitimately imports `config.js` — not incidental ordering.

---

## 7. Validation Plan

### 7.1 Validation Classes

Required for this phase:
- `unit` — `config.js` smoke test (keys/types/bounds) and the `src/core/` purity assertion (INV-1),
  run by `node --test`.

Optional / structural for this phase:
- Syntax integrity of the browser shell via `node --check` (not a canonical class, but a concrete
  automated gate for the shell files, which cannot execute headlessly because they import the
  browser Phaser global).

Not applicable this phase:
- `integration` — no cross-module simulation exists yet (begins Phase 03).
- `contract` — the `GameModel` API does not exist yet (defined Phase 03).

Manual (DoD) validation — visual/browser correctness is verified manually, per TDD §2 (no automated
browser testing):
- Page boots in a browser in mobile portrait at the 720×1280 design resolution (FIT + CENTER_BOTH)
  and renders a visible neon background.

### 7.2 Validation Commands

Authoritative headless gates (debug executes these; all must pass before the phase may exit):

- Unit tests: `npm test` (equivalently `node --test`)
- Integration tests: none this phase
- Contract tests: none this phase
- Shell syntax check: `node --check src/main.js && node --check src/scenes/BootScene.js &&
  node --check src/scenes/GameScene.js`
- Migrations / reset steps: none
- Seed steps: none
- Build / lint: none required (no bundler; plain ES modules per TDD §4.204)

Manual gate (not a headless command; recorded as DoD evidence):
- Open `index.html` in a browser sized to mobile portrait; confirm boot + neon background render.

### 7.3 Completion Artifact Validation

All node work concludes with a `takumi_complete` call carrying a valid completion artifact
(`schema_version: 1`, matching `node_id`/`run_id`, terminal `status`, `outcome`, `summary`,
`directives`). Build/debug nodes that commit must include `record_repo_changes` with real 40-char
SHAs on the assigned branch, and `close_node`.

### 7.4 Debug Stabilization Contract

Debug executes `npm test` and the `node --check` shell command, diagnoses any failure, applies
bounded repairs within phase task scope (T1–T5), and reruns until green or a stop condition is hit.
Debug must not introduce simulation logic, rendering beyond the plain background, input, or juice —
that is later-phase scope.

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** when: an architecture invariant is violated
(e.g. a core module genuinely requires a Phaser/DOM reference — a design contradiction), required
functionality is missing in a way that needs an architecture decision, or a systemic issue exceeds
debug authority. Debug may defer to a remediation loop only for a bounded, concretely-fixable defect
when: >3 repair cycles hit the same failure class, the same failure repeats after repair, or the
environment cannot be stabilized. A single failing assertion or a typo is fixed in place, not
deferred. **Note:** inability to fetch the Phaser runtime is **not** a blocker — fall back to the
pinned CDN reference (T4) and record a carry-forward; no gate depends on the runtime.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it validates correctness/scope (config tunable set complete and
matching the TDD; shell boots and renders per DoD), evidence sufficiency (`node --test` green,
purity assertion present and passing, `node --check` clean), and structural integrity (INV-1
preserved; scenes are thin; no gameplay logic leaked in). Blocking in-scope defects open bounded
remediation loops that rejoin at resolve; the phase closes only when the phase review and every loop
review record `accept`. Loops are bounded (`max_self_recurrence: 5`).

### 7.7 Edge Cases to Validate

- `config.js` loads under Node's ESM loader with `"type": "module"` (no CommonJS/ESM mismatch).
- Purity assertion actually **fails** if a forbidden token is introduced into `src/core/` (the test
  is not a tautology — it scans real file contents).
- `node --check` on shell files passes despite their reference to the browser-only `Phaser` global
  (syntax-only check does not resolve/execute imports).
- Portrait scaling: the design resolution 720×1280 with FIT + CENTER_BOTH letterboxes correctly
  rather than clipping (manual, across a couple of portrait sizes — R7 touched lightly here).

---

## 8. Environment Contract

**No runtime environment required.** All authoritative validation is local: `node --test` and
`node --check` run offline with only a Node.js runtime and require no server, database, browser
automation, or network. The one browser check is a manual DoD step performed by opening
`index.html`, not an automated environment gate.

---

## 9. Risk Touchpoints

- Risk IDs: **R1** (Phaser runtime acquisition / version drift), **R7** (portrait scaling across
  viewports — touched lightly), and invariant **INV-1** (core purity).
- How mitigated this phase:
  - **R1:** Pin `phaser@3.80.0`; vendor `phaser.min.js` for self-containment, with a pinned-CDN
    fallback if the sandbox lacks network. Crucially, `config.js` and all tests import no Phaser
    (INV-1), so `node --test`/`node --check` never depend on runtime acquisition — the phase is
    never blocked by it (per R1 mitigation and TDD §6).
  - **R7:** Fix the 720×1280 design resolution with `Scale.FIT` + `CENTER_BOTH` in `main.js` so the
    canvas letterboxes rather than clips; verified manually across a couple of portrait sizes.
  - **INV-1:** Enforced by the `test/config.test.js` purity assertion scanning `src/core/`.

---

## 10. Carry Forward Consumption

Not applicable — Phase 01 is the first phase; there is no prior `32-carry-forward.md`. (A new
carry-forward item — "vendor Phaser locally" — may be **produced** this phase only if the T4 CDN
fallback is used; that is recorded at phase resolve, not consumed here.)

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES
- Any invariant modifications: NONE
- Risk register regression concerns: NONE (no prior code exists to regress; INV-1 actively enforced
  by the new purity test)
- Deferred work impact review: NONE (no prior deferrals)
- Prior carry-forward reviewed: NOT APPLICABLE (first phase)
- Carry-forward items brought into scope this phase: NONE
- Carry-forward items deferred again: NONE

---

## 12. Phase Closure Contract

Required base sequence: **build → debug → review → resolve**.

- Two parallel build roots: `P01-BUILD-CORE-HARNESS` (T1–T3) and `P01-BUILD-SHELL` (T4–T5), the
  latter depending on the former (`main.js` imports `config.js`).
- One debug node `P01-DEBUG-STABILIZE` depends on both build nodes and runs the full validation set.
- `review` (closure gate) and `resolve` are provided by the `delivery_loop` and attach after this
  sub-graph. Review depends on debug; resolve depends on review (and any remediation-loop reviews).

The phase exits only when the phase review records `accept` and every remediation-loop review (if
any) records `accept`. Only then does resolve reconcile artifacts and close Phase 01.
