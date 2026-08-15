# Phase Plan: Phase 04 — Rendering & Input Binding

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 04
- Related PRD: `../00-prd.md`
- Related TDD: `../10-tdd.md`
- Related Phases: `../20-phases.md`
- Related Risks: `../30-risk-register.md`
- Related Prior Carry Forward: `../phase-03/32-carry-forward.md`
- Status: Approved
- Last Updated: 2026-08-15

---

## 1. Phase Goal

Make the accepted, headless `GameModel` **visible and playable** in the Phaser runtime: render the
model's bricks, bomb, and danger line from `getState()`, drive the model with Phaser's frame delta,
and forward taps to `dropBomb`. This is the first phase that binds the pure simulation core (Phases
01–03) to the browser. No juice effects yet (Phase 05) and no game-over overlay yet (Phase 06) —
Phase 04 delivers static rendering plus the input/loop binding.

**Why this is the smallest safe slice.** The heavy logic already exists and is validated headlessly
(85/85 core tests). Phase 04 adds only the presentation/input adapter. Its genuinely testable
surface — the green→red **tint mapping** (INV-7) and the **fixed-timestep splitter** that protects
the collision-step constraint (CF-04) — is extracted into pure, Phaser-free modules with `node:test`
coverage. The Phaser-coupled remainder (texture factory + scene wiring) can only be validated by
static syntax checks (`node --check`) plus the manual DoD browser check, so it is isolated into its
own nodes and kept thin (INV-3: the scene never mutates model state except through the model API).

**Validation boundary.** The phase is validatable as a unit: the new pure helpers pass unit tests,
the full existing core suite still passes unchanged (regression), and every Phaser module parses
under `node --check`. The end-to-end "it renders and plays in a browser" check is a manual DoD item
(it cannot be executed headlessly) and is carried explicitly, not silently assumed.

---

## 2. Scope

### In-Scope
- New Phaser-free render helpers under `src/render/`:
  - `tint.js` — pure `valueToTint(value, config)` implementing the monotonic green→red mapping
    over `[config.values.brickMin, config.values.brickMax]` (= `[1,30]`), driven by
    `config.tint.low`/`config.tint.high` (INV-7). Unit-tested headlessly.
  - `loop.js` — pure `fixedSteps(dtSeconds, maxStep)` that splits a variable Phaser frame delta into
    bounded sub-steps so a single `model.tick` never advances the bomb more than one row height
    (preserves the accepted point-overlap collision constraint, CF-04). Unit-tested headlessly.
- `src/render/neon.js` — procedural Phaser texture factory: background gradient + glow, a **neutral
  (white) brick body** texture designed for per-brick `setTint`, a neutral bomb texture, and a
  danger-line texture. Registers named texture keys. (Render layer — may import Phaser.)
- `src/scenes/BootScene.js` — updated to invoke the neon texture factory before starting
  `GameScene`.
- `src/scenes/GameScene.js` — rewritten to: construct a `GameModel` with a seeded RNG; advance it
  each frame via `fixedSteps` → `model.tick`; render alive bricks, the active bomb, the static
  danger line, and a minimal live score readout from `model.getState()`, tinting brick/bomb sprites
  via `valueToTint`; map `pointerdown` → `model.dropBomb(pointer.worldX)`; and freeze the loop on
  `status === 'gameover'`.
- Additive-only tunables in `src/core/config.js` (`config.loop.maxStepSeconds`) — pure data, no
  change to any value asserted by `test/config.test.js`.
- Headless unit tests for the two pure helpers (`test/tint.test.js`, `test/loop.test.js`).

### Out-of-Scope
- Juice/game-feel effects — explosion particles, brick spawn fade-in, exact-match screen shake,
  danger-line pulsing, animated partial-damage tint transitions (Phase 05). Phase 04 renders the
  danger line **statically** and draws bricks at full alpha; it may read `getState()` values to set
  a brick's tint, but drains no `consumeEvents()` juice.
