# Phase 05 — Review (Closure Gate)

**Node:** review (Phase 05 closure gate, delivery_loop)
**Lane / Stage:** review / review
**Phase Plan:** [`12-phase-plan.md`](./12-phase-plan.md)
**Node Plan:** [`13-node-plan.md`](./13-node-plan.md)
**Debug Stabilization:** [`stabilization-report.md`](./stabilization-report.md)
**TDD:** [`../10-tdd.md`](../10-tdd.md)

---

## Review Summary

- **Recommendation:** `accept`.
- **Reviewer assessment:** All exit criteria met. The four build outputs
  (`src/render/effects.js` + `test/effects.test.js`, additive `config.effects`
  block, `TEX_PARTICLE` texture in `src/render/neon.js`, and event-driven wiring
  in `src/scenes/GameScene.js`) satisfy the T1–T5 task scope. The full
  `node --test` gate is green (108/108 — 99 unchanged Phase 02–04 regression
  tests + 9 new pure-helper tests) and every changed `.js` parses cleanly under
  `node --check`. Every phase invariant (INV-1..8) is structurally preserved:
  effects mutate no model state (INV-3), consume the existing event shape
  unchanged (INV-8's `rowClear` trigger, INV-7's per-frame tint refresh), and
  the additive `config.effects` block introduces no forbidden token so the
  INV-1 core-purity scan stays at zero violations. Independent re-run of the
  gate this review reproduced 108/108 pass + clean parses.
- **Blocking findings:** none.
- **Advisory findings:** three minor items (see §6). None warrants remediation.

---

## Task Completion Status

Each task in [`12-phase-plan.md`](./12-phase-plan.md) §4 is traced to its
delivered output and validated:

| Task | Type | Delivered Output | Validation | Status |
|------|------|------------------|-----------|--------|
| **T1** — Pure `effects.js` helpers | implementation | `src/render/effects.js` — `dangerPulse(t, config) → { alpha, scaleY }` (sine/lerp between `[minAlpha,maxAlpha]` / `[minScaleY,maxScaleY]` per `config.effects.dangerPulse`); `explosionParticleCount(outcome, config) → integer` (per-outcome mapping clamped to `config.particles.maxConcurrent`); named exports + `default` bundle | `node --test test/effects.test.js` 9/9; `node --check src/render/effects.js` OK | Complete |
| **T2** — `effects.test.js` unit coverage | test | `test/effects.test.js` — 9 tests: exports, mid-band at `t=0`, band bounds over 3-period sweep, extrema at quarter/three-quarter period, periodicity across 5 periods, exact per-outcome counts, cap enforcement (R5), unknown-outcome `0`, fractional truncation + negative clamp + integer type | `node --test test/effects.test.js` green | Complete |
| **T3** — Additive `config.effects` block | implementation | `src/core/config.js:122–157` — `dangerPulse` (freq 1.2 Hz, alpha [0.55,1.0], scaleY [0.85,1.25]), `spawnFadeMs: 260`, `shake: { durationMs: 220, intensity: 0.012 }`, `explosion: { countGreater: 14, countLesser: 10, countExact: 28, lifespanMs: 420, speedMin: 120, speedMax: 380, scaleStart: 0.9, scaleEnd: 0 }`. No existing value changed; no forbidden substring (`phaser`/`document`/`window`) added; `particles.maxConcurrent` reused as cap (not duplicated) | `node --test test/config.test.js` 9/9 (incl. INV-1 purity scan); `node --check src/core/config.js` OK | Complete |
| **T4** — Neon particle texture | implementation | `src/render/neon.js:29` (`TEX_PARTICLE = 'neon-particle'`), `src/render/neon.js:37` (bundled in `TEXTURE_KEYS`), `src/render/neon.js:224–248` (`generateParticle(scene)` — idempotent, 20 px neutral-white glow disc + bright core), wired into `generateTextures` at `src/render/neon.js:269` | `node --check src/render/neon.js` OK | Complete |
| **T5** — GameScene juice wiring | implementation | `src/scenes/GameScene.js` — imports helpers/`TEX_PARTICLE`, stores `dangerLine` field, creates one reusable non-emitting particle emitter from `config.effects.explosion`, drains `model.consumeEvents()` each frame after tick loop and dispatches `explosion`/`rowClear`/`spawn`, sets danger-line `alpha`/`scaleY` from `dangerPulse(snapshot.time, config)` each frame, tags fade-in rows and starts new brick sprites at `alpha=0` tweening to 1 over `spawnFadeMs`, preserves the per-frame `valueToTint` partial-damage tint refresh (INV-7). No model-state mutation. | `node --check src/scenes/GameScene.js` OK; full `node --test` regression 108/108 (Phase 02–03 simulation outcomes unchanged); structural review confirms each effect binds to the correct event | Complete |
| **T6** — Debug stabilization | validation | [`stabilization-report.md`](./stabilization-report.md) — 108/108, four parse checks OK, INV-1 scan green, zero stabilization edits | Full gate re-executed in this review (below) — reproduces the report | Complete |

