# Node Plan: Phase 03 — Simulation Loop: Collision, Rising & Game Over

## 0. Metadata

- Feature Slug: blockdrop-2
- Phase: 03
- Status: Approved
- Last Updated: 2026-08-14

---

## 1. Rules

This document defines the authoritative execution sub-graph planning materializes via
`phase_execution_set`: the `build` and `debug` nodes. `review` and `resolve` are provided by the
`delivery_loop` and attach automatically after this sub-graph. Aliases are stable identifiers;
dependencies reference aliases only. Each node is a strict execution scope and must not expand
beyond its Work Packet. Every node traces to Task Inventory scope in `12-phase-plan.md`.

**Decomposition rationale.** Two build roots split along a genuine seam of independence:

- `collision.js` is a **pure function** with its own unit suite — independently validatable in
  isolation, so it is its own node (`P03-BUILD-COLLISION`).
- `simulation.js` (`GameModel`) composes that resolver and orchestrates the tick. The collision
  **cascade lives inside `tick`** and can only be validated together with the model, so the model +
  cascade + its unit/integration/contract tests stay in **one** node (`P03-BUILD-SIMULATION`).
  Splitting the model from its cascade would fragment an atomic change and manufacture an illusory
  seam.

The two build nodes form a short real dependency chain (`SIMULATION` needs `COLLISION`'s export),
not incidental ordering. No third parallel root exists because the phase is a two-module composition
where the second module genuinely consumes the first.

---

## 2. Node List

### `P03-BUILD-COLLISION`
- Alias: `P03-BUILD-COLLISION`
- Lane: `lane:build`
- Title: `lane:build Phase 03 Build: Collision Resolver`
- Priority: `1`
- Depends On: `[]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 `collision.js`, §4.4 INV-8)
  - `./12-phase-plan.md` (T1, T2)
  - `../../../../src/core/config.js` (value bounds, read-only)
- Outputs (paths):
  - `src/core/collision.js`
  - `test/collision.test.js`
- Work Packet (strict scope):
  - Implement **T1**: `resolveCollision(bombValue, brickValue)` as a pure, Phaser-free function
    returning the exact delta object specified in phase plan T1 for each of the three INV-8
    outcomes (greater / lesser / exact). No state ownership, no row iteration, no imports of other
    core modules required. For `exact`, `scoreGained` is `0` and `triggersRowClear` is `true` (the
    row-clear award is owned by the model — do not score the row here).
  - Implement **T2**: `test/collision.test.js` — unit tests asserting each outcome's full delta
    object, including the greater/exact and lesser/exact equality boundary and brick values at the
    `[1,30]` extremes. Specific value assertions only (no truthiness).
  - Match the house module convention: named export `resolveCollision` plus a `default` export.
  - Do **not** touch `simulation.js`, scenes, `main.js`, `index.html`, or vendor.
- Validation Commands:
  - `node --test test/collision.test.js`
- Validation Classes:
  - `unit`

### `P03-BUILD-SIMULATION`
- Alias: `P03-BUILD-SIMULATION`
- Lane: `lane:build`
- Title: `lane:build Phase 03 Build: GameModel Simulation Loop`
- Priority: `1`
- Depends On: `[P03-BUILD-COLLISION]`
- Inputs (paths):
  - `../10-tdd.md` (§4.1 `simulation.js`, §4.2 state model, §4.3 API, §4.4 INV-1..8)
  - `./12-phase-plan.md` (T3, T4, T5)
  - `src/core/collision.js` (from `P03-BUILD-COLLISION`)
  - `../../../../src/core/rng.js`, `difficulty.js`, `grid.js`, `scoring.js`, `config.js`
- Outputs (paths):
  - `src/core/simulation.js`
  - `src/core/config.js` (additive tunables only, if the loop requires them)
  - `test/simulation.test.js`
  - `test/simulation.integration.test.js`
- Work Packet (strict scope):
  - Implement **T3**: the `GameModel` class with the TDD §4.3 API —
    `new GameModel({ config, rng })`, `dropBomb(x) -> boolean`, `tick(dtSeconds) -> void`,
    `getState() -> snapshot`, `consumeEvents() -> Event[]`, `reset() -> void` — following the tick
    order, cascade rules, event set, and read-only-snapshot requirements pinned in phase plan T3.
    Compose the Phase 02 primitives (`createRng`-provided rng, `difficulty.*`, `grid.*`,
    `scoring.*`) and `resolveCollision`; own all mutable state exclusively (INV-3). Randomness flows
    only through the injected `rng`; no wall-clock, no `Math.random` (INV-2). Keep the module
    Phaser/DOM-free — **no** `phaser`/`document`/`window` substrings anywhere, including identifier
    names (INV-1; enforced by the scan in `test/config.test.js`).
  - If needed, extend `src/core/config.js` with additive simulation tunables (`grid.initialRows`,
    a game-over top boundary) as pure data — additive only, changing no value asserted by
    `test/config.test.js`.
  - Tune `config.js` data (initial rows, rise/difficulty/spawn) so a fixed-seed, no-input session
    reaches game-over within ~30–45 s of simulated time (R2), as asserted by the T5 integration test.
  - Implement **T4**: `test/simulation.test.js` — unit + contract tests (dropBomb gate INV-5, tick
    mechanics, single-step outcomes, scoring INV-4, value bounds INV-7, reset INV-6, and the public
    API/event-shape contract per TDD §4.3, including snapshot non-aliasing).
  - Implement **T5**: `test/simulation.integration.test.js` — integration tests (multi-brick
    cascade and exact-match row-clear aggregate under the wired model, and the no-input session
    game-over window under the tuned fixed seed).
  - Do **not** implement any rendering, scene wiring, input, or juice; do **not** edit
    `src/scenes/*`, `src/main.js`, `index.html`, `vendor/*`, or any existing asserted `config.js`
    value.
- Validation Commands:
  - `node --test test/simulation.test.js`
  - `node --test test/simulation.integration.test.js`
  - `node --test`
- Validation Classes:
  - `unit`
  - `integration`
  - `contract`

### `P03-DEBUG-STABILIZE`
- Alias: `P03-DEBUG-STABILIZE`
- Lane: `lane:debug`
- Title: `lane:debug Phase 03 Debug: Simulation Stabilization`
- Priority: `1`
- Depends On:
  - `P03-BUILD-SIMULATION`
- Inputs (paths):
  - `./12-phase-plan.md`
  - `./13-node-plan.md`
  - `src/core/collision.js`, `src/core/simulation.js`, `src/core/config.js`
  - `test/collision.test.js`, `test/simulation.test.js`, `test/simulation.integration.test.js`
- Outputs (paths):
  - stabilization report (debug node's completion artifact / report)
- Work Packet (strict scope):
  - Implement **T6**: execute the full validation suite, diagnose any failures, apply bounded
    repairs within phase task scope, and rerun until green or a stop condition is hit. Confirm the
    INV-1 core-purity scan (in `test/config.test.js`) still passes with the two new core modules.
- Validation Commands:
  - `node --test`
- Validation Classes:
  - `unit`
  - `integration`
  - `contract`

### Debug Scope
Stabilizes the Phase 03 build output (collision resolver + `GameModel` and their suites) within the
referenced build scope. Executes `node --test`, diagnoses, repairs within scope, reruns to green.

### Allowed Repair Surface
- Small logic bugs in `collision.js` / `simulation.js` (off-by-one in the tick/cascade/spawn timer,
  incorrect delta application, event-emission gaps).
- Spawn-timer remainder / interval-crossing handling.
- Test fixture, seed, or assertion-setup issues in the phase's test files.
- **R2 tuning** of `config.js` data (initial rows, rise/difficulty/spawn constants) to land the
  no-input session in the ~30–45 s window — data-only, additive-or-existing-tunable changes.

### Stop Conditions
Debug must escalate (`status: blocked`) — or defer to a remediation loop only for a bounded,
build-fixable defect — if:
- more than 3 repair cycles occur on the same failure class,
- an architecture invariant (INV-1..8) cannot be satisfied without a design change,
- the fix requires new feature scope or an out-of-scope file,
- the R2 window cannot be reached by `config.js` data tuning and would require reshaping the loop's
  mechanics (a design question — block and name it, do not loop indefinitely).

---

## 3. Validation Classes

- `unit` — collision outcome rules; `GameModel` dropBomb gate, tick mechanics, scoring, value
  bounds, reset.
- `integration` — cross-module cascade, exact-match row-clear aggregate, and no-input session
  game-over window under the model's tick.
- `contract` — `GameModel` public API/event shape per TDD §4.3.

All expressed in the project's own command: `node --test` (equivalently `npm test`).

---

## 4. Example Build Node

(See `P03-BUILD-COLLISION` and `P03-BUILD-SIMULATION` in §2 — concrete, not illustrative.)

---

## 5. Example Debug Node

(See `P03-DEBUG-STABILIZE` in §2 — concrete, not illustrative.)

---

## 6. Remediation Loops (Runtime, Not Predefined)

Not part of this base sub-graph. Any `build`, `debug`, or `review` node may open a
`remediation_loop` (`build → debug → review`, rejoining at `resolve`) at closure for a blocking,
in-scope, **bounded-fixable** defect. Loops run in parallel with the rest of the graph and are
bounded by `max_self_recurrence: 5`; on exhaustion with issues remaining, the loop's review
escalates with `status: blocked`. Do not add remediation nodes to this document.

---

## 7. Base Execution Order

```
P03-BUILD-COLLISION ─→ P03-BUILD-SIMULATION ─→ P03-DEBUG-STABILIZE ─→ review ─→ resolve
```

- Build and debug nodes are defined here; `review` (closure gate) and `resolve` come from the
  `delivery_loop`.
- `review` depends on all debug nodes (`P03-DEBUG-STABILIZE`).
- `resolve` depends on `review` (and on any remediation-loop review nodes that rejoin).

---

## 8. Graph Constraints

- The graph is a DAG; no cycles.
- Dependencies reference declared aliases only.
- `P03-BUILD-SIMULATION` depends on `P03-BUILD-COLLISION` (real input dependency: it imports the
  resolver).
- `P03-DEBUG-STABILIZE` depends on `P03-BUILD-SIMULATION`.
- Review depends on all debug nodes; resolve depends on review.

---

## 9. Priority Contract

All nodes use priority `1` (High) — Phase 03 is the highest logic-complexity phase and gates the
rendering track (Phase 04). All priorities are within `0-4`.