- `GameOverScene`, game-over fade-in, final-score screen, and the fake `Play` CTA / restart flow
  (Phase 06). On game-over Phase 04 simply stops advancing the model and leaves the final frame.
- Any change to simulation rules, the `GameModel` public API/event shape, or existing asserted
  `config.js` values.
- Removing `Test.txt` (CF-02) and the `main.js` scale-token warning (CF-03) — see §10.
- Automated browser / end-to-end / visual-regression testing (TDD §2: visuals verified manually).

Anything above in Out-of-Scope is absent from the Task Inventory (§4).

---

## 3. Deliverables and Exit Criteria

### Deliverables
- `src/render/tint.js`, `src/render/loop.js` with `test/tint.test.js`, `test/loop.test.js`.
- `src/render/neon.js` procedural texture factory + updated `src/scenes/BootScene.js`.
- Rewritten `src/scenes/GameScene.js` binding the model, rendering state, and forwarding input.
- Additive `config.loop` tunables in `src/core/config.js`.

### Exit Criteria
- [ ] Implementation tasks (T1–T6) complete.
- [ ] Required validation commands pass: `node --test` green (existing 85 core tests unchanged +
      new `tint`/`loop` unit tests), and `node --check` clean on every changed `.js` (render modules,
      scenes, `main.js`).
- [ ] Tint mapping is monotonic green→red across `[1,30]` and both endpoints match
      `config.tint.low`/`config.tint.high` (unit — INV-7).
- [ ] `fixedSteps` splits any frame delta into sub-steps each `≤ config.loop.maxStepSeconds`, whose
      sum equals the input delta, and that value guarantees `bomb.fallSpeed * maxStep < grid.rowHeight`
      (unit — CF-04).
- [ ] Debug stabilization completed.
- [ ] Review completed with `accept` (correctness + structural).
- [ ] No invariant violations introduced (INV-1 core purity still holds — new Phaser code lives in
      `src/render/`/`src/scenes/`, never `src/core/`; INV-3 one-way state ownership preserved).
- [ ] Carry-forward items from Phase 03 were explicitly evaluated (§10).

Manual DoD (human step, outside the automated gates — CF-01):
- [ ] Page boots in a mobile-portrait browser, renders the neon background, bricks/bomb/danger line
      appear at model positions, a tap drops a bomb (respecting cooldown), values scale up over
      time, and a no-input session reaches game-over — verified manually against the DoD checklist.

If review requests changes, every remediation loop it opens must complete (the loop's review must
`accept`) before the phase may exit:
- [ ] All remediation loops resolved (loop review `accept`).

---

## 4. Task Inventory (Canonical Scope)

### T1 — Pure value→tint mapping
- Task ID: T1
- Type: implementation
- Description: Implement `valueToTint(value, config)` — clamp `value` to
  `[config.values.brickMin, config.values.brickMax]`, then linearly interpolate each RGB channel
  between `config.tint.low` (at min) and `config.tint.high` (at max), returning an integer
  `0xRRGGBB`. Pure and Phaser/DOM-free. Named export `valueToTint` plus a `default` export (house
  convention). Traces to TDD §4.1 (neon tint helper) / §4.4 INV-7.
- Files / Areas: `src/render/tint.js`
- Outputs: `src/render/tint.js`
- Test Intent: covered by T2.
- Validation Commands: `node --check src/render/tint.js`
- Dependencies: none.
- Carry Forward References: none.

### T2 — Tint mapping unit tests
- Task ID: T2
- Type: test
- Description: Unit tests asserting: `valueToTint(brickMin)` equals `config.tint.low` and
  `valueToTint(brickMax)` equals `config.tint.high`; across `value = 1..30` the red channel is
  non-decreasing and the green channel is non-increasing (monotonic green→red, INV-7); values below
  min and above max clamp to the endpoints; every returned channel is an integer in `[0,255]`.
  Specific-value assertions (no truthiness). Imports the real `config`.