**Result:** all six tasks complete, none out of scope, no scope creep detected
(no files edited outside T1–T5 outputs).

---

## Implementation Quality Assessment

### `src/render/effects.js` (T1)
- **Purity:** file uses `Math.sin`/`Math.PI` only; no `Phaser` / `window` /
  `document` code reference (grep confirms the sole "Phaser" hit is in a
  comment describing what the file is *not* — and this module lives under
  `src/render/`, so INV-1 does not scope it in any case).
- **Correctness:**
  - `dangerPulse`: `u = (sin(2π·f·t)+1)/2` ∈ [0,1]; `lerp` between endpoints;
    at `t=0`, `sin(0)=0 ⇒ u=0.5 ⇒ mid-band`. Deterministic and periodic with
    period `1/frequencyHz`. Matches spec exactly.
  - `explosionParticleCount`: outcome switch is total (default → 0); clamp is
    `count < 0 ? 0 : count > cap ? cap : count`; `Math.trunc` guarantees an
    integer. Matches R5 budget cap correctly.
- **House convention:** named exports + `default { dangerPulse,
  explosionParticleCount }` bundle. Consistent with `tint.js` / `loop.js`.

### `src/core/config.js` — additive `effects` block (T3)
- Additive only; no existing key was renamed, moved, or re-valued.
- `test/config.test.js` (9 assertions, incl. `values.brickMin=1`,
  `values.brickMax=30`, `particles.maxConcurrent > 0`, tint endpoints, and the
  INV-1 core-purity scan) still passes unchanged.
- The block is pure data — no functions, no tokens matching
  `phaser`/`document`/`window` — so the INV-1 recursive scan across
  `src/core/*.js` remains at zero violations.
- Particle cap is **not** duplicated: `explosionParticleCount` reads
  `config.particles.maxConcurrent` (the pre-existing R5 tunable) rather than
  defining a new one.

### `src/render/neon.js` — `TEX_PARTICLE` + `generateParticle` (T4)
- Idempotent generate-once: `if (scene.textures.exists(TEX_PARTICLE)) return;`
  matches the pattern used by the four existing generators (TDD §7 reuse).
- Neutral-white body only — no `valueToTint` import, no per-outcome colour
  applied here. Preserves the NEON-ART neutrality contract stated in the file
  header at `src/render/neon.js:10–20`; per-instance tinting is the scene's
  job (applied via `setParticleTint` at emit time — see T5 dispatch).
- Wired into `generateTextures` at `src/render/neon.js:269`, so BootScene's
  existing `generateTextures(scene)` call transparently registers the new key.

### `src/scenes/GameScene.js` — juice wiring (T5)
- **Scene remains a thin adapter.** No new game rules introduced. All new
  behaviour is presentation: image field storage, one particle emitter,
  event dispatch (particles/shake/fade), and per-frame pulse.
- **Model contract respected (INV-3).** Every read is via `getState()` or
  `consumeEvents()`. There is no direct access to `this.model.bricks`, no
  in-place mutation of any snapshot object (snapshots are frozen anyway), and
  no substitute time source: the danger-line pulse feeds off `snapshot.time`,
  not `Date.now()` or `time`/`delta` from `Phaser`'s `update` signature.
- **Emitter reuse (R5, TDD §7).** One emitter created in `create()`, tinted
  per burst via `setParticleTint` and fired with `emitter.explode(count, x, y)`.
  Multiple explosions in one drained-event pass reuse the same emitter — no
  per-event allocation. This matches the R5 mitigation the phase plan §9 named.
- **Event dispatch order is correct.**
  1. Advance model (`tick` loop) → pushes events.
  2. `consumeEvents()` drains and dispatches — populates `_fadeRows` **before**
     bricks in the just-spawned row hit `_renderBricks`.
  3. `_render` recreates sprites for newly spawned bricks — the fresh-sprite
     branch reads `_fadeRows.has(brick.row)` and starts the tween.

  This ordering ensures every new brick's first render fades in, and no seeded
  initial-row brick is ever tagged (initial seeding runs in `reset()` and pushes
  no `spawn` events; verified at `src/core/simulation.js:102–109` vs. `181–183`).
