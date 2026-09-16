---
id: TASK-430
title: Bound crossing-aware routing work to fix CI timeouts
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-16 21:10'
updated_date: '2026-09-16 21:14'
labels: []
dependencies: []
references:
  - relationships
modified_files:
  - src/sheet/route-search.ts
type: bug
ordinal: 503000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The macOS CI large-world tests exceed their 20-second limit after crossing-aware rerouting. Profiling the existing 572-route fixture shows repeated occupation of every other path and searches for detours that cannot improve a valid route.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Crossing-aware routing retains relationship direction, obstacle clearance, spacing, determinism and the existing crossing-reduction regression.
- [x] #2 Large-world routing work is reduced without increasing test timeouts or weakening existing tests.
- [ ] #3 The repository checks and CI pass after the fix is pushed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure the current large-world route pass. 2. Update lane and stroke occupancy incrementally and prune rerouting branches whose minimum possible cost cannot improve the original path. 3. Compare complete route output, run focused and repository checks, then push only this fix and verify CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Profiled the 572-route large-world fixture: 6.41 s before; 327,756 path-occupancy updates took 2.05 s. Incremental per-axis occupancy counts reduce this to 1,716 updates and 36 ms; complete route generation is 4.39 s. Complete serialized route output is identical before/after. Search now discards branches whose distance lower bound cannot beat the original route cost. A turn-aware search-priority experiment showed no useful gain and was removed. Latest upstream macOS run also reproduces the same three 20-second test timeouts (21.1 s). No CI settings or tests changed.

Focused existing tests passed: 21 tests covering the large fixture, crossing reduction and dense routing safety. Full bun run check passed: 16 Node tests, 360 Bun passed, 17 skipped, zero failures; standalone bun run build passed. No new lint warnings or whitespace errors. Implementer specification/quality review: incremental counts preserve shared stroke nodes and overlapping lane margins; a Manhattan distance bound prunes only paths unable to improve the incumbent route cost. Existing routing geometry is identical for every route in the large-world fixture. No changes to tests, runner timeouts, workflow configuration, rendering semantics or stored architecture. CI verification remains pending after push.
<!-- SECTION:NOTES:END -->
