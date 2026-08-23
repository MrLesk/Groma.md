---
id: TASK-144
title: Keep the Coding agent route west until it clears the people
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:24'
updated_date: '2026-08-23 17:28'
labels: []
dependencies: []
references:
  - sheet-router
  - iso-projection
modified_files:
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
type: bug
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the repository web map, the Coding agent to Commands route starts toward Human architect and bends beside the Coding agent cylinder. It should leave Coding agent from the west-facing side, continue west until it visibly clears the people cylinders, then turn north toward Commands, matching Alex’s screenshot and direction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the repository web map, Coding agent to Commands leaves the west-facing side and travels west for at least one full cell before its first northward turn
- [x] #2 The route stays clear of the Coding agent and Human architect cylinders and still reaches Commands as one distinct route
- [x] #3 A minimal routing fixture covers the chosen departure side and delayed first turn, and browser QA confirms the repository map
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
1. src/sheet/route.ts: probe one full clearance cell along each source departure. Keep the normal facing-side preference when a primary facing corridor is clear; when every primary facing corridor is crowded, let alternate sides compete and make a winning alternate departure run the full cell before A* may bend.
2. test-bun/sheet-route.test.ts: add one minimal source/obstacle/target fixture proving the clear west side and delayed north turn without repository names.
3. groma/observed/systems/groma/containers/core/components/sheet-router.md: state the source-departure rule, then verify the repository route in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the source-departure policy inside the existing A* start-state construction. The router identifies the dominant target-facing axis, probes one full LANES cell from every source port, and preserves normal facing-side routing when a primary corridor is clear. When primary corridors are crowded by buildings, only clear departures compete, with equal side cost and a fixed one-cell prefix before A*. Geometric probing ignores already used routes, while the selected prefix is rerun with used-lane checks.

Correction history: a cold simplicity experiment removed the dominant-axis distinction, but the isolated suite then produced broad 20-second viewer timeouts and no longer represented the approved diagonal Coding-agent example, so the eight-line ranking was restored. The full-context review then separated cell geometry (LANES) from visual clearance tuning (CLEARANCE_REACH), excluded crowded departures in alternate mode, and aligned the router comments with the invariant.

Verification: the focused fixture proves west-side attachment, a one-cell west segment, then a north turn. A detached worktree containing only TASK-144 changes passed typecheck, 92 Node tests, and 144 viewer tests. Final browser QA on that scoped build showed Coding agent at x 8..13 / y 54..59, Human architect at x 8..12 / y 48..52, and Coding agent to Commands routed (7.5,54) -> (6.5,54) -> (6.5,28.5) -> (23,28.5), with no browser warnings or errors. Cold simplicity, specification, quality, and full-context complexity reviews have no remaining blocking findings. The unrelated actor-vocabulary hunk in the shared test file is excluded by patch staging.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Coding agent to Commands now leaves the west side, travels one full cell before turning north, and stays west of both people. The generic router rule applies to any building-crowded primary departure and reuses the existing ports, lattice, clearance geometry, and A* search. Verified with the focused invariant fixture, an isolated typecheck plus 92 Node and 144 viewer tests, exact route coordinates from the scoped web payload, visual browser QA, and empty browser logs.
<!-- SECTION:FINAL_SUMMARY:END -->