- **INV-7 (per-frame partial-damage tint) preserved verbatim.** `_renderBricks`
  still calls `sprite.setTint(valueToTint(brick.value, config))` on every alive
  brick every frame at `src/scenes/GameScene.js:234`. Partial-damage bricks
  continue to re-tint to their current value.
- **INV-8 (screen-shake trigger) satisfied.** `rowClear` event →
  `this.cameras.main.shake(config.effects.shake.durationMs,
  config.effects.shake.intensity)`. Bound to the exact event the model already
  emitted from Phase 03.
- **Frozen-frame safety.** On the game-over frame the tick loop is skipped, but
  `consumeEvents()` runs unconditionally so the final `explosion`/`rowClear`
  the terminating tick pushed still plays. On subsequent frozen frames
  `pendingEvents` stays empty (no tick to push new events), so the drain returns
  `[]` and no effect fires — no leaks, no re-play.

---

## Test Coverage Assessment

- **Unit coverage (headless, T1/T2/T3 domain):**
  - `test/effects.test.js` (9 tests): exports (named + default), mid-band at
    `t=0`, per-frame band bounds across a 3-period 500-step sweep with
    non-negative guards, exact extrema at `t=1/(4f)` and `t=3/(4f)`, periodicity
    at multiples of `1/frequencyHz`, exact per-outcome counts, cap enforcement
    with a cloned inflated config (R5), unknown-outcome burst of 0 for
    `'gameover' | 'spawn' | 'rowClear' | '' | undefined | null`, fractional
    truncation, negative clamp, integer + non-negative + `≤ cap` property.
  - `test/config.test.js` (9 assertions) still passes unchanged, including the
    INV-1 recursive `phaser`/`document`/`window` scan.
  - **Positive / negative / edge cases per T1 test intent are covered.** No
    weakened assertions (no `assert.ok(true)`, no assertions removed to reach
    green); every assertion carries a specific expected value or a value+bound
    pair. The cloned-config pattern isolates the mutation-based tests from the
    shared config object.
- **Regression (Phase 02–03 integration + contract + Phase 04 tint/loop):** 99
  prior tests remain green **unchanged**. Independent re-run:
  `# tests 108 / # pass 108 / # fail 0`. This is the phase's structural proof
  that render-only effects did not alter any simulation outcome or GameModel
  event shape.
- **Deliberate untested surfaces (declared in `13-node-plan.md`):**
  `neon.js:generateParticle` (Phaser Graphics API) and `GameScene.js` (Phaser
  scene + emitter API) cannot be imported under `node:test` — the plan gates
  them by `node --check` parse + whole-suite regression + the manual DoD
  browser walkthrough (CF-01). This is the same pattern Phases 01 and 04 used
  for their scene/texture surface; the concrete new logic (pulse math + budget
  cap) is fully extracted into `effects.js` and unit-tested. **No blind spot:**
  the untested surface is a thin adapter with no rules and no math beyond
  API-glue calls; the closure-relevant math is under test.

**Verdict:** test coverage is adequate for the phase's scope. No weakened
assertions detected. No missing coverage for closure-relevant logic.

---

## Validation Results

Executed independently in this review:

- `node --check src/render/effects.js` → OK
- `node --check src/render/neon.js` → OK
- `node --check src/scenes/GameScene.js` → OK
- `node --check src/core/config.js` → OK
- `node --test` (full suite):
  ```
  # tests 108
  # pass 108
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  ```
  Includes the `INV-1: no src/core/ module references phaser, document, or
  window` assertion (test 9 of `test/config.test.js`) — passes with zero
  violations. Includes the new `test/effects.test.js` (9/9) plus every prior
  Phase 02–03/04 unit + integration + contract test (99/99 unchanged).
- `node --test test/effects.test.js` (isolated) → 9/9.
- Reproduces the debug node's stabilization report exactly (108/108, no
  repairs). No new environment or ordering flake surfaced.

---

## Structural Evaluation

Evaluated against the recorded design in [`../10-tdd.md`](../10-tdd.md) and
the phase plan §9 invariant threats — not personal preference. Findings across
the five structural dimensions:

### 1. Invariant compliance (INV-1..8) — clean
- **INV-1 (core purity):** the additive `config.effects` block is pure data
  (nested objects of numbers only). The `test/config.test.js` recursive scan
  across `src/core/*.js` still finds zero forbidden tokens. `effects.js` lives
  under `src/render/`, outside INV-1's scope, and does not use Phaser/DOM
  anyway (it imports cleanly under plain Node — its 9 tests prove this).
