# TDD: Number Bomb Brick Breaker (blockdrop)

## 0. Metadata

- Feature Slug: blockdrop
- Related PRD: `./00-prd.md`
- Owners:
  - Product: operator (intake-confirmed)
  - Architecture: lane:arch / stage:baseline
  - Build: lane:build
- Status: Draft
- Last Updated: 2026-08-14

---

## 1. Overview

- **Problem being solved:** There is no implementation of the requested arcade loop —
  numbered bombs dropped from the top onto numbered bricks that rise from the bottom, with
  number-comparison collision rules, neon art, juice, and a game-over screen with replay + stub
  CTA. We are building a self-contained, browser-playable Phaser prototype for mobile portrait,
  tuned so an average session ends in ~30–45s.
- **High-level approach:** A **pure, framework-independent game-logic core** (no Phaser imports)
  owns all rules — collision/number resolution, spawning, difficulty, scoring, rise + loss
  detection — driven by an injectable seeded RNG so it is deterministic and unit-testable in CI
  without a browser or canvas. A **thin Phaser render/input layer** (scenes) mirrors core state
  to procedurally-generated neon textures, translates taps into bomb drops, and plays juice. This
  separation is the central architectural decision: it makes the PRD's correctness rules verifiable
  by `unit` tests that never touch WebGL.
- **Key systems involved:** Game-logic core (TypeScript, no Phaser), Phaser 3 rendering/input
  layer, procedural neon art generation, Vite build, Vitest test runner. No backend, no external
  binary assets, no network.
- **What success looks like:** Prototype runs in a browser at mobile-portrait dimensions; number
  rules behave exactly as specified; bricks rise and trigger loss at the top; tap-to-drop honors a
  cooldown; brick numbers trend upward over time; score + best score render and update; game-over
  screen fades in with working replay and a visible (non-functional) CTA; all requested neon/juice
  effects present; average session ~30–45s.

---

## 2. In-Scope and Out-of-Scope (Technical)

### In-Scope
- Self-contained Phaser 3 + TypeScript project (Vite dev/build, Vitest tests), no runtime backend.
- Pure logic core: types, config, seeded RNG, collision/number-rule resolver, board/grid + rise +
  loss detection, brick spawner with upward-trending distribution, difficulty curve, scoring,
  best-score store abstraction.
- Phaser layer: mobile-portrait game config + scaling, procedurally-generated neon textures,
  gameplay scene (rising bricks, falling bomb, tap input + cooldown, HUD), game-over scene/overlay
  with replay + stub CTA.
- Juice: pulsing danger line, explosion particles, brick spawn fade-in, screen shake on full-row
  clear, game-over fade-in.
- Number→color tint mapping (low=green → high=red) for bricks and bombs.

### Out-of-Scope (from PRD §3, technical restatement)
- Upgrades, progression, shop, tutorial screens, level map.
- Monetization plumbing, real CTA integration, ad-network packaging / SDK / playable-ad bundle
  compliance.
- Desktop-first optimization (desktop playability acceptable only if it does not compromise
  portrait).
- Cross-device / server-side persistence (best score is local only).

---

## 3. System Context

- **Current architecture summary:** Greenfield. Repo contains only `Test.txt`; no existing game
  systems, build tooling, `REPO_MAP.md`, or documentation constrain the design. Everything here is
  net-new and self-contained under a project root (e.g. `game/`).
- **Relevant modules/services:** None pre-existing.
- **Relevant data flows:** None pre-existing.
- **Current constraints:** Browser runtime only; mobile-portrait primary surface; tap input;
  smooth performance during particles/shake/rising bricks on common mobile viewports; must be
  self-contained (no backend, no external asset downloads at runtime).

### Technology decisions (recorded here; PRD open questions resolved)

The PRD left several implementation choices open and the operator deferred them to the arch/build
team. They are reversible tuning/gameplay knobs with conventional defaults, so they are decided
here rather than escalated:

| PRD Open Question | Decision (default; tunable via `config`) |
|---|---|
| Scoring formula | `destroy` (bomb>brick): `+brickValue`; `damage` (bomb<brick): `+bombValue`; `row-clear` (bomb==brick): sum of cleared brick values `+` a row-clear bonus (`clearedCount * rowClearBonus`, default bonus factor 25). Exact numbers live in `config` and are tuned in Phase 03. |
| Best-score persistence | Persist via `localStorage` (best-effort) behind a `BestScoreStore` interface, with graceful in-memory fallback when storage is unavailable. Survives refresh; no cross-device sync. |
| Bomb number generation | Generated per drop, scaled to current difficulty so the player can keep pace with rising brick numbers (centered near the current brick-value band with bounded variance). Tunable. |
| Board dimensions | 5 columns; ~8–10 visible rows before the top loss line. Tunable via `config`. |
| Same-number row-clear trigger | Equality is evaluated **at each collision, after prior subtractions** — a row clear fires when the bomb's *current* value equals the brick it is currently colliding with (Invariant I2/I3). |
| CTA stub behavior | Generic labeled button (e.g. "PLAY NOW") beside Replay; visible in portrait; performs no external action (no-op). |

