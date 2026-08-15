# Phase 05 — Carry-Forward Register

- Feature: blockdrop-2
- Phase: 05 — Game Feel Effects
- Closure source: accepted review node `1c072521-caaf-4349-9a3f-28143e4285b7`
- Date: 2026-08-15

## Open Items

### CF-01: Execute the mobile-portrait browser boot and full playability walkthrough

- Category: deferred work
- Source: Phase 01 manual DoD item, re-deferred by Phase 05 plan §10 and confirmed by Phase 05
  review §§Test Coverage Assessment and Notes for Resolve
- Rationale: Phase 05 structurally verified the new explosion, spawn-fade, row-clear-shake, and
  danger-pulse wiring, but the execution lane has no browser and cannot observe canvas output,
  responsive portrait fit, pointer feel, visual effect quality, or real-device frame rate. This
  is validation intentionally postponed, not evidence of a defect.
- Recommended phase: Phase 06 final integration and DoD walkthrough, including the complete
  boot-to-game-over-to-restart path and all Phase 05 effects.

### CF-02: Remove the pre-existing empty `Test.txt`

- Category: technical debt
- Source: Phase 01 review §7 advisory 1, re-deferred by Phase 05 plan §10 and confirmed by Phase 05
  review Notes for Resolve
- Rationale: The tracked file has no runtime effect, and Phase 05's approved scope was limited to
  the render/effects surface. Removing unrelated content would have obscured provenance.
- Recommended phase: Phase 06 final integration cleanup.

### CF-03: Consider a debug-only warning for unknown scale configuration tokens

- Category: technical debt
- Source: Phase 01 review §7 advisory 2 and code review §2.3, re-deferred by Phase 05 plan §10 and
  confirmed by Phase 05 review Notes for Resolve
- Rationale: Phase 05 did not edit `src/main.js` or its scale-token boundary. The accepted fallback
  remains safe; a warning is an optional observability improvement rather than required behavior.
- Recommended phase: Phase 06 final integration cleanup if it can be included without displacing
  required game-over/restart work; otherwise leave the accepted fallback unchanged.

## Counts

| Category | Count |
|---|---:|
| Deferred work | 1 |
| Known limitation | 0 |
| Technical debt | 2 |
| Open question | 0 |
| **Total** | **3** |
