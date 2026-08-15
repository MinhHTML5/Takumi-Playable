# Phase 04 — Carry-Forward Register

- Feature: blockdrop-2
- Phase: 04 — Rendering & Input Binding
- Closure source: accepted review node `ef323933-2bed-4059-a7d1-ef4c953d7ce5`
- Date: 2026-08-15

## Open Items

### CF-01: Execute the mobile-portrait browser boot and playability walkthrough

- Category: deferred work
- Source: Phase 01 review manual DoD item, re-evaluated by Phase 04 plan §10 and Phase 04 review
  §§1, 8–9
- Rationale: Phase 04 delivered the rendering and input surface plus all headless preconditions,
  but the execution lane has no browser and cannot verify actual canvas rendering, responsive
  portrait fit, pointer feel, or the visible no-input path to game over. The accepted review
  explicitly retained this as a human manual DoD item rather than claiming unobserved behavior.
- Recommended phase: Phase 05 when effects are visually reviewed, and no later than the Phase 06
  final DoD walkthrough.

### CF-02: Remove the pre-existing empty `Test.txt`

- Category: technical debt
- Source: Phase 01 review §7 advisory 1, re-deferred by Phase 04 plan §10 and confirmed by Phase 04
  review §8
- Rationale: The tracked file has no runtime effect, and Phase 04 contained no repository-cleanup
  task. Removing unrelated content during rendering work would obscure provenance.
- Recommended phase: Phase 06 final integration cleanup.

### CF-03: Consider a debug-only warning for unknown scale configuration tokens

- Category: technical debt
- Source: Phase 01 review §7 advisory 2 and code review §2.3, re-deferred by Phase 04 plan §10 and
  confirmed by Phase 04 review §8
- Rationale: Phase 04 did not change the `src/main.js` scale-token boundary, and its accepted
  fallback remains safe. A warning is an optional observability improvement, not required
  rendering behavior, so adding it without a boundary change would be unscoped churn.
- Recommended phase: The next phase that edits `src/main.js` scale handling; otherwise evaluate
  during Phase 06 final integration cleanup.

## Resolved This Phase

- Prior CF-04 was discharged by Phase 04 tasks T3/T4/T6: `fixedSteps` bounds a model tick to 0.05 s,
  limiting bomb travel to 45 game units against a 120-unit row height. The accepted real-config
  test pins the relationship, so this is no longer an open carry-forward item.

## Counts

| Category | Count |
|---|---:|
| Deferred work | 1 |
| Known limitation | 0 |
| Technical debt | 2 |
| Open question | 0 |
| **Total** | **3** |