- **Tech stack:** Phaser 3 (WebGL/Canvas), TypeScript, Vite (dev server + single-bundle build),
  Vitest (unit/integration). Neon art is generated procedurally at runtime (Phaser `Graphics` →
  textures) so the prototype ships with no binary assets. Rationale: standard, self-contained,
  keeps the logic core testable in Node without a DOM.

---

## 4. Architecture

### 4.1 Components and Responsibilities

**Logic core — `src/core/**` (NO Phaser imports; the testable heart)**

- **`types`** — `Brick`, `Bomb`, `Cell`, `Row`, `GameState`, `GameConfig`, event/outcome types.
  - Responsibility: shared data shapes; owned by core.
  - Integration points: consumed by every core module and (read-only) by the Phaser layer.
- **`config`** — all tunables: columns, rows-to-top, rise speed curve, spawn cadence, cooldown,
  brick/bomb number bands, scoring constants, tint thresholds.
  - Responsibility: single source of truth for tuning. No logic.
- **`rng`** — seedable deterministic PRNG (injectable).
  - Responsibility: all randomness flows through it so tests are reproducible. Invariant I7.
- **`rules` (collision/number resolver)** — given a bomb value and the ordered bricks in a column,
  resolve the drop into an ordered list of outcome events (destroy / damage / row-clear / bomb
  spent) and the final bomb state. Pure function.
  - Responsibility: the number-comparison rules (I2/I3). The single most correctness-critical unit.
- **`board`** — grid/occupancy model: rows of cells (one per column), each cell empty or a brick;
  smooth rise (row y advances over time); topmost-row-reaches-line loss detection; row removal for
  clears; column-stack ordering used by `rules`.
  - Responsibility: spatial/logical state; single writer to grid state (via engine).
- **`spawner`** — generate a new bottom row: which columns get bricks and their values, with the
  value distribution's mean non-decreasing in elapsed time (I5). Uses `rng` + `difficulty`.
- **`difficulty`** — pure mapping `elapsed → { riseSpeed, spawnInterval, brickValueBand,
  bombValueBand }`, monotonic where the PRD requires escalation.
- **`scoring`** — pure mapping from outcome events → score delta (see §3 table).
- **`bestScore` (`BestScoreStore` interface + impls)** — `SessionBestScore` (in-memory) and
  `LocalStorageBestScore`; interface so persistence is swappable/testable.
- **`engine` (`GameEngine`)** — orchestrator: owns authoritative `GameState`; `step(dt)` advances
  rise, runs spawner on cadence, applies difficulty, checks loss; `dropBomb(column)` validates
  cooldown/availability then runs `rules`, applies `scoring`, mutates state, and returns emitted
  events. Emits a typed event stream the render layer subscribes to.
  - Responsibility: the ONLY writer of authoritative simulation state (I6). Framework-independent.

**Phaser render/input layer — `src/game/**` (thin; may import Phaser)**

- **`main`** — `Phaser.Game` config: portrait resolution, `Scale.FIT` + `CENTER_BOTH`, scene list.
- **`theme`** — neon palette + `valueToTint(value)` green→red mapping (pure; unit-testable).
- **`art` / `TextureFactory`** — procedurally draw neon textures (background, brick, bomb, particle,
  danger line, buttons) via `Graphics` into cached textures during boot.
- **`GameScene`** — instantiate `GameEngine`; render bricks/bomb from state each frame; translate
  pointer taps → `dropBomb(column)` (respecting engine cooldown); render HUD (score/best); play
  juice hooks bound to engine events (particles, shake, fades, danger-line pulse); on loss,
  transition to game over.
- **`GameOverScene`** (or overlay) — fade-in; show final score + best; **Replay** (restart) and
  **stub CTA** (no-op) buttons laid out for portrait.

### 4.2 Data and State Model

- **Entities/state (owned by `GameEngine.GameState`):**
  - `rows: Row[]` — each `Row` has `id`, `y` (rising position), `cells: (Brick|null)[]` indexed by
    column. A `Brick` has `value: number`. A "row" for row-clear purposes is a spawn wave (shared
    `Row.id`).
  - `activeBomb: { value, column, y } | null` — at most one bomb in flight.
  - `score`, `best`, `elapsedMs`, `cooldownRemainingMs`, `phase: 'playing' | 'gameover'`.
- **Ownership:** `GameEngine` is the sole writer of `GameState`. `GameScene` holds only Phaser
  display objects mirroring it and must never mutate simulation state (I1/I8).
- **Persistence model:** only `best` persists, via `BestScoreStore` (`localStorage`, best-effort,
  in-memory fallback). No other persistence.
- **Migration strategy:** none (greenfield, no stored schema).

### 4.3 API / Contract Changes