- Files / Areas: `test/tint.test.js`
- Outputs: `test/tint.test.js`
- Test Intent: prove INV-7's tint half headlessly, independent of Phaser.
- Validation Commands: `node --test test/tint.test.js`
- Dependencies: T1.

### T3 — Fixed-timestep frame-delta splitter
- Task ID: T3
- Type: implementation
- Description: Implement `fixedSteps(dtSeconds, maxStep)` returning an array of sub-step durations
  that sum to `dtSeconds` (within float tolerance) with each element `≤ maxStep`; `dtSeconds <= 0`
  returns `[]`; `0 < dtSeconds <= maxStep` returns `[dtSeconds]`; larger deltas are split into
  `ceil(dtSeconds / maxStep)` near-equal sub-steps. Pure and Phaser/DOM-free. Named export
  `fixedSteps` plus `default`. Additionally extend `src/core/config.js` with an **additive** `loop`
  block: `loop: { maxStepSeconds: 0.05 }` — chosen so `bomb.fallSpeed(900) * 0.05 = 45 <
  grid.rowHeight(120)`, preserving the accepted point-overlap collision constraint (CF-04). Additive
  only: change no value asserted by `test/config.test.js`. Traces to TDD §4.3 collision-overlap note
  and CF-04.
- Files / Areas: `src/render/loop.js`, `src/core/config.js` (additive `loop` block only)
- Outputs: `src/render/loop.js`, updated `src/core/config.js`
- Test Intent: covered by T4.
- Validation Commands: `node --check src/render/loop.js`, `node --test test/config.test.js`
- Dependencies: none.
- Carry Forward References: CF-04.

### T4 — Fixed-timestep unit tests
- Task ID: T4
- Type: test
- Description: Unit tests asserting: sub-steps sum to the input delta (within a small epsilon);
  every sub-step `≤ maxStep`; `dtSeconds <= 0` (zero and negative) returns `[]`; a delta equal to or
  below `maxStep` returns a single-element array; a large delta (e.g. a 0.5 s tab-defocus spike)
  splits into the expected count of bounded sub-steps; and, using the real `config`,
  `config.bomb.fallSpeed * config.loop.maxStepSeconds < config.grid.rowHeight` (the CF-04 safety
  guarantee). Specific-value assertions.
- Files / Areas: `test/loop.test.js`
- Outputs: `test/loop.test.js`
- Test Intent: prove the frame-delta binding cannot skip a brick (CF-04), headlessly.
- Validation Commands: `node --test test/loop.test.js`
- Dependencies: T3.

### T5 — Neon procedural texture factory + Boot wiring
- Task ID: T5
- Type: implementation
- Description: Implement `src/render/neon.js` exporting a `generateTextures(scene)` function (and a
  set of exported texture-key constants) that procedurally creates and registers, via Phaser
  Graphics → `generateTexture`: (a) a background gradient + glow, (b) a **neutral white** brick-body
  texture with a neon border/glow suitable for per-instance `setTint`, (c) a neutral bomb texture,
  and (d) a danger-line texture. Textures are generated **once** (reused thereafter — TDD §7
  caching). Update `src/scenes/BootScene.js` to call `generateTextures(this)` in its `create()`
  before `this.scene.start('GameScene')`. May import/use the `Phaser` global (render layer — INV-1
  applies only to `src/core/`). Traces to TDD §4.1 (Neon Art Factory) / §7.
- Files / Areas: `src/render/neon.js`, `src/scenes/BootScene.js`
- Outputs: `src/render/neon.js`, updated `src/scenes/BootScene.js`
- Test Intent: no headless unit test possible (Phaser-coupled). Validated by `node --check` (parses)
  and the manual DoD browser check that textures render.
- Validation Commands: `node --check src/render/neon.js`, `node --check src/scenes/BootScene.js`
- Dependencies: none (produces neutral textures; does not depend on the tint mapping).
- Carry Forward References: none.

