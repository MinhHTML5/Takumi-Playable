# Node Plan: Phase 01 — Playable Shell & Test Harness

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 01
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Rules

This document defines the authoritative execution sub-graph for Phase 01: the `build` and `debug`
nodes that planning materializes via `phase_execution_set`. `review` and `resolve` are provided by
the `delivery_loop` and attach automatically after this sub-graph. Aliases are stable identifiers;
dependencies reference aliases only. Every node traces to Task Inventory scope in `12-phase-plan.md`
and must not expand beyond its Work Packet.

Decomposition: Phase 01 splits into **two build roots along a validation seam** —
`P01-BUILD-CORE-HARNESS` is validated headlessly (`node --test`); `P01-BUILD-SHELL` is validated by
manual browser boot + `node --check`. The shell root depends on the core-harness root because
`src/main.js` imports `src/core/config.js` (a real input dependency, not incidental ordering). Both
build roots are stabilized by a single debug node.

---

## 2. Node List

### Node: `P01-BUILD-CORE-HARNESS`
- Alias: `P01-BUILD-CORE-HARNESS`
- Lane: `lane:build`
- Title: `lane:build Phase 01 Build: Core Config & node:test Harness`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md`
  - `../30-risk-register.md`
  - `./12-phase-plan.md`
- Outputs (paths):
  - `package.json`
  - `src/core/config.js`
  - `test/config.test.js`
- Work Packet (strict scope):
  - **T1** — Create `package.json` at repo root: `"type": "module"`, `"scripts": { "test":
    "node --test" }`, project metadata, no runtime npm dependencies. Create the `src/`,
    `src/core/`, `src/scenes/`, `test/` directory layout.
  - **T2** — Implement `src/core/config.js` as the single tunables source of truth covering the full
    TDD §4.1 set: `design { width: 720, height: 1280 }`; `scale { mode: 'FIT', autoCenter:
    'CENTER_BOTH' }` (string tokens); grid dimensions; `rise.speed`; `spawn.interval`;
    `bomb { fallSpeed, cooldown }` (cooldown ≈ 0.5 s); `values { brickMin: 1, brickMax: 30 }`;
    bomb-value scaling params; difficulty-curve params; `tint { low: <green>, high: <red> }`;
    `particles.maxConcurrent`; `debug: false`. First-pass values are fine (tuned in Phases 02–03).
    **No Phaser/DOM import; no logic** (INV-1).
  - **T3** — Implement `test/config.test.js` (`node:test` + `node:assert`): assert `config.js`
    imports; assert required keys/types/bounds (`design.width === 720`, `design.height === 1280`,
    `values.brickMin === 1`, `values.brickMax === 30`, `bomb.cooldown > 0`, `rise.speed > 0`,
    `spawn.interval > 0`, `tint.low`/`tint.high` defined); assert **core purity** by reading every
    `*.js` under `src/core/` and failing if any contains `phaser` (case-insensitive), `document`,
    or `window` (INV-1).
  - Do NOT implement any simulation logic, rendering, input, or the shell — those are other nodes /
    later phases.
- Validation Commands:
  - `npm test`   (equivalently `node --test`)
- Validation Classes:
  - `unit`

### Node: `P01-BUILD-SHELL`
- Alias: `P01-BUILD-SHELL`
- Lane: `lane:build`
- Title: `lane:build Phase 01 Build: Phaser Portrait Shell & Neon Background`
- Priority: `1`
- Depends On: `[P01-BUILD-CORE-HARNESS]`
- Inputs (paths):
  - `../10-tdd.md`
  - `../30-risk-register.md`
  - `./12-phase-plan.md`
  - `src/core/config.js`  (from `P01-BUILD-CORE-HARNESS`)
- Outputs (paths):
  - `index.html`
  - `src/main.js`
  - `src/scenes/BootScene.js`
  - `src/scenes/GameScene.js`
  - `vendor/phaser.min.js`  (when vendoring succeeds; otherwise a pinned CDN `<script>` in `index.html`)
- Work Packet (strict scope):
  - **T4** — Make a pinned Phaser 3 runtime (`phaser@3.80.0`) available to `index.html`. **Primary:**
    vendor `phaser.min.js` into `vendor/phaser.min.js` and reference it via
    `<script src="./vendor/phaser.min.js">`. **Fallback (no network):** reference the pinned CDN URL
    `https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js` and record a "vendor Phaser
    locally" carry-forward note in the completion summary. Do NOT add Phaser as an npm dependency.
    Runtime acquisition **must not block** the node — no automated gate imports Phaser (INV-1).
  - **T5** — Implement the browser shell:
    - `index.html`: portrait `<meta name="viewport" content="width=device-width, initial-scale=1,
      maximum-scale=1">`, a game mount element, the Phaser `<script>` from T4, and
      `<script type="module" src="./src/main.js">`.
    - `src/main.js`: import `./core/config.js`; build the Phaser `Game` config — `type: Phaser.AUTO`,
      `width: config.design.width`, `height: config.design.height`,
      `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }` (map the config
      string tokens to Phaser enums here), `scene: [BootScene, GameScene]` — and start the game.
    - `src/scenes/BootScene.js`: minimal boot scene that immediately starts `GameScene` (no heavy
      asset work this phase).
    - `src/scenes/GameScene.js`: render a **plain neon background only** (procedural gradient/solid
      fill via Phaser Graphics or camera background). No simulation, input, or juice.
  - Do NOT implement gameplay, the neon-art factory (`src/render/neon.js`), input, tint mapping, or
    juice — later-phase scope.
