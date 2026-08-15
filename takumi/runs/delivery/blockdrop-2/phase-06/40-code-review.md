# Code Review Report: Phase 06 — Game-Over Screen & Restart CTA

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 06
- Node: Phase Review (`ef905191-7ede-4829-8c38-360804c7f7fb`)
- Lane / Stage: `lane:review` / `stage:review`
- Scope of report: Phase 06 diff (`60ecc24` → `HEAD`); code review dimensions
  are code quality, architecture compliance, security, and performance.
- Date: 2026-08-15
- Overall verdict: **CLEAN — no blocking findings; no fixes required.**

---

## 1. Scope Reviewed

Source and test files changed this phase:

- `src/core/config.js` (additive `gameOver.screen` sub-block)
- `src/render/gameOverLayout.js` (new — pure)
- `src/scenes/GameOverScene.js` (new — Phaser scene)
- `src/scenes/GameScene.js` (game-over transition + clean-restart re-init)
- `src/main.js` (register `GameOverScene`; add CF-03 debug-gated warn)
- `test/gameOverLayout.test.js` (new — 8 tests)
- `test/restart.integration.test.js` (new — 3 tests)
- `Test.txt` (removed — CF-02)

No cross-cutting refactor; no file outside the plan's declared surface.

---

## 2. Code Quality Findings

### 2.1 `src/render/gameOverLayout.js`

- **Structure.** Small (~70 lines), single-purpose module with a named + default
  export bundle, matching the render-layer helper convention already used in
  `tint.js` / `effects.js`.
- **Naming.** `TITLE_Y_FRAC` / `SCORE_Y_FRAC` / `CTA_Y_FRAC` local constants
  are self-documenting; the `title.y < score.y < cta.y` ordering they encode is
  also enforced by a test — invariant + assertion travel together.
- **Purity.** Zero imports; zero I/O; zero use of `Phaser`/`window`/`document`.
  Deterministic — same config in yields deep-equal output. `assert.deepEqual`
  test proves it.
- **Robustness.** All returned values are `Number.isFinite` (asserted); a
  cloned-config test proves re-centring under alternate dimensions.
- **No dead code, no TODOs, no `console.*` calls.**

**Finding: none.** This is textbook pure-helper code.

### 2.2 `src/scenes/GameOverScene.js`

- **Structure.** Single scene class; all wiring in `create()`; a shared
  `layout` object is computed once and reused for all four elements.
- **Presentation-only guarantee.** No import of `simulation`/`grid`/`rng`; no
  `GameModel` construction; no state mutation outside local scene fields. The
  file's opening docstring makes the INV-3 constraint explicit for the reader.
- **NaN defence.** `init(data)` uses
  `Number.isFinite(data.score) ? data.score : 0`, so a missing/non-finite score
  is displayed as `SCORE 0` rather than `SCORE NaN`. Also handles the `data`
  argument being `undefined`.
- **Tween handling.** One tween on the overlay (target alpha =
  `screen.overlayAlpha`) and one on the batch `[title, score, ctaRect, ctaLabel]`
  (target alpha = `1`). Both use the same `screen.fadeMs` duration. Batching
  is efficient and keeps the fade synchronized.
- **Interactivity.** `ctaRect.setInteractive(); ctaRect.on('pointerdown', …)` —
  minimal, idiomatic Phaser input wiring; only the CTA rectangle is
  interactive, not the whole scene. Restart is
  `this.scene.stop(); this.scene.start('GameScene');` — the correct pattern
  for re-running `GameScene.create()` and constructing a fresh `GameModel`.
- **No emojis, no `console.*`, no external navigation** — respects the fake-CTA
  contract (PRD §3).

**Finding: none.**

### 2.3 `src/scenes/GameScene.js` (Phase 06 diff)

The Phase 06 delta is small and surgical (~27 lines added, verified via
`git diff 60ecc24 HEAD -- src/scenes/GameScene.js`):

- **`create()` clean-restart re-init.** Re-initialises `brickSprites`,
  `bombSprite`, `_fadeRows`, and `_gameOverHandled`. The comment explains
  *why* the re-init is in `create()` (Phaser reuses the scene instance on
  restart and does NOT re-run the constructor) — this is exactly the class of
  non-obvious "why" comment that belongs in the code. Without it, a future
  reader would ask "why duplicate the constructor?" and possibly delete the
  block.
