# Phase 05 — Code Review Report

**Node:** review (Phase 05 closure gate)
**Scope:** the four files touched by Phase 05 build nodes T1–T5:
- `src/render/effects.js` (new — pure helpers)
- `test/effects.test.js` (new — helper unit tests)
- `src/core/config.js` (additive `effects` block, lines 122–157)
- `src/render/neon.js` (new `TEX_PARTICLE` key + `generateParticle` at lines 29, 37, 224–248, wired at 269)
- `src/scenes/GameScene.js` (event-driven juice wiring)

**Companion review:** [`30-review.md`](./30-review.md).

Findings are graded per the phase's structural rubric (invariants, contracts,
drift, coupling, blind spots) plus code-hygiene concerns. Only **blocking**
findings drive `changes_requested`.

---

## 1. Code Quality Findings

### Blocking
- **None.**

### Non-blocking
- **None.**

### Advisory (polish-only, not required to remediate)

1. **`_fadeRows` never pruned during a session.**
   *File:* `src/scenes/GameScene.js:53, 183`.
   *Detail:* `_fadeRows.add(event.row)` is called on every `spawn` event and no
   entry is ever removed. Session length is bounded (~30–45 s, ≤ 18 spawn
   events; row ids are monotonic), so a stale entry can never re-tag a later
   brick. No functional or measurable performance impact. If Phase 06 or later
   grows session length materially, the entry could be dropped after
   `_renderBricks` first tweens a brick from that row. Not worth a remediation
   loop.

2. **`this.dangerLine.scaleY = pulse.scaleY;` mixes direct assignment with
   chained setters** (`.setAlpha(pulse.alpha)` on the previous line).
   *File:* `src/scenes/GameScene.js:148–149`.
   *Detail:* both are valid Phaser 3 API; direct assignment is deliberate here
   because `setScale(x, y)` would also touch `scaleX`. The direct assignment is
   arguably the right call. Style-only.

3. **`event.value` for the `exact` outcome is `0` in the model but is never
   passed to `valueToTint` in the scene** (the scene short-circuits to
   `config.tint.high`).
   *Files:* `src/scenes/GameScene.js:166–171`, `src/core/simulation.js:280`.
   *Detail:* the current behaviour is correct for Phase 05's exact-row-clear
   red flash intent. Noted as a continuity marker: if a later phase wants an
   exact burst tinted by the cleared row value, the scene can consult the
   paired `rowClear` event's `clearedValue` (already on the event payload) or
   the model can start populating `event.value` on the `exact` explosion.

---

## 2. Architecture Compliance

- **INV-1 (core purity — no Phaser/DOM/window in `src/core/`):** the additive
  `config.effects` block is pure data. `test/config.test.js`'s recursive
  `phaser`/`document`/`window` scan across `src/core/*.js` still returns zero
  violations (independently re-run this review). ✅
- **INV-2 (seeded RNG in core):** untouched. ✅
- **INV-3 (single model authority for state mutation):** GameScene reads state
  exclusively via `model.getState()` and `model.consumeEvents()`; the returned
  snapshots are frozen at `src/core/simulation.js:305–334`, so any accidental
  write would throw. Scene mutations (`sprite.setAlpha`, `emitter.explode`,
  `dangerLine.scaleY`, `_fadeRows.add`, `this.tweens.add`) target Phaser
  objects and scene fields only, never model state. ✅
- **INV-4/INV-5/INV-6:** cooldown / one-bomb / reset logic unchanged. ✅
- **INV-7 (value in [1,30], per-frame tint refresh):** `_renderBricks` still
  calls `sprite.setTint(valueToTint(brick.value, config))` on every alive
  brick every frame at `src/scenes/GameScene.js:234`. Partial-damage bricks
  re-tint correctly. ✅
- **INV-8 (screen-shake on exact-match row clear):** `rowClear` is only
  emitted by an `exact` outcome (`src/core/simulation.js:281–286`) and is now
  handled by `cameras.main.shake` at `src/scenes/GameScene.js:174–178`. Correct
  binding of the model event to the render effect. ✅
- **TDD §7 (generate-once/reuse; single reusable emitter, R5):** the particle
  texture is generated once via the idempotent `if
  (scene.textures.exists(TEX_PARTICLE)) return;` guard at
  `src/render/neon.js:225`; the particle **emitter** is constructed once in
  `create()` and reused via `explode(count, x, y)` (no per-event allocation).
  Multiple explosions in a single drained-events pass reuse the same emitter.
  ✅

### Neutrality contract

