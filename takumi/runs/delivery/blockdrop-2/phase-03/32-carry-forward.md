# Phase 03 — Carry-Forward Register

- Feature: blockdrop-2
- Phase: 03 — Simulation Loop: Collision, Rising & Game Over
- Closure source: accepted review node `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40`
- Date: 2026-08-14

## Open Items

### CF-01: Execute the mobile-portrait browser boot and neon-background check

- Category: deferred work
- Source: Phase 01 review §8 manual DoD item, re-deferred by Phase 03 plan §10 and confirmed by
  Phase 03 review §8
- Rationale: Phase 03 changed only Phaser-free core modules and introduced no browser or rendering
  surface. The accepted headless evidence does not discharge this manual check and gives no
  indication of a defect.
- Recommended phase: Phase 04, before accepting Rendering & Input Binding.

### CF-02: Remove the pre-existing empty `Test.txt` in a scoped cleanup task

- Category: technical debt
- Source: Phase 01 review §7 advisory 1 and stabilization report §5, re-deferred by Phase 03 plan
  §10 and confirmed by Phase 03 review §8
- Rationale: The file has no runtime effect and Phase 03 contained no repository-cleanup task.
  Deleting unrelated tracked content during a pure-core phase would obscure provenance.
- Recommended phase: The next phase with an explicit cleanup task, or final integration cleanup
  in Phase 06.

### CF-03: Consider a debug-only warning for unknown scale configuration tokens

- Category: technical debt
- Source: Phase 01 review §7 advisory 2 and code review §2.3, re-deferred by Phase 03 plan §10 and
  confirmed by Phase 03 review §8
- Rationale: Phase 03 did not touch `src/main.js` or the Phaser boundary. The accepted fallback is
  safe; a warning remains an observability improvement rather than required behavior.
- Recommended phase: Phase 04, when the Phaser input/render boundary is modified, if still useful
  and coherent with that phase's scope.

### CF-04: Preserve the collision-step constraint or adopt swept overlap after relevant tuning

- Category: known limitation
- Source: Phase 03 review advisory A-1 / code-review advisory CQ-1; review node
  `e75fa37f-ff0f-4965-b4cd-1d9e683e0f40`
- Rationale: The accepted model treats the bomb as a point and checks overlap only at its current
  position. With the delivered values, travel is 15 game units per 60 Hz tick versus a 120-unit
  row height, so the model cannot skip a brick. This is an accepted constraint, not a current
  defect; it matters only if later tuning permits per-tick travel to exceed a row height.
- Recommended phase: Phase 04 or any later phase that changes bomb speed, tick cadence, or row
  height; preserve the constraint or schedule swept-segment collision before accepting that change.

## Counts

| Category | Count |
|---|---:|
| Deferred work | 1 |
| Known limitation | 1 |
| Technical debt | 2 |
| Open question | 0 |
| **Total** | **4** |