- **`update()` game-over transition.** Runs *after* the tick loop, the event
  drain (`consumeEvents()`), and the frame render — so the final tick's
  explosion/row-clear/shake still play this frame beneath the overlay. Guarded
  by `_gameOverHandled` to fire exactly once, not on every frozen frame. Uses
  `scene.launch` (not `scene.start`) to keep the frozen final frame visible
  under the fading overlay. All three of these choices are non-obvious and are
  each documented in the accompanying comment.
- **`INV-3 preserved.** Only reads `snapshot.status`/`snapshot.score`; no
  writes to the model.

**Finding: none blocking.** One structural observation from §6.5 of `30-review.md`:
`_gameOverHandled` defaults to `undefined` in the constructor (only `create()`
sets it). In practice this is harmless because Phaser guarantees `create()`
runs before `update()`. Not a blocking finding.

### 2.4 `src/main.js`

- **CF-03 implementation.** `resolveScaleToken(map, token, fallback, label)`
  replaces the inline `map[token] ?? fallback` with an early debug-gated
  `console.warn` when `map[token]` is `undefined`, then falls through to the
  existing `??` fallback. The fallback behaviour is byte-for-byte preserved
  (still `Phaser.Scale.FIT` / `Phaser.Scale.CENTER_BOTH`), so a token that
  worked before still resolves to the same enum now.
- **`config.debug` gating.** `config.debug` is `false` in the shipped
  `src/core/config.js`, so the warning is silent by default; it exists only for
  developer observability (matches the CF-03 disposition in the phase plan).
- **Scene registration.** `scene: [BootScene, GameScene, GameOverScene]` — the
  order matches the plan (BootScene → GameScene → GameOverScene). No other
  change to `main.js`.

**Finding: none.**

### 2.5 `src/core/config.js`

- Purely additive — a `screen` sub-block inside the existing `gameOver` key.
  Every existing tunable (including `gameOver.topY`) is untouched.
- All new values are plain data: numbers, hex integers, string literals. No
  logic, no computed key. Nested keys mirror the plan's schema.
- No forbidden token introduced (INV-1 scan re-run: **9/9 pass** including
  `ok 9 - INV-1: no src/core/ module references phaser, document, or window`).

**Finding: none.**

### 2.6 `test/gameOverLayout.test.js` and `test/restart.integration.test.js`

- **Assertions are meaningful.** Every check either compares to a computed
  expected value (`layout.title.x === width/2`) or asserts an invariant
  (`title.y < score.y`), never a bare truthy/existence check that would let a
  broken helper slip through.
- **Preconditions are guarded.** The integration test's
  `driveToGameOver` helper has a hard `maxSteps = 60 * 120` cap and
  `assert.equal(model.getState().status, 'gameover', …)` before returning —
  a broken drive-to-game-over cannot silently pass by returning a still-playing
  model.
- **DRY via shared helpers.** `assertCanonicalInitialState` is factored so the
  re-construction and reset paths cannot drift on what "canonical initial
  state" means; `numericLeaves` recursively collects numeric values for the
  finiteness check without inflating the assertion count.
- **Different-seed reconstruction.** The integration test explicitly uses a
  different seed for the reconstructed model (`createRng(99999)`) so the assertion
  suite proves *structural* equivalence, not value equivalence — closing the
  hole the plan calls out (a same-seed test would trivially pass).
- **No test skips, no `.only`, no fixture leakage between tests.**

**Finding: none.**

---

## 3. Architecture Compliance

- **Layering respected.** Render code depends on core (`config`, `simulation`
  via `getState()`), never the other way round. `GameOverScene` sits *above*
  the model — it never constructs or mutates one.
- **Restart mechanism aligns with the accepted TDD.** Restart is by
  re-construction of `GameModel` inside `GameScene.create()` — the mechanism
  TDD §4.3 documents and the mechanism the new integration test proves
  correct.
- **No scope creep.** No new abstraction, no cross-cutting refactor, no
  attempt to "clean up" prior code. The diff is bounded exactly to Phase 06's
  Task Inventory.
- **`neon.js` untouched.** The plan explicitly requires the CTA to be drawn
  with Phaser primitives (no new baked texture); the scene honours that with
  `this.add.rectangle(...)` + a centred label.
- **Documented "why" comments in the non-obvious spots.** The `create()`
  re-init, the `launch` vs `start` choice, and the once-only guard each carry
  a comment explaining the non-obvious invariant they enforce — matching the
  house rule "only add a comment when the WHY is non-obvious".

---

## 4. Security Considerations

The Phase 06 diff introduces:

- No new network I/O.
- No dynamic code execution (`eval`, `Function`, `setTimeout(string)`,
  `innerHTML`).
- No file-system access outside `Test.txt` removal via `git rm -f`.
- No user-input parsing beyond a `pointerdown` event that triggers a scene
  restart. No text field, no serialisation, no cross-origin traffic.
- No secret handling, no credentials, no auth surface.
- The only string interpolation into rendered text is
  `${screen.score.prefix}${this.finalScore}`, where `finalScore` is a
  `Number.isFinite`-guarded number (defaulted to `0` on missing/non-finite)
  and `prefix` comes from static config data. No injection risk in a Phaser
  text object (it's not HTML).
- `console.warn` in `main.js` uses a template literal into the console, not
  the DOM; the `token` value comes from `config.scale.*` (developer-supplied
  literal) and is not user-controllable at runtime.

**Finding: none.** No security posture change from Phase 06.

---

## 5. Performance Observations

- **Deterministic hot path.** `gameOverLayout(config)` is pure and O(1). It's
  called once per `create()` (i.e. once per game-over presentation, once per
  restart), not per frame.
- **No allocation in `update()`'s new branch.** The game-over check is a
  single boolean read and, on the transition frame only, one `scene.launch`
  call. The `_gameOverHandled` guard ensures the launch never re-fires on the
  frozen post-game-over frames, so subsequent frames pay zero cost.
- **Tween count.** Two `tweens.add` calls (one for the overlay, one batched
  for `[title, score, ctaRect, ctaLabel]`). Cheap; Phaser reuses the same
  tween manager, and both auto-clean on completion.
- **Restart cost.** `scene.stop(); scene.start('GameScene')` triggers Phaser's
  full teardown of the current scene's display list before rebuilding.
  Existing brick/bomb sprites from the prior session are destroyed by Phaser
  during scene shutdown; the clean-restart re-init in `create()` then drops
  the (now-invalid) references and rebuilds. This is the standard pattern and
  is O(number of sprites in the prior session) — bounded by the brick grid.
- **Particle budget preserved.** No change to `config.particles.maxConcurrent`
  or to the `explosionEmitter` reuse. Phase 05's R5 backpressure remains
  intact.
- **Regression proof.** The full `node --test` suite runs in ~740 ms on this
  box (`# duration_ms 736.955562`), no worse than pre-Phase-06.

