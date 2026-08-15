# Phase 04 — Code Review Report (Rendering & Input Binding)

**Node:** `ef323933-2bed-4059-a7d1-ef4c953d7ce5` (Phase Review)
**Scope of review:** files newly created or edited in Phase 04 —
`src/render/tint.js`, `src/render/loop.js`, `src/render/neon.js`,
`src/scenes/BootScene.js`, `src/scenes/GameScene.js`,
`src/core/config.js` (additive `loop` block only),
`test/tint.test.js`, `test/loop.test.js`.
**Verdict:** **no blocking findings.** Two advisory-only observations; both explicitly aligned with the phase's declared scope boundary.

---

## 1. Code Quality Findings

### 1.1 `src/render/tint.js` — Pure value→tint mapping (T1)
- **Purity confirmed.** Imports nothing; uses only its arguments and `Math.round`. Zero side effects.
- **Clarity.** Compact function; the `channels(color)` helper extracts the packed-int decomposition into a self-descriptive helper. Endpoint fidelity is proven by construction (`t = 0` reproduces `low.r/g/b`, `t = 1` reproduces `high.r/g/b`).
- **Robustness.** Out-of-range clamp handles both sides; `min === max` degenerate range guarded (`t = 0`).
- **API shape.** Named export `valueToTint` + `default { valueToTint }` — matches the plan's house-convention.
- **No dead code, no unused parameters, no shadowed identifiers.**
- **Nit-only:** the ternary-chain clamp (`value < min ? min : value > max ? max : value`) is idiomatic JS and reads clearly; would not be improved by extraction.

### 1.2 `src/render/loop.js` — Fixed-timestep splitter (T3)
- **Purity confirmed.** No imports; three-branch return; no state.
- **Correctness by construction.** `n = ceil(dt/maxStep)` ⇒ `dt/n ≤ maxStep`; `n` copies of `dt/n` sum to `dt` (float-exact for the pattern used).
- **Edge cases covered in the code itself.** Non-positive `dt` and `dt ≤ maxStep` are handled before the split, so `Array(n).fill(step)` cannot be entered with `n = 0`.
- **API shape.** Named export + default matches convention.
- **No dead code.**

### 1.3 `src/render/neon.js` — Procedural texture factory (T5)
- **Idempotence.** Each `generate*` function early-returns on `scene.textures.exists(KEY)`. `generateTextures(scene)` composes them, so a scene restart is a cheap no-op (TDD §7 reuse).
- **Neutral base art.** `WHITE = 0xffffff` used for brick, bomb, and danger-line bodies — the seam that lets NEON-ART and RENDER-CORE build independently and lets the scene tint per-instance without importing the mapping. The independence contract in `13-node-plan.md` §2 is honoured.
- **Off-display Graphics.** `scene.make.graphics({ add: false })` is the correct Phaser pattern for texture generation (avoids polluting the display list); each scratch graphics is `destroy()`d after `generateTexture`.
- **Colour discipline.** Only the *static* background uses `config.tint.low` (as a decorative bloom accent). The three per-instance-tintable textures (brick/bomb/danger line) are strict white — no colour leak that would multiply with a subsequent `setTint`.
- **Public contract.** `TEX_BACKGROUND`, `TEX_BRICK`, `TEX_BOMB`, `TEX_DANGER_LINE` exported individually and as `TEXTURE_KEYS`. No string-literal keys required by consumers.
- **No `document`/`window` reference.** `Phaser` global is used via `scene.*` accessors, keeping the module render-layer-scoped.
- **Nit-only:** `strokeGlowRect` uses a linear stack of five strokes to approximate a glow. Not a defect — an intentional cheap alternative to a shader per TDD §7 backpressure guidance.

### 1.4 `src/scenes/BootScene.js` — Boot wiring (T5)
- **Minimal.** Single-purpose `create()`: `generateTextures(this)` then `this.scene.start('GameScene')`. No side effects, no timers, no async.
- **Ordering** is correct: textures registered before the play scene starts, so `GameScene.create()` can assume they exist in the manager.

