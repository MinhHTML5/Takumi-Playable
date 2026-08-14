# Phase 01 — Carry-Forward Register

- Feature: blockdrop-2
- Phase: 01 — Playable Shell & Test Harness
- Closure source: accepted review node `8dae50e7-00e4-4266-9248-9d5e75269d48`
- Date: 2026-08-14

## Open Items

### CF-01: Execute the mobile-portrait browser boot and neon-background check

- Category: deferred work
- Source: Phase 01 review §8 manual DoD item; review node
  `8dae50e7-00e4-4266-9248-9d5e75269d48`
- Rationale: The accepted headless review verified the vendored runtime, script order, mount,
  viewport metadata, Phaser configuration, and syntax, but could not execute the browser-only
  visual check. This is validation intentionally postponed, not evidence of a defect.
- Recommended phase: Phase 04, before accepting Rendering & Input Binding; it may be performed
  earlier if a browser-capable validation environment is available.

### CF-02: Remove the pre-existing empty `Test.txt` in a scoped cleanup task

- Category: technical debt
- Source: Phase 01 review §7 advisory 1 and stabilization report §5; review node
  `8dae50e7-00e4-4266-9248-9d5e75269d48`
- Rationale: The file predates Phase 01, has no runtime effect, and was outside build/debug repair
  scope. Removing unrelated tracked content during stabilization would have obscured provenance.
- Recommended phase: The next phase that includes an explicit repository-cleanup task, or final
  integration cleanup in Phase 06.

### CF-03: Consider a debug-only warning for unknown scale configuration tokens

- Category: technical debt
- Source: Phase 01 review §7 advisory 2 and code review §2.3; review node
  `8dae50e7-00e4-4266-9248-9d5e75269d48`
- Rationale: The current fallback safely boots with FIT/CENTER_BOTH and is accepted, but an invalid
  future token would silently use the fallback. A warning is an observability improvement rather
  than required Phase 01 behavior.
- Recommended phase: Phase 04 when the Phaser input/render boundary is next modified, if the
  warning remains useful and can be added without expanding that phase's scope.

## Counts

| Category | Count |
|---|---:|
| Deferred work | 1 |
| Known limitation | 0 |
| Technical debt | 2 |
| Open question | 0 |
| **Total** | **3** |