### T6 — GameScene: model binding, rendering, input
- Task ID: T6
- Type: implementation
- Description: Rewrite `src/scenes/GameScene.js` to bind the simulation to Phaser:
  - Construct one `GameModel({ config, rng })` in `create()`, seeding the RNG via `createRng(seed)`
    from `src/core/rng.js`. The seed is chosen in the scene (render layer) — e.g. a time-based seed
    for session variety; INV-2 constrains only `src/core/`, so a wall-clock seed here is allowed.
  - Draw the neon background and place a **static** danger line at `y = config.gameOver.topY`.
  - Each `update(time, delta)`: compute `dt = delta / 1000`; for each step in
    `fixedSteps(dt, config.loop.maxStepSeconds)` call `model.tick(step)`; skip ticking when
    `status === 'gameover'`.
  - Render from `model.getState()` only (INV-3, read-only): one sprite per **alive** brick at
    `(columnCenterX(col), y + rowHeight/2)` using the neutral brick texture with
    `setTint(valueToTint(value, config))` (tint reflects current value, so partial-damage bricks
    show their reduced-value colour); the active bomb sprite when `bomb !== null`, tinted by its
    value; and a minimal live score text from `state.score`. Reconcile sprites to state each frame
    (reuse a sprite pool or a keyed map; destroy/hide sprites for dead/removed bricks).
  - Input: on `pointerdown`, call `model.dropBomb(pointer.worldX)` (the model owns column snapping +
    the cooldown/one-bomb gate, INV-5 — the scene forwards the game-space X unchanged; under
    `Scale.FIT` + `CENTER_BOTH` pointer coordinates are already in the 720×1280 game space).
  - On `status === 'gameover'`, stop advancing/accepting input and leave the final frame rendered
    (the overlay + restart is Phase 06).
  - Do **not** drain `consumeEvents()` for effects and do **not** add juice — Phase 05 scope.
  - Must not mutate model state except through model methods (INV-3). May import the `Phaser` global.
  Traces to TDD §4.1 (Render/Input Layer, GameScene) / §4.3 API / §4.4 INV-3, INV-5, INV-7, and
  phases.md Phase 04 exit criteria.
- Files / Areas: `src/scenes/GameScene.js`
- Outputs: rewritten `src/scenes/GameScene.js`
- Test Intent: no headless unit test (Phaser-coupled); the column-snap + cooldown gate it relies on
  is already covered by the Phase 03 `test/simulation.test.js` suite (regression). Validated by
  `node --check` and the manual DoD browser check.
- Validation Commands: `node --check src/scenes/GameScene.js`
- Dependencies: T1 (`valueToTint`), T3 (`fixedSteps` + `config.loop`), T5 (texture keys).
- Carry Forward References: CF-01 (this is the rendering that makes the manual boot/play check
  meaningful), CF-04 (consumes `fixedSteps`).

### T7 — Stabilization & full validation
- Task ID: T7
- Type: validation
- Description: Run the full validation gate, diagnose any failures, apply bounded in-scope repairs,
  and rerun to green: `node --test` (the complete suite — existing 85 core tests must remain
  unchanged/green as regression, plus the new `tint`/`loop` unit tests) and `node --check` on every
  changed `.js` file (`src/render/tint.js`, `src/render/loop.js`, `src/render/neon.js`,
  `src/scenes/BootScene.js`, `src/scenes/GameScene.js`, and `src/main.js` if touched). Confirm the
  INV-1 core-purity scan inside `test/config.test.js` still passes (no Phaser/DOM leaked into
  `src/core/`).
- Files / Areas: all Phase 04 outputs.
- Outputs: `stabilization-report.md` (debug node completion artifact/report).
- Test Intent: prove the phase is green and regression-free before review.
- Validation Commands: `node --test`, and `node --check <each changed .js>`
- Dependencies: T1–T6.

---

## 5. Task Breakdown (Human Organization)

### 5.1 Backend Tasks
- N/A — standalone browser playable, no backend.