### 1.5 `src/scenes/GameScene.js` — Model↔Phaser binding (T6)
- **Thin adapter.** No game rules; only construction, snapshot reads, input forwarding, and sprite reconciliation. The plan's "thin" requirement is honoured.
- **INV-3 preservation.** The scene never mutates model state. Reads flow through `this.model.getState()`, whose returned objects are `Object.freeze`d by `simulation.js:305–334`. The only writes are `model.dropBomb(x)` and `model.tick(step)`.
- **Reconciliation pattern.** Bricks: keyed `Map<id, sprite>` + `seen` set; create-on-demand, `setPosition`/`setTint` for existing, `destroy` + `delete` for absent. Bomb: single sprite, `setVisible(false)` when null, `setVisible(true)` + reposition/retint when active. This matches the plan's "reconcile, don't recreate" rule and the TDD §7 caching guidance.
- **Fixed-timestep loop.** `dt = delta / 1000; for (const step of fixedSteps(dt, config.loop.maxStepSeconds)) this.model.tick(step);` — CF-04 preserved.
- **Game-over freeze.** `update` skips `tick` and `pointerdown` short-circuits on `state.status === 'gameover'`. Final frame is still rendered so a resize doesn't blank the screen. Overlay + CTA correctly deferred to Phase 06.
- **Input.** `pointer.worldX` is forwarded to `model.dropBomb` unchanged. Under `Scale.FIT + CENTER_BOTH`, `worldX` is in the 720×1280 game space (documented Phaser behaviour). The model handles column snap + cooldown (INV-5).
- **Seed** is `Date.now()`, explicitly permitted in the render layer (INV-2 scopes only `src/core/`) and consistent with the plan's session-variety intent.
- **Sprite depth.** Score text is `setDepth(10)` and the bomb is `setDepth(5)` — legible layering above the background/bricks.
- **No juice.** `consumeEvents()` is not called; no particle emitter, no shake, no fade. Consistent with Phase 04 out-of-scope.

### 1.6 `src/core/config.js` — Additive `loop` block only
- **Additive-only.** New `loop: { maxStepSeconds: 0.05 }` block inserted between `spawn` and `bomb`. No existing key modified, no Phase 01–03 asserted value touched (confirmed: `test/config.test.js` still green).
- **Value justification.** Inline comment explains `bomb.fallSpeed(900) * 0.05 = 45 < grid.rowHeight(120)` — the CF-04 travel-vs-row-height guarantee. The rationale sits next to the constant, aiding future re-tuning.

### 1.7 `test/tint.test.js` & `test/loop.test.js`
- **Specific-value assertions** (no truthiness).
- **Real config imported** — a wrong endpoint or a weakened `maxStepSeconds`/`fallSpeed`/`rowHeight` relationship breaks the tests.
- **Meaningful failure output** — `assert.ok` calls carry human-readable messages that surface the actual values.
- **No skipped tests, no `.only`, no `xtest`.**
- **CF-04 pinned twice** — once by the inequality assertion (`travelPerTick < rowHeight`) and once by the numeric pin (`travelPerTick === 45`), so both the relationship and the first-pass number are locked.

---

## 2. Architecture Compliance

- **Layering** (TDD §4.1): every new file sits in the correct layer.
  - `src/core/*` — pure data only (additive `config.loop`).
  - `src/render/tint.js`, `src/render/loop.js` — pure ES modules, Phaser/DOM-free (they live under `src/render/` for module-locality but are import-clean under plain Node).
  - `src/render/neon.js` — Phaser-coupled render-layer factory.
  - `src/scenes/*` — Phaser scenes.
- **INV-1 preserved.** Grep over `src/core/` for `phaser|document|window` is empty; the `test/config.test.js` scan subtest is green.
- **Contract stability** (TDD §4.3): `GameModel` public API/event shape untouched. Scene consumes only the documented `getState()` shape (`bricks[]`, `bomb`, `score`, `status`) — no undocumented field reads.
- **Independence seam** (`13-node-plan.md` §Decomposition Rationale): `neon.js` does not import `tint.js`, so `RENDER-CORE` and `NEON-ART` truly built in parallel without an incidental dependency.
- **Generate-once / reuse** (TDD §7): all four texture generators are idempotent and gated by `textures.exists`; brick sprites are reconciled, not recreated per frame.

---

## 3. Security Considerations

- **No new attack surface.**
  - No `eval`, no `Function`, no dynamic import, no `innerHTML`, no `document.write`.
  - No network calls, no `fetch`, no `XMLHttpRequest`.
  - No `localStorage`/`sessionStorage` reads or writes (consistent with PRD "no persistence").
  - No cross-origin references; all art is procedurally generated.
