---
id: TASK-85
title: Step through the TUI action path leg by leg
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 21:38'
updated_date: '2026-08-17 21:47'
labels: []
dependencies: []
priority: high
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web viewer traces an active flow one relationship leg at a time with a caption; the TUI lights the whole walk statically and cannot step it. With a person command active, s advances a traced leg with a footer caption naming it, matching the web viewer's Step control. The TUI map has no animation, so pause and speed do not apply.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With an active person command, s advances the trace one relationship leg at a time, wrapping after the last, and the footer captions it as 'step k/n · source → target · label'
- [x] #2 The traced leg is emphasized on the map while the rest of the lit path stays visible
- [x] #3 x clears the path, the trace, and the caption; picking another command resets the trace
- [x] #4 Stepping transitions are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ViewerState gains actionStep?: number; new 'step-action' ViewerAction reduced in navigation.ts: with an active command, advance (actionStep ?? -1) + 1 modulo actionLegs length; clear-action and a new pick reset it.
2. terminal-viewer.ts maps the s key to 'step-action'.
3. paint.ts composes the footer caption from actionLegs when actionStep is set ('step k/n · source → target · label') and passes the traced leg id to drawWorld; the traced route draws bold accent while other path routes stay accent.
4. Fixture tests in navigation tests: step advances and wraps, x clears it, a new pick resets it, s without an active command does nothing.
5. bunx tsc, bun test, agent-tty check: pick a command, step through the legs, watch the caption and emphasis, x clears.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
actionStep rides ViewerState; 'step-action' (key s) advances (actionStep ?? -1)+1 modulo actionLegs length, clear-action and a fresh pick reset it. paint.ts passes the traced leg id into drawWorld; drawRoute draws the traced leg with heavy glyphs (━ ┃ and heavy corners) while the rest of the walk stays lit; the footer caption becomes 'step k/n · source → target · label' and hints gain 's step'. agent-tty evidence at 120x36: picked a Human architect command, s produced 'step 1/3 · Coding agent → Cli · Runs Groma while implementing' then 2/3, 3/3, wrapping to 1/3; heavy glyphs appeared on the map (grep ━ = 2 rows) and x cleared caption and glyphs (grep = 0). Fixture test covers advance, wrap, no-op without a command, reset on re-pick, and clear. bunx tsc clean, bun test 154 pass.

Cold simplicity review: applied the accept-worthy test-helper hoist (shared box/edge builders at module scope, both action tests reuse them) and all three nits (pathIds derived from the already-computed legs with the actionPath import dropped, plain tracedId: traced?.id, one nameOf accessor passed to actionCaption). Post-review: bunx tsc clean, bun test 154 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
s now traces an active TUI person command one relationship leg at a time: actionStep in ViewerState advances modulo the walk's actionLegs and wraps, the traced leg draws with heavy glyphs while the rest of the walk stays lit, and the footer captions 'step k/n · source → target · label'. x clears path, trace, and caption; re-picking resets the trace. Verified with a navigation fixture test (advance, wrap, no-op without a command, reset on re-pick, clear) and agent-tty at 120x36: captions stepped 1/3 through 3/3 and wrapped, heavy glyphs appeared and vanished on x. bunx tsc clean, bun test 154 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