### 5.2 Frontend Tasks
- Task: Pure render helpers (tint mapping + fixed-timestep splitter)
  - Task ID: T1, T2, T3, T4
  - Files/Areas: `src/render/tint.js`, `src/render/loop.js`, `src/core/config.js` (additive),
    `test/tint.test.js`, `test/loop.test.js`
  - Notes: Phaser-free by design so they are unit-testable under `node --test`; this is the phase's
    real automated-validation surface.
  - Depends on: none (T2 on T1, T4 on T3).
- Task: Neon texture factory + Boot wiring
  - Task ID: T5
  - Files/Areas: `src/render/neon.js`, `src/scenes/BootScene.js`
  - Notes: neutral (white) base textures tinted at render time via `setTint`; generated once.
  - Depends on: none.
- Task: GameScene model/render/input binding
  - Task ID: T6
  - Files/Areas: `src/scenes/GameScene.js`
  - Notes: thin adapter; reads `getState()`, forwards `dropBomb`, freezes on game-over.
  - Depends on: T1, T3, T5.

### 5.3 Cross-Cutting Tasks
- Task: Stabilization & full validation
  - Task ID: T7
  - Files/Areas: all Phase 04 outputs
  - Notes: full `node --test` regression + `node --check` on Phaser modules.
  - Depends on: T1–T6.

---

## 6. Dependency Notes (Human Explanation)

- Two independent build roots run in parallel: **RENDER-CORE** (pure `tint.js` + `loop.js`) and
  **NEON-ART** (`neon.js` + Boot wiring). They share no seam — `neon.js` emits *neutral* textures
  and does not consume the tint mapping (tinting happens at render time in the scene), so forcing a
  dependency between them would be incidental serialization, not a real input constraint.
- **SCENE-BIND** (`GameScene.js`) has real input dependencies on both roots: it imports `valueToTint`
  (RENDER-CORE) and `fixedSteps` + `config.loop` (RENDER-CORE), and it uses the texture keys
  produced by NEON-ART. Hence it depends on both.
- Debug stabilization depends on all build nodes (it validates their combined output).
- Review depends on the debug node; closure readiness depends on review `accept` plus any
  remediation-loop reviews.

---

## 7. Validation Plan

### 7.1 Validation Classes

- `unit` — **required**. `valueToTint` monotonic green→red + endpoint fidelity (INV-7);
  `fixedSteps` sub-step bounds/sum + the CF-04 travel-vs-row-height guarantee. Plus regression of the
  existing 85-test core suite (all `unit`/`integration`/`contract` classes from Phases 02–03 must
  remain green — Phase 04 touches only additive `config` data and non-core files).
- `integration` — no **new** headless integration is added (the model↔render binding is Phaser-only
  and browser-verified). The tap→column-snap + cooldown-gate behaviour the scene relies on is
  already covered by the Phase 03 `simulation` integration/unit suite and is exercised as regression.
- `contract` — none new; the `GameModel` public API/event shape is unchanged and remains covered by
  the Phase 03 contract tests (regression).

Optional for this phase:
- Static syntax validation (`node --check`) of the Phaser-coupled modules that cannot be imported
  under `node:test` — the build/lint gate for browser code (see §7.2).

### 7.2 Validation Commands

- Unit tests: `node --test test/tint.test.js`, `node --test test/loop.test.js`
- Integration tests: `node --test` (full suite — exercises the Phase 02–03 integration/contract
  tests as regression; no new integration file this phase)
- Contract tests: covered by `node --test` (Phase 03 `simulation` contract assertions, regression)
- Full regression gate: `node --test` (equivalently `npm test`)
- Build / lint (Phaser modules, cannot run headlessly): `node --check src/render/neon.js`,
  `node --check src/scenes/BootScene.js`, `node --check src/scenes/GameScene.js`,
  `node --check src/render/tint.js`, `node --check src/render/loop.js`,
  `node --check src/main.js`
- Migrations / reset / seed steps: none.

All required commands must pass before the phase may exit.

### 7.3 Completion Artifact Validation

Every node concludes with a `takumi_complete` call carrying a valid completion artifact
(`schema_version` 1; matching `node_id`/`run_id`; terminal `status`; `outcome`; `summary`;
`directives`). All lanes emit `close_node`; any node that commits emits `record_repo_changes` with
real commit SHAs on the assigned branch.