**Finding: none.** No hot-path regression, no unbounded allocation.

---

## 6. Advisory Notes (non-blocking)

Recorded for tidiness only; none of these justifies a `remediation_loop`
(which costs three additional agent runs plus full revalidation).

- `GameScene` constructor does not initialise `_gameOverHandled`. In every
  real Phaser invocation `create()` runs before `update()` and initialises it
  to `false`; behaviour is correct. Adding `this._gameOverHandled = false;`
  next to the other constructor defaults would make the field's default
  visible next to its siblings, but is not necessary for correctness.
- The overlay `rectangle(...)` in `GameOverScene.create()` is currently kept
  as a local `overlay` variable and included in the tween-batch (implicitly
  via a separate tween call). It is not stored on `this`; if a future phase
  needs to fade it back out or animate it further, it would need to be
  re-fetched. This is fine for the current single-fade-in requirement.

---

## 7. Summary Verdict

- **Correctness:** clean — every task's contract is met and validated.
- **Structural integrity:** clean — all five review dimensions pass.
- **Security posture:** unchanged.
- **Performance:** no regression; hot-path costs are O(1) per frame.
- **Test coverage:** strong — assertions target the contract, not the
  implementation; both restart mechanisms are asserted through a shared
  helper.
- **Scope discipline:** perfect — the diff matches the phase plan's declared
  surface exactly; no prior test file edited.

**No blocking or non-blocking findings. Two advisory notes (§6) recorded
for tidiness.** The phase is code-review clean and safe to close.