- **Seed handling.** `Date.now()` used only as a scene-local RNG seed for session variety — not for security decisions. Cryptographic randomness is neither required nor claimed.
- **Input.** `pointer.worldX` is a Phaser-provided numeric coordinate, passed to `model.dropBomb`, which clamps to `[0, columns-1]` (`simulation.js:145`). No unbounded index write.

Consistent with TDD §6 (no auth boundary, no data collection, no remote exchange).

---

## 4. Performance Observations

- **Per-frame cost is bounded.** `update` performs one `getState()` snapshot (which allocates frozen wrappers, but for O(N) bricks — plan §3 hot path), one `fixedSteps` call (allocates one array of up to ~1 sub-step in the common 16 ms case), and one reconciliation pass. No hidden N² work.
- **Snapshot allocation.** `simulation.js:getState()` builds a fresh `Object.freeze({...})` per brick per frame. At the plan's expected scale (tens of bricks) this is negligible; if the brick count grew significantly, the snapshot cost becomes a natural first optimisation target — but this is a *core* concern, not a Phase 04 defect, and is outside this phase's scope.
- **Texture generation.** All four textures are generated at boot once; `generate*` early-return on repeat calls. No per-frame `Graphics` redraws in either the factory or the scene (TDD §7 caching).
- **Sprite pooling.** Bomb sprite is reused (visibility toggled). Bricks use a keyed `Map` reconciliation — a natural pool that avoids per-frame `add.image` churn for live bricks. Dead bricks' sprites are `destroy`ed to release Phaser GameObject slots.
- **Sub-step count is small.** With `maxStepSeconds = 0.05` (50 ms) and a target 60 fps frame delta (~16.7 ms), the typical `fixedSteps` output is a single sub-step. Only tab-defocus catch-up spikes drive N > 1, and even a 500 ms spike caps at 10 sub-steps.
- **Score text.** `setText(...)` every frame is inexpensive for a short static string (`SCORE nnnnn`) at Phaser's text-glyph-cache costs — no bitmap re-render on each call. Acceptable for Phase 04; Phase 05 may swap to a bitmap font.

**No performance blockers.** Meets TDD §7 targets for Phase 04.

---

## 5. Advisory Observations (Non-Blocking)

Neither observation warrants a remediation loop (the loop's cost — three additional agent runs + full revalidation — clears only for blocking, in-scope defects).

- **ADV-1: Unbounded `pendingEvents` growth over a session.**
  Phase 04 correctly does not drain `model.consumeEvents()` because juice is Phase 05 scope. As a consequence, `simulation.js` pushes into `pendingEvents` on every spawn/collision/gameover without a consumer. In a 30–45 s session with a spawn every 2.5 s and a handful of taps, the queue stays in the tens of entries — negligible memory. Phase 05 will drain it as designed. **Recorded, no action.**

- **ADV-2: Redundant `gameover` guard on `pointerdown`.**
  The scene checks `state.status === 'gameover'` in the pointer handler before calling `model.dropBomb`, but `dropBomb` itself already returns `false` when `status !== 'playing'` (`simulation.js:141`). The extra guard is belt-and-suspenders and is consistent with the plan wording (*"stop accepting input"*). No behavioural difference. **Recorded, no action.**

---

## 6. Compliance Summary

| Dimension | Verdict |
|---|---|
| Invariant compliance (INV-1..8) | ✅ preserved (scan + inspection) |
| Contract conformance (GameModel API) | ✅ unchanged |
| Architectural drift | ✅ none |
| Hidden coupling / boundary leakage | ✅ none (RENDER-CORE ↔ NEON-ART seam clean) |
| Validation blind spots | ✅ none beyond the plan-recognized Phaser-parse-only boundary |
| Security | ✅ no new surface |
| Performance | ✅ within Phase 04 targets |
| Scope discipline | ✅ no scope creep; no out-of-scope files touched |
| Test rigour | ✅ specific-value assertions, real config, CF-04 pinned |

**Outcome.** No blocking findings. Two advisory-only observations recorded above for the record — neither meets the loop's cost bar. Aligned with the `30-review.md` `accept` recommendation.