### 7.4 Debug Stabilization Contract

Debug executes the §7.2 commands, diagnoses failures, applies bounded repairs within Phase 04 task
scope, and reruns until green or a stop condition is hit. Debug introduces no new feature work and
touches no out-of-scope file.

### 7.5 Stabilization Stop Conditions

Debug must **stop and escalate with `status: blocked`** (not loop) when: an invariant (INV-1..8)
cannot be satisfied without a design change; required functionality is missing; or a fix needs a
design/architecture decision the node is not authorized to make. Debug may apply bounded
stabilization, or defer to a remediation loop only for a bounded, build-fixable defect, when: more
than 3 repair cycles hit the same failure class, or the same failure repeats after repair. A
`node --check` parse failure or a failing new unit test is a bounded in-scope fix, not a block.

### 7.6 Review and Remediation Validation

Review is the single closure gate: it validates render/input correctness and scope compliance,
INV-1/INV-3/INV-5/INV-7 preservation, the new unit coverage, and that the existing core suite is
untouched/green. Blocking in-scope defects open bounded `remediation_loop`s
(`max_self_recurrence: 5`) that rejoin at resolve; the phase closes only when the phase review and
every loop review record `accept`.

### 7.7 Edge Cases to Validate

- `valueToTint` at exactly `brickMin`/`brickMax` and for out-of-range inputs (clamped).
- `fixedSteps` with `dt = 0`, negative `dt`, `dt` exactly `= maxStep`, and a large spike delta.
- A frame delta large enough (tab defocus) that, **without** splitting, the bomb would traverse more
  than one row height — confirm the split keeps per-tick travel below `grid.rowHeight` (CF-04).
- Existing core suite regression: `node --test` still reports the full prior green count plus the two
  new unit files, with no changed assertion in Phases 01–03 tests.

---

## 8. Environment Contract

No runtime environment required for the **automated** validation gates — `node --test` and
`node --check` run entirely locally with Node's built-in tooling and never import Phaser or touch a
browser. The manual DoD check (booting and playing the page in a mobile-portrait browser, CF-01) is
a **human** step performed outside the automated gates; it is not an automated environment
dependency and does not gate the debug/review pipeline's `node`-based commands.

---

## 9. Risk Touchpoints

- Risk IDs: R3 (testability of Phaser), R5 (performance on mobile), plus the CF-04 collision-step
  constraint (traced to Phase 03 review advisory A-1).
- How mitigated this phase:
  - **R3** — the only new logic that must be *correct* (tint mapping, frame-delta splitting) is
    extracted into pure, Phaser-free modules with `node:test` unit coverage; the Phaser scenes stay
    thin (read `getState()`, forward `dropBomb`) and are held to `node --check` + manual DoD. INV-3
    keeps state mutation inside the model, so the untested scene cannot corrupt game logic.
  - **R5** — neon textures are generated once at boot and reused (no per-frame Graphics redraws),
    and brick sprites are reconciled to state rather than recreated each frame. Full particle/effect
    budgeting is Phase 05, but Phase 04 establishes the reuse pattern.
  - **CF-04** — `fixedSteps` bounds per-tick bomb travel (`900 * 0.05 = 45 < 120`), preserving the
    accepted point-overlap constraint even under variable/spiky browser frame deltas.

---

## 10. Carry Forward Consumption

- Carry Forward ID: **CF-01** — execute the mobile-portrait browser boot / neon-background (now
  full render) check.
  - Source: Phase 01 review manual DoD, re-deferred by Phase 03.
  - Disposition: **Included** (in part). Phase 04 delivers the rendering + input binding that makes
    the manual boot/play check meaningful and adds its automated preconditions (T5/T6 parse under
    `node --check`; the core suite stays green). The actual manual browser boot/play verification
    cannot be executed by a headless agent and is carried as a Phase 04 **manual DoD exit item**
    re-deferred to a human pass (see §3 Manual DoD).
  - Rationale: the render surface CF-01 was waiting on now exists; only the human-in-the-loop browser
    check remains, which no headless node can perform.
  - Related Task IDs: T5, T6 (and the §3 manual DoD item).