- **INV-2 (seeded RNG in core):** untouched — no core module altered.
- **INV-3 (single model authority):** no scene write ever reaches back into
  the model — the scene only calls `getState()`, `consumeEvents()`, `tick()`,
  and `dropBomb()`, all of which are the model's public surface. Snapshots
  returned from `getState()` are frozen (`Object.freeze` at
  `src/core/simulation.js:305–334`), so even an accidental write would throw
  in strict mode. **No violation.**
- **INV-4/INV-5/INV-6:** untouched — no cooldown/one-bomb/reset logic changed.
- **INV-7 (value in [1,30], tint refresh):** `values.brickMin/brickMax`
  unchanged; the per-frame tint refresh in `_renderBricks` is preserved at
  `src/scenes/GameScene.js:234`. Partial-damage bricks continue to re-tint
  each frame to their current value.
- **INV-8 (screen shake on exact match):** wired correctly — `rowClear` event
  (only emitted by an `exact` outcome in `src/core/simulation.js:281–286`)
  triggers `cameras.main.shake` in `_dispatchEffect`. Correct binding.

### 2. Contract conformance — clean
- Helper signatures match spec: `dangerPulse(t, config) → { alpha, scaleY }`;
  `explosionParticleCount(outcome, config) → integer`.
- Every helper reads only `config.effects.*` and `config.particles.maxConcurrent`
  — no hidden globals, no unstated dependencies.
- `TEX_PARTICLE` key follows the `'neon-*'` naming convention of the other
  four keys; `generateParticle` follows the same `if exists return;` idempotent
  contract as `generateBackground` / `generateBrick` / `generateBomb` /
  `generateDangerLine`.
- `GameModel` public API (`getState`, `consumeEvents`, `tick`, `dropBomb`,
  `reset`) is unchanged; the scene consumes it read-only per the TDD's
  read/write boundary.

### 3. Architectural drift — clean
- No scope creep: the six files touched match the plan's Deliverables (§3)
  and Outputs (§4) exactly. No incidental refactor.
- The pure/impure boundary is respected: **all** new closure-relevant math
  (pulse trig, budget clamp) sits in the Phaser-free helper module; the scene
  remains a thin adapter (imports the helpers, applies their results to Phaser
  primitives). This is the R3 mitigation the phase plan promised.
- No accidental new state on the model — every new field
  (`dangerLine`, `explosionEmitter`, `_fadeRows`) is on the scene.

### 4. Hidden coupling / boundary leakage — clean
- `effects.js` does **not** import anything from the scene, `neon.js`, or any
  Phaser-touching module — it is a pure sink for two config sub-objects.
- `neon.js:generateParticle` emits a neutral-white texture and does not read
  `config.effects` — the tint decision is made at emit time in the scene. The
  particle-emitter tuning (`lifespanMs`, `speedMin/Max`, `scaleStart/End`)
  crosses the boundary once, in `create()`, and only in the direction
  config → Phaser. No back-channel.
- The scene reads `snapshot.time` (an already-exposed field on the frozen
  snapshot) for the pulse — no wall-clock leak into the scene's simulation
  path, no `Date.now()` used for anything except the RNG seed (already an
  accepted Phase 04 pattern).

### 5. Validation blind spots — no closure-relevant blind spot
- Every piece of new logic that could be wrong at the math level (pulse math,
  budget cap, outcome mapping) has a specific-value or property assertion in
  `test/effects.test.js`.
- The Phaser-coupled adapter surface (`neon.js:generateParticle`,
  `GameScene.js:create/update/_dispatchEffect/_renderBricks fade branch`) is
  gated by `node --check` (parse) + whole-suite regression + the deferred
  manual DoD (CF-01) — the same pattern Phases 01 and 04 used and this
  playbook has repeatedly accepted at closure. The remaining surface is
  API-glue only (no branchy logic beyond the event `switch`), so the
  parse-check + regression + manual walkthrough is proportionate.

**Structural verdict:** no blocking finding; three advisory items in §6.

---

## Issues Found

### Blocking
- **None.**

### Non-blocking
- **None.**

### Advisory (not required to remediate)

**A1 — `_fadeRows` set is never pruned during a session.**
- **Location:** `src/scenes/GameScene.js:53, 183`.
- **What was expected:** membership in `_fadeRows` is only meaningful the
  first time a brick sprite from that row is created; after that, the check is
  dead weight.
- **What was found:** entries are added on every `spawn` event and never
  removed, so the set grows monotonically for the session.
