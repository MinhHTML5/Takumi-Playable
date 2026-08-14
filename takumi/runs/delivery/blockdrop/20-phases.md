# Phases: Number Bomb Brick Breaker (blockdrop)

## 0. Metadata

- Feature Slug: blockdrop
- Related TDD: `./10-tdd.md`
- Status: Draft
- Last Updated: 2026-08-14

---

## 1. Phase Roadmap (High Level)

Sequencing follows the Decomposition Principle: each phase is the smallest slice that is
independently validatable and leaves the system coherent. The three phases split along real seams —
(1) pure logic validatable by unit tests with no browser, (2) the Phaser rendering/input shell that
makes it playable, (3) the feel/juice layer validated by effect-hook tests plus a pacing check. Each
depends on the prior only through concrete outputs it consumes.

### Phase 1: Foundation & Core Rules Engine
- **Goal:** Establish the self-contained project and the complete, framework-independent game-logic
  core so every PRD number rule is provable by unit tests without a browser.
- **Scope:** Project scaffold (Vite + TypeScript + Vitest, npm scripts `dev`/`build`/`test`, Phaser
  installed with a minimal boot that compiles); `src/core/**` — `types`, `config`, seeded `rng`,
  `rules` collision/number resolver, `board` (grid + smooth rise + top-line loss detection + row
  removal), `spawner` (upward-trending distribution), `difficulty` curve, `scoring`, `BestScoreStore`
  (session + localStorage impls), and the `GameEngine` orchestrator (`step`, `dropBomb`, `reset`,
  event stream). No rendering behavior beyond a boot that compiles.
- **Repos touched:** Takumi-Playable.
- **Exit Criteria:**
  - [ ] `npm run build` (or `tsc`) compiles with no errors; project runs `npm test`.
  - [ ] `unit` tests cover all I2/I3 number rules incl. edge cases (multi-brick pass-through, bomb
        reaching exactly 0, `<` damage, `==` row clear across a full spawn row).
  - [ ] `unit` tests cover loss detection (I6), single-bomb/cooldown gating (I4), determinism under a
        fixed seed (I7), best-score behavior + storage fallback (I8).
  - [ ] `unit`/statistical test shows brick-value mean is non-decreasing over elapsed time (I5).
  - [ ] No module under `src/core/**` imports `phaser` (I1) — enforced by a test/grep check.
- **Key Risks / Notes:** Correctness of the sequential collision resolver is the highest-risk unit;
  define row semantics as spawn-wave rows. Randomness must be injected, never global.

### Phase 2: Playable Rendering & Input (Phaser Integration)
- **Goal:** Make the core playable in a browser at mobile-portrait dimensions: render state, accept
  tap-to-drop with cooldown, show HUD, and reach a working game-over → replay/CTA flow.
- **Scope:** `src/game/**` — `main` Phaser config (portrait resolution, `Scale.FIT`/`CENTER_BOTH`);
  `art`/`TextureFactory` procedural neon textures (background, brick, bomb, danger line, buttons);
  `GameScene` wiring `GameEngine` ↔ display objects (rising bricks, falling bomb, HUD score/best),
  pointer tap → `dropBomb(column)` honoring cooldown; danger line; loss → `GameOverScene`/overlay
  with **Replay** (restart) and a visible **stub CTA** button, laid out for portrait. Base tint
  applied via `theme.valueToTint` (full green→red polish lands in Phase 3).
- **Repos touched:** Takumi-Playable.
- **Exit Criteria:**
  - [ ] Prototype loads and is playable in a browser at portrait dimensions; bricks rise, taps drop
        bombs subject to cooldown, rules are visibly correct, loss triggers game over.
  - [ ] Score and best render and update from engine events.
  - [ ] Game-over screen shows score + best with functional Replay and a visible non-functional CTA.
  - [ ] `integration` tests (Phaser headless/canvas-mock + jsdom) verify scene wiring: tap →
        `dropBomb`, engine events → HUD/state, loss → game-over transition, replay → reset.
  - [ ] Build still compiles; core unit tests remain green.
- **Key Risks / Notes:** Phaser needs a canvas context — use headless/canvas-mock for integration
  tests and keep assertions on wiring, not pixels; map tap x → column deterministically.

### Phase 3: Juice, Neon Polish & Tuning
- **Goal:** Deliver the full neon/juice experience and tune pacing to the ~30–45s target, satisfying
  every remaining Definition-of-Done visual item.
- **Scope:** Explosion particles, brick spawn fade-in, screen shake on full-row clears, pulsing top
  danger line, game-over fade-in; complete number→color green→red tint mapping for bricks and bombs;
  neon styling pass on background/UI; empirical tuning of `config` (rise curve, spawn cadence,
  cooldown, value bands, scoring) to hit 30–45s average loss; best-score persistence polish.
- **Repos touched:** Takumi-Playable.
- **Exit Criteria:**
  - [ ] All requested juice present: danger-line pulse, explosion particles, spawn fade-in, full-row
        screen shake, game-over fade-in.
  - [ ] `valueToTint` verified by `unit` tests (low→green, high→red, monotonic mapping) and applied
        to bricks and bombs.
  - [ ] `integration` test asserts juice hooks fire on their triggering engine events (e.g. shake on
        rowclear, particles on destroy/explode).
  - [ ] Seeded pacing check (auto-play harness) plus a manual playtest confirm average session lands
        ~30–45s; tuned constants recorded in `config`.
  - [ ] Performance remains smooth on a common mobile viewport during particles/shake (manual smoke).
- **Key Risks / Notes:** Pacing is empirical — reserve buffer for iteration. Keep particle counts and
  active rows bounded to protect mobile performance (per TDD §7).

---

## 2. Phase Dependencies

- **Phase 2 depends on Phase 1** because it renders and drives the `GameEngine` API and event stream
  produced in Phase 1 (real input dependency — Phase 2 cannot wire what does not exist).
- **Phase 3 depends on Phase 2** because juice hooks, tint application, and pacing tuning attach to
  the scenes, event bindings, and playable loop established in Phase 2.
- Phases are strictly sequential; there are no independent parallel roots at the phase level (the
  three seams form a genuine dependency chain). Parallelism is exploited *within* phases via
  independent build nodes chosen during planning.

---

## 3. Deferred Work Registry

- Deferred Item: Final numeric tuning constants (scoring weights, difficulty ramp, value bands).
  - Origin: Phase 1 (defaults defined) → resolved empirically.
  - Proposed Target Phase: Phase 3.
  - Rationale: Pacing to 30–45s is empirical and best tuned once the full juice/render loop exists.
  - Notes: `config` holds defaults from Phase 1 so Phases 1–2 are fully functional before tuning.
- Deferred Item: Cross-device / server-side best-score persistence.
  - Origin: PRD §4 (explicitly not required).
  - Proposed Target Phase: Out of scope (future feature).
  - Rationale: Prototype needs only local replay motivation.
  - Notes: `BestScoreStore` interface leaves room to swap in a remote impl later.
