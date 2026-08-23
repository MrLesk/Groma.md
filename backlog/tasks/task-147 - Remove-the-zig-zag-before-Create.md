---
id: TASK-147
title: Remove short zig-zags before buildings
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:44'
updated_date: '2026-08-23 17:45'
labels: []
dependencies:
  - TASK-143
references:
  - sheet-router
modified_files:
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
type: bug
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the repository web map, some relationships make two tight opposite turns immediately before entering a building. The approved examples are the labelled route into Create and the route into Screen. Their final approaches should be visually simple: resize a box if the route needs the room, or route it with one clean 90-degree turn, but do not leave a short zig-zag beside an endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the repository web map, the routes into Create and Screen reach their boxes without two consecutive bends separated by a short segment beside the endpoint
- [x] #2 After its final bend, each arrow travels straight into one side of its box and remains distinct from nearby routes
- [x] #3 A minimal routing test covers the final-approach rule and browser QA confirms both repository examples
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
1. src/sheet/route.ts: measure each lattice node’s distance to the current target goals with the existing grid sweep. Keep all routes possible, but price a bend inside the final cell as one extra cell of the normal bend cost so A* prefers one straight final approach.
2. test-bun/sheet-route.test.ts: add a minimal multi-route fixture that consumes neighbouring target ports and proves the incoming route keeps at least one full cell straight after its final bend while remaining distinct.
3. groma/observed/systems/groma/containers/core/components/sheet-router.md: state the final-approach rule. Verify Create and Screen in the repository web map, then run the isolated full checks and review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the final-approach policy inside the existing A* turn pricing. The router reuses its grid sweep to measure one LANES cell around the current target goals. A turn inside that area remains possible but costs one additional cell of normal bend price, so clean routes turn earlier while crowded worlds retain their routing capacity.

Correction history: excluding endpoint surfaces from clearance did not change Create or Screen and broke the surface-border invariant, so it was rejected. Extending or forbidding the final approach cleaned the examples but reduced dense target capacity and changed existing port behavior, so it was rejected. The soft cost preserves those routes. The cold simplicity review removed one redundant destination and setup relationship from the fixture and normalized the roof heights, leaving the smallest old-fails/new-passes case found: four endpoints and two distinct routes.

Verification: the final focused test passes and proves a one-cell-or-longer final straight segment plus unique lane edges. A detached worktree containing only TASK-147 changes passed typecheck, 92 Node tests, and 145 viewer tests. Final scoped browser data shows Edit to Create as (29.5,32) -> (29.5,35.5) -> (27,35.5), and Coding agent to Screen as (12.5,59) -> (12.5,77) -> (24,77) -> (24,78.5); screenshots confirm both clean approaches and browser warnings/errors are empty. Best-of-five composition changed from 484 ms to 672 ms; total route length changed 1357.5 to 1370.5 cells (0.96%), while bend count stayed 131. Simplicity, specification, quality, and full-context architecture reviews have no remaining blocking findings. The unrelated actor-vocabulary hunk in the shared test file will be excluded by patch staging.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routes now make their last turn at least one full cell before a target when the layout has room, while late turns remain available in dense layouts. This removes the short zig-zags before Create and Screen through one general sheet-router rule. Verified with the minimal busy-target fixture, exact scoped web-route coordinates, browser screenshots and empty logs, and an isolated typecheck plus 92 Node and 145 viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