`src/render/neon.js:224–248` (`generateParticle`) emits a neutral-white sprite
and does not import or apply `valueToTint`; per-instance colour is applied by
the scene via `setParticleTint` at emit time. This preserves the NEON-ART
independence contract stated in the file header at
`src/render/neon.js:10–20`. ✅

---

## 3. Security Considerations

Front-end procedurally-generated art with no user input path other than a
pointer's X coordinate (already validated by the model's column clamp).

- **No new I/O, no new network, no new deserialization.** The additive config
  block is inert JS data; no file reads/writes were introduced.
- **No dynamic code paths.** No `eval`, `new Function`, dynamic `import()`, or
  string-templated identifier construction was added.
- **No third-party dependency added.** `package.json` was not modified.
- **RNG use unchanged.** The scene still seeds a `createRng(Date.now())` in
  `create()` — this is the accepted Phase 04 pattern and does not affect
  security posture (single-player local playable).
- **Input handling unchanged.** The `pointerdown` handler is byte-identical to
  the pre-Phase-05 version.

No security concerns.

---

## 4. Performance Observations

### On the plan's own R5 budget
- The particle-burst count for every `explosion` event is clamped to
  `config.particles.maxConcurrent = 120` inside `explosionParticleCount`
  before it is passed to `emitter.explode`. Even a bomb-cascade frame that
  drains, e.g., three explosions cannot exceed `3 × cap = 360` particles
  in flight for the emitter's `lifespanMs = 420` window — well within the
  budget the plan sized this cap for. Configured per-outcome counts (10 / 14
  / 28) are far below the cap, so the clamp is a defensive safety net rather
  than a routine trim in normal play.
- One particle emitter is constructed at `create()` and reused for every
  burst — no per-event object allocation on the hot path. The scale tween
  (`scale: { start: 0.9, end: 0 }`) is emitter-owned and does not spawn a new
  tween per particle.
- Brick spawn tweens: at most one tween per newly created brick sprite over
  `spawnFadeMs = 260 ms`. With `spawn.interval = 2.5 s` and `columns = 6`,
  peak concurrent spawn tweens is bounded at 6, then decays as each finishes.
  No leak: Phaser removes finished tweens automatically.

### On the render hot path
- `update()` calls `getState()` twice per frame (once before the tick loop for
  the freeze check, once after for the pulse + reconcile). Each returns a
  frozen snapshot with mapped-and-frozen brick objects. This is an unchanged
  Phase 04 cost and is not a regression.
- `dangerPulse(snapshot.time, config)` is `O(1)` — one `Math.sin` + a small
  handful of arithmetic ops per frame. Negligible.
- `consumeEvents()` drains a small array (typically empty or 1–2 events per
  frame). Iteration is `O(k)` where `k` is the drained-event count. Fine.
- `_renderBricks` reconciliation is `O(n)` in the alive-brick count and
  short-circuits with `if (!brick.alive) continue;` — no change from Phase 04.

No performance concerns raised by this phase.

---

## 5. Test Design Observations

- `test/effects.test.js` uses specific-value assertions (`assert.equal`,
  `assert.ok(diff < 1e-9)`) rather than tautologies; each test names the
  property under test in its assertion messages.
- The mutation-based tests (cap enforcement, fractional truncation, negative
  clamp) clone the config with `JSON.parse(JSON.stringify(config))` so the
  real config object is not perturbed for later tests in the file.
- The band-bounds sweep covers three full periods at 500 steps, which crosses
  each extremum ~6 times per axis — enough resolution to catch a lerp
  sign error or an off-by-one endpoint bug. The dedicated "reaches both band
  extremes" test asserts the exact endpoint values at `t = 1/(4f)` and
  `t = 3/(4f)`, guarding against a monotonic-only mapping that never hits the
  bounds.
- The unknown-outcome test iterates over `['gameover', 'spawn', 'rowClear',
  '', undefined, null]` — this covers both other event types (`gameover`,
  `spawn`, `rowClear`) and JS falsy edge cases, closing the switch's `default`
  branch.
- No coverage of the Phaser adapter surface (`GameScene.js` /
  `neon.js:generateParticle`) — deliberately deferred to the manual DoD
  walkthrough (CF-01), matching the pattern used by Phases 01 and 04 and
  documented in `13-node-plan.md` §1 and §3. Not a blind spot: the closure-
  relevant math is fully headless-tested; the untested surface is API-glue
  only.

---

## 6. Summary

- **Blocking findings:** 0.
- **Non-blocking findings:** 0.
- **Advisory findings:** 3 (all polish; none warrants remediation).
- **Recommendation:** `accept` (see [`30-review.md`](./30-review.md) for the
  formal closure decision).