- Validation Commands:
  - `node --check src/main.js && node --check src/scenes/BootScene.js && node --check src/scenes/GameScene.js`
  - Manual DoD: open `index.html` in a mobile-portrait browser; confirm boot + visible neon
    background at 720×1280 (FIT + CENTER_BOTH).
- Validation Classes:
  - `unit`  (syntax integrity via `node --check`; functional/visual correctness is the manual DoD
    check, as the shell imports the browser-only Phaser global and cannot execute headlessly)

### Node: `P01-DEBUG-STABILIZE`
- Alias: `P01-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 01 Debug: Stabilize Harness & Shell`
- Priority: `1`
- Depends On: `[P01-BUILD-CORE-HARNESS, P01-BUILD-SHELL]`
- Inputs (paths):
  - `./12-phase-plan.md`
  - `./13-node-plan.md`
  - `package.json`, `src/core/config.js`, `test/config.test.js`
  - `index.html`, `src/main.js`, `src/scenes/BootScene.js`, `src/scenes/GameScene.js`
- Outputs (paths):
  - `takumi/runs/delivery/blockdrop-2/phase-01/stabilization-report.md`
- Work Packet (strict scope):
  - Execute the phase validation commands: `npm test` and
    `node --check src/main.js && node --check src/scenes/BootScene.js && node --check src/scenes/GameScene.js`.
  - Diagnose any failure, apply bounded repairs within Phase 01 task scope (T1–T5), and rerun until
    green or a stop condition is reached.
  - Confirm the INV-1 purity assertion is present and passing.
  - Produce `stabilization-report.md` recording commands run, outcomes, and any repairs.
- Validation Commands:
  - `npm test`
  - `node --check src/main.js && node --check src/scenes/BootScene.js && node --check src/scenes/GameScene.js`
- Validation Classes:
  - `unit`

#### Debug Scope
Stabilizes the Phase 01 build output (core harness + shell) within the referenced build scope. No
new feature work; no simulation, rendering-beyond-background, input, or juice.

#### Allowed Repair Surface
- Small implementation bugs in `config.js`, the test, or shell files within Phase 01 scope
- ESM/`package.json` misconfiguration (e.g. missing `"type": "module"`, wrong `test` script)
- Test discovery / assertion wiring issues in `test/config.test.js`
- Syntax errors surfaced by `node --check`
- Switching T4 from vendored to pinned-CDN reference if the runtime file is unavailable

#### Stop Conditions
Debug must escalate with `status: blocked` (not defer) if:
- an architecture invariant is genuinely unsatisfiable (e.g. a core module truly requires a
  Phaser/DOM reference — a design contradiction)
- required functionality is missing in a way that needs an architecture decision
- more than 3 repair cycles hit the same failure class, or the same failure repeats after repair
  (defer to a remediation loop only if the fix is bounded and concrete; otherwise block)
Note: inability to fetch the Phaser runtime is **not** a stop condition — use the pinned-CDN
fallback (T4) and record a carry-forward.

---

## 3. Validation Classes

- `unit` — required this phase: `config.js` smoke + `src/core/` purity assertion via `node --test`;
  shell syntax integrity via `node --check`.
- `integration` — none this phase (no cross-module simulation exists yet; begins Phase 03).
- `contract` — none this phase (the `GameModel` API is defined in Phase 03).

Visual/browser correctness is verified manually against the DoD (TDD §2: no automated browser
testing).

---

## 4. Base Execution Order

```
P01-BUILD-CORE-HARNESS ─┐
                        ├─> P01-DEBUG-STABILIZE ─> review ─> resolve
P01-BUILD-SHELL ────────┘
        ▲
        └── depends on P01-BUILD-CORE-HARNESS (main.js imports config.js)
```

- Build nodes are defined here; `P01-BUILD-SHELL` depends on `P01-BUILD-CORE-HARNESS`.
- `P01-DEBUG-STABILIZE` depends on both build nodes.
- `review` (closure gate) and `resolve` are provided by the `delivery_loop`. Review depends on
  debug; resolve depends on review (and any remediation-loop review nodes that rejoin).

---

## 5. Graph Constraints

- DAG, no cycles: `CORE-HARNESS → SHELL → DEBUG → (review → resolve)`, with `CORE-HARNESS → DEBUG`
  as a second edge into debug.
- Dependencies reference declared aliases only.
- Build roots may run in parallel where independent; here SHELL has a real dependency on
  CORE-HARNESS, so it follows it.
- Debug depends on all build nodes; review depends on debug; resolve depends on review.

---

## 6. Remediation Loops (Runtime, Not Predefined)

Not predefined. Any build, debug, or review node may open a `remediation_loop`
(`build → debug → review`, rejoining at resolve) at closure for a blocking, in-scope, bounded defect.
Loops run in parallel and are bounded by `max_self_recurrence: 5`. Do not add remediation nodes to
this document.

---

## 7. Priority Contract

All Phase 01 nodes are priority `1` (High) — this phase is the foundation every later phase depends
on. All values are within the allowed `0–4` range.