- **Why it matters:** cosmetic / performance-neutral. Session length is
  ~30–45 s (per phase plan §7.1 note referring to R2) with
  `spawn.interval = 2.5 s`, i.e. ≤ 18 spawn events per session, so the set
  stays tiny. Row ids are monotonically increasing (`nextRowId`), so a stale
  entry can never mis-fire on a later brick. **Not a defect.** A future
  polish pass could delete the entry after the first sprite of that row is
  created; not worth a remediation loop.

**A2 — direct property assignment mixed with setter style.**
- **Location:** `src/scenes/GameScene.js:149` (`this.dangerLine.scaleY =
  pulse.scaleY;` next to `.setAlpha(pulse.alpha)`).
- **What was expected:** consistent Phaser fluent-setter style.
- **What was found:** direct field assignment for `scaleY`, chained setter for
  alpha. Both are valid Phaser 3 API; the direct assignment avoids `setScale`
  perturbing the X axis. **Not a defect** and arguably the right call to avoid
  touching `scaleX`. Style-only.

**A3 — carry-forward tracker for `event.value = 0` on `exact` outcome.**
- **Location:** `src/scenes/GameScene.js:166–171`; `src/core/simulation.js:280`.
- **What was expected:** an `exact` explosion's tint is chosen deliberately.
- **What was found:** the scene short-circuits to `config.tint.high` (red) for
  `exact` before touching `valueToTint`, so the `event.value = 0` payload never
  reaches the tint helper for an exact hit. If a future phase changes the tint
  policy, the model would need to include the cleared row's value in the
  explosion event (or the scene would need to look at the paired `rowClear`
  event's `clearedValue`). **Not a defect** for Phase 05; noted for continuity.

---

## Regression Proof (Phase 02–03 Outcomes Unchanged)

Phase 05's exit criterion "effects do not alter simulation outcomes — the
Phase 02–03 core tests still pass unchanged (regression)" is confirmed:

- `git log` on `test/*.test.js` shows no test-file modification since Phase 04
  closure (only new file `test/effects.test.js` added).
- Independent `node --test` run in this review: 108/108 pass, comprising 99
  unchanged Phase 02–03 (`collision`, `config`, `difficulty`, `grid`, `rng`,
  `scoring`, `simulation`, `simulation.integration`) + Phase 04
  (`tint`, `loop`) tests plus the 9 new `effects` unit tests.
- The `GameModel` public API and event shape are byte-identical to Phase 03
  closure (the scene only *consumes* the existing `explosion`/`spawn`/`rowClear`
  events; no field was added or removed to the event payloads).

---

## Recommendation

**`accept`.**

All exit criteria in the phase plan §3 are satisfied:

- [x] Implementation tasks T1–T5 complete.
- [x] Required validation commands pass (`node --test` 108/108; `node --check`
      clean on every changed `.js`).
- [x] Each required effect is present and wired to the correct event
      (explosion ← `explosion`; screen shake ← `rowClear`; spawn fade-in ←
      `spawn`; danger-line pulse ← elapsed `state.time`) — structurally
      verified above.
- [x] Effects are event-driven and do not alter simulation outcomes — Phase
      02–03 core tests pass **unchanged**.
- [x] Particle counts are capped per the performance budget (R5) — unit-test
      asserts the clamp to `config.particles.maxConcurrent`.
- [x] Debug stabilization completed ([`stabilization-report.md`](./stabilization-report.md)).
- [x] Review completed with `accept` (this document).
- [x] No invariant violations introduced (INV-1..8 preserved; core-purity
      scan green).
- [x] Carry-forward items CF-01, CF-02, CF-03 explicitly re-evaluated in
      phase plan §10 and each deferral justified.
- [x] No remediation loops opened.

Downstream `resolve` may proceed.

---

## Notes for Resolve

- Phase 06 (game-over overlay + fake `Play` CTA) is the next `delivery_loop`
  target per `phases.md`.
- Carry-forwards to hand off: CF-01 (manual DoD walkthrough — now covers Phase
  05 juice), CF-02 (`Test.txt` cleanup), CF-03 (`src/main.js` scale-token
  debug warning). None was brought into Phase 05 scope; all remain open with
  the same rationale.
- Advisory items A1–A3 above are **not** carry-forward candidates — each is
  polish-only with no observed impact on this phase's exit criteria.
- No ADR emitted: no material architectural decision was reached in this phase
  or in this review (the effects layer follows the pure-helper / thin-adapter
  pattern already established in Phase 04; the R5 budget cap was a design
  decision already recorded in the TDD/risk register). No new
  boundary/contract/dependency choice worth durably recording.
