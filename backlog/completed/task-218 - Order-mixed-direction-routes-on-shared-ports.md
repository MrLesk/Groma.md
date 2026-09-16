---
id: TASK-218
title: Order shared routes on clear building ports
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 16:33'
updated_date: '2026-08-30 16:58'
labels: []
dependencies: []
references:
  - 'observed:human-architect'
  - 'observed:commands'
  - 'observed:screen'
  - 'observed:page'
  - sheet
  - 'observed:task-diff'
  - 'observed:revision-history'
modified_files:
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
type: bug
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the Groma Web map, routes that share one endpoint side should use a port order that follows their first turns and destinations. Mixed-direction fans must receive a safe deterministic order. Directly facing routes must use the interior of both building faces rather than attaching at a projected corner seam.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Routes sharing an endpoint side receive a deterministic non-crossing order even when some routes turn in opposite directions.
- [x] #2 In the approved Human architect east-side example, the route to Commands uses the top slot ahead of the later north-turning route while the route to Page keeps its south-turning direction.
- [x] #3 The ordering preserves authored direction, straight endpoint runs, building avoidance, and shared-path safety.
- [x] #4 A directly facing route becomes straight only when the two building faces share usable interior space; otherwise its safe dogleg remains and neither endpoint attaches at a building corner.
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
1. Order every route sharing one endpoint side by its turn direction, then by turn depth: decreasing-coordinate turns take the upper slots and increasing-coordinate turns take the lower slots.
2. Straighten directly facing routes only through the wall overlap that remains after excluding both buildings’ corner clearances; otherwise preserve the routed dogleg.
3. Keep the current generic crossing, building-avoidance, shared-path safety gate and rollback.
4. Cover a mixed three-route fan and a narrow facing pair with minimum fixtures, then verify the approved live routes and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A first subset-only candidate moved the early north route above the later north route but left the south-turning route between them, reducing two crossings to one rather than eliminating the fan crossing. Replaced that plan with whole-fan ordering by turn direction and turn depth.

Implemented whole-fan ordering for mixed turns. Routes sharing one endpoint side now sort by turn direction, then by turn depth; the existing snapshot and safety gate retain the change only when crossings decrease without building entry or shared paths. The minimum fixture reproduces the old two-crossing order with two north turns and one south turn, then verifies zero crossings and preserved directions. On the live map, Human architect east-side slots are Commands 62, Screen 63, Page 64. Twenty repeated focused runs passed 200 tests; the wider sheet suites passed 27 tests; scoped lint, typecheck, diff validation, and file-size limits passed. The full check reached only the existing unrelated scan-watch failures: empty CLI watch output and EMFILE. The cold simplicity review found no blockers or simplifications. The server is running on 4848 for human approval; automated in-app browser QA was blocked by the browser URL policy for localhost.

The approved scope now also covers the selected Task diff to Revision history route. Its two-point straightening clamps to the single shared wall corner, so the projected route merges with Revision history’s vertical seam. The generic correction will require usable interior wall overlap before straightening and will otherwise keep the safe dogleg.

Implemented the approved corner correction in the existing facing-route refinement. Both building wall spans are now reduced by the normal route clearance before a common straight coordinate is chosen. A usable interior overlap keeps the route straight; an overlap that exists only at a corner keeps Libavoid’s routed dogleg. The anonymous narrow-overlap fixture previously attached at the target corner and now remains straight half a grid cell inside both faces. On the current map, Task diff to Revision history remains a two-point route and moves from gx 37.16 to gx 36.66. The focused route, sheet-scene, and iso-map suites pass 43 tests; scoped Biome lint, TypeScript, diff validation, and file-size limits pass. The full repository check again reaches only the same unrelated watch failures: empty CLI watch output and EMFILE.

The fresh cold simplicity review of the complete expanded diff found no blockers and no deletions or collapses. It confirmed the flow remains direct: routeAll, route refinement, safe fan ordering, safe facing-route alignment, then the global route safety check. The updated server is responding on port 4848.

The final specification review identified missing objective coverage for the no-interior-overlap branch. Added a minimum facing pair whose wall spans meet only at one corner. The route now remains a four-point dogleg and both endpoints stay off visible polygon corners; before the clearance rule it collapsed to a corner-to-corner line. The expanded route, sheet-scene, and iso-map suites pass 44 tests. Scoped lint, TypeScript, and diff validation pass. The required full check still fails only in the same unrelated scan-watch tests with empty output and EMFILE.

The user visually approved the completed result. Final specification re-review passed after the corner-only dogleg fixture was added. Final quality review passed with no findings; it also produced 100 identical repeated mixed-fan routes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ordered mixed-direction routes deterministically on shared building sides and kept the change only when existing crossing, obstacle, and shared-path safety checks accept it. Facing routes now use clear interior wall overlap, keeping corner-only doglegs instead of attaching to projected seams. Verified by user visual approval, 44 focused route/scene/projection tests, 100 identical repeated fan routes, scoped lint, TypeScript, diff validation, and passing final simplicity/specification/quality reviews. The full repository check remains blocked only by the pre-existing scan-watch EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