- **New public contracts (internal module APIs, verified by `contract`/`unit` tests):**
  - `resolveDrop(bombValue, columnBricks, config) → { events: OutcomeEvent[], bombSpent, ... }`
  - `GameEngine`: `step(dtMs)`, `dropBomb(column) → OutcomeEvent[]`, `reset()`, `getState()`,
    `on(event, handler)`.
  - `OutcomeEvent` union: `{ type: 'destroy'|'damage'|'rowclear'|'bombspent'|'gameover'|'spawn'|'score', ... }`.
  - `BestScoreStore`: `get(): number`, `set(v): void`.
  - `valueToTint(value): number` and `difficultyAt(elapsedMs): DifficultyParams`.
- **No endpoints / hubs / DTO / versioning** — no network surface.

### 4.4 Invariants (Non-Negotiables)

- **I1 — Core purity:** No module under `src/core/**` imports `phaser` (grep-enforceable; core unit
  tests run in Node with no DOM). Rendering reflects state; it never owns rules.
- **I2 — Number rules:** For a bomb of current value `b` colliding with a brick of value `k`:
  `b > k` → brick destroyed, `b := b - k`, bomb continues to the next brick below; `b < k` → brick
  value becomes `k - b`, bomb is spent (explodes); `b == k` → brick and bomb destroyed **and the
  entire spawn-row containing that brick is cleared**, bomb spent.
- **I3 — Sequential resolution:** A dropped bomb resolves against bricks in its column top-to-bottom
  in order; equality (I2's `==`) is tested against each brick using the bomb's *current* (post-
  subtraction) value. A bomb whose value reaches exactly `0` via a destroy is spent (no zero/negative
  bomb continues).
- **I4 — Single bomb / cooldown:** `dropBomb` is a no-op unless `activeBomb == null` and
  `cooldownRemainingMs == 0`; a successful drop starts the cooldown. At most one bomb in flight.
- **I5 — Upward trend:** the mean of the brick-value distribution produced by `spawner` is
  non-decreasing in `elapsedMs`; `difficulty` params escalate (rise speed up, spawn interval
  non-increasing) over a session. Statistically verifiable with a seeded RNG.
- **I6 — Single writer / terminal game-over:** only `GameEngine` mutates `GameState`; loss fires
  exactly once when the topmost row crosses the danger line; no scoring or spawning occurs after
  `phase == 'gameover'`.
- **I7 — Determinism:** all randomness flows through the injectable `rng`; identical seed + inputs
  ⇒ identical outcomes (enables reproducible tests and pacing analysis).
- **I8 — Best score:** displayed `best >= score` always; `best` updates only when the final score
  exceeds it (at game over) and is persisted best-effort without throwing if storage is unavailable.

---

## 5. Observability

- **Logs:** lightweight `console` diagnostics behind a debug flag in `config` (off by default);
  no telemetry backend.
- **Metrics:** none (prototype). An optional in-code pacing harness (seeded auto-play) may be used
  in tests to estimate average session length for I5/pacing validation.
- **Alerts / Debug hooks:** optional debug overlay (FPS, elapsed, difficulty band) gated by the
  debug flag; not shipped-on.

---

## 6. Security & Abuse Considerations

- **Auth boundaries:** none — no accounts, no server.
- **Data exposure risks:** none — only a local best-score integer in `localStorage`.
- **Abuse vectors:** a user could edit `localStorage` to inflate best score; irrelevant for a
  prototype with no leaderboard. `BestScoreStore` must not crash on malformed stored values
  (parse-guard → fallback to 0).
- **Mitigations:** defensive parsing in `LocalStorageBestScore`; no `eval`/dynamic asset loading.

---

## 7. Performance Considerations

- **Hot paths:** per-frame render of rising bricks + falling bomb; particle bursts and screen shake
  on clears. Target smooth (~60fps, acceptable ≥30fps) on common mobile browser viewports.
- **Expected scale:** small — ≤ ~5 columns × ~10 rows of bricks, one bomb, bounded particle counts.
- **Caching strategy:** procedurally-generated textures are created once at boot and cached/reused;
  particles use a bounded emitter/pool; no per-frame allocation of textures or large arrays.
- **Backpressure / limits:** cap concurrent particles and cap active rows; `step` uses delta time
  and must remain allocation-light in the hot loop.

---

## 8. Rollback / Recovery Strategy

- **Rollback plan:** self-contained static build; reverting the branch fully removes the feature.
  No migrations, no shared state, nothing to un-deploy server-side.
- **Compatibility plan:** none required (greenfield, no external consumers).
- **Data recovery:** none — best score is disposable local state; a corrupt value falls back to 0.

---

## 9. Open Questions

- **Q1 (tuning, deferred to Phase 03):** exact numeric constants for scoring, difficulty ramp, and
  bomb/brick value bands that best hit the 30–45s target — resolved empirically during tuning, not a
  design blocker. Defaults are defined in `config`.
- **Q2 (resolved):** all PRD §7 open questions are decided in §3's decision table; none remain
  architecturally open.