- Carry Forward ID: **CF-02** — remove the pre-existing empty `Test.txt`.
  - Source: Phase 01 review advisory 1, re-deferred by Phase 03.
  - Disposition: **Deferred again** → Phase 06 (final integration cleanup).
  - Rationale: Phase 04 has no repository-cleanup task; deleting unrelated tracked content inside a
    rendering phase would obscure provenance (same reasoning Phase 03 applied). Phase 06 is the
    designated final-cleanup phase.
  - Related Task IDs: none.

- Carry Forward ID: **CF-03** — debug-only warning for unknown scale-configuration tokens in
  `main.js`.
  - Source: Phase 01 review advisory 2 / code review, re-deferred by Phase 03.
  - Disposition: **Deferred again**.
  - Rationale: Phase 04's necessary change surface is the render helpers + `neon.js` + the two
    scenes; `main.js`'s scale-token mapping is not modified (scenes are already registered). The
    accepted fallback is safe; a warning remains optional observability, not required for rendering,
    and adding it here would be unscoped churn. Revisit whenever `main.js`'s scale boundary is next
    edited.
  - Related Task IDs: none.

- Carry Forward ID: **CF-04** — preserve the collision-step constraint (or adopt swept overlap) when
  bomb speed / tick cadence / row height changes.
  - Source: Phase 03 review advisory A-1 / code-review CQ-1.
  - Disposition: **Included**. Phase 04 introduces the variable-cadence trigger the item warned
    about (Phaser's per-frame delta feeding `model.tick`). Rather than change the model or adopt
    swept overlap, T3/T4 add `fixedSteps` to split each frame delta into sub-steps bounded so
    per-tick travel (`fallSpeed * maxStepSeconds = 45`) stays below `grid.rowHeight` (120),
    preserving the accepted point-overlap constraint. Bomb speed, row height, and tick cadence are
    otherwise unchanged this phase.
  - Related Task IDs: T3, T4, T6.

---

## 11. Invariant Audit Confirmation

- Confirmed invariants reviewed: YES (INV-1..8).
- Any invariant modifications: NONE. INV-1 (core purity) is preserved — all new Phaser code lives in
  `src/render/`/`src/scenes/`, never `src/core/`; the two new pure helpers in `src/render/` remain
  Phaser/DOM-free by design so they are unit-testable but are outside the `src/core/` purity scan.
  INV-3 (one-way state ownership), INV-5 (cooldown/one-bomb), and INV-7 (value & tint bounds) are the
  invariants this phase actively exercises.
- Risk register regression concerns: NONE new. R3 and R5 are addressed as in §9; no Phase 01–03
  assertion changes.
- Deferred work impact review: CF-04 is discharged in-scope (T3/T4/T6); CF-01 partially discharged
  (manual step re-deferred to human); CF-02/CF-03 re-deferred with rationale (§10).
- Prior carry-forward reviewed: YES.
- Carry-forward items brought into scope this phase: CF-04 (fully), CF-01 (automated preconditions;
  manual browser step re-deferred).
- Carry-forward items deferred again: CF-02 (→ Phase 06), CF-03 (until `main.js` scale boundary is
  next edited).

---

## 12. Phase Closure Contract

Required base sequence: build → debug → review → resolve.

Build roots (parallel): `P04-BUILD-RENDER-CORE` and `P04-BUILD-NEON-ART`; then
`P04-BUILD-SCENE-BIND` (depends on both) → `P04-DEBUG-STABILIZE` → review (delivery_loop) → resolve.

Review is the single closure gate. Any remediation loop it opens runs in parallel and rejoins at
resolve. The phase exits only when the phase review records `accept` and every remediation-loop
review records `accept`. Only then may resolve reconcile artifacts and close the phase.
