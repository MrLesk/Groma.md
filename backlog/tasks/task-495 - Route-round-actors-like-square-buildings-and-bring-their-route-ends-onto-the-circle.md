---
id: TASK-495
title: >-
  Route round actors like square buildings and bring their route ends onto the
  circle
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 17:57'
updated_date: '2026-09-23 18:58'
labels: []
dependencies: []
references:
  - relationships
  - scene
modified_files:
  - src/sheet/route/ports.ts
  - src/sheet/route/geometry.ts
  - src/sheet/scene.ts
  - test-bun/sheet-route.test.ts
priority: high
type: feature
ordinal: 576000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Round buildings (actors) have their own port rules: they take one arriving route per wall, and their ports only slide toward the middle of each wall, because a round building's circle touches its square footprint only at the middle of each side, so a route ending elsewhere on the side would stop short of the drawn cylinder. On dense actor walls these rules cost crossings and crowding. Route lab on the TASK-482 router, actors treated as square: the 96-route actor-to-system stress case went from 42 to 15 crossings and from 617 to 102 cells of route length closer than the bundle spacing; c9cf7687 51 to 50 crossings, 9176a68c against c9cf7687 519 to 523, large-world fixture 150 to 149. Owner direction (2026-09-23): treat them as square, then adjust the lines afterwards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Routing places ports on a round building exactly as on a square one: spread over the middle half of each wall, with several routes allowed to arrive on the same wall
- [x] #2 After routing, every route end at a round building touches the building's drawn round outline in the iso and 2D views, with no gap between the line or arrowhead and the cylinder, and the end run stays orthogonal
- [x] #3 The route lab reports crossings, bends and crowding before and after on c9cf7687, the 9176a68c against c9cf7687 comparison, the stress case and the large-world fixture
- [x] #4 The owner approves how routes meet actors on c9cf7687 and on the comparison
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
1. src/sheet/route/ports.ts: round buildings take ports exactly like square ones: portSpan loses its middle-point case for round buildings, and oneArrivalPerWall keeps only external-system targets. Endpoint.round then has no reader, so the field goes (route/geometry.ts), with its setter in src/sheet/scene.ts and the test helper line in test-bun/sheet-route.test.ts.
2. No renderer change: onVisibleBuilding in src/viewers/web/iso/project.ts already slides every route end along its own axis onto the first visible face, the drawn cylinder for a round building, in the iso and flattened views, and the docs already say so (Actors are round buildings... sliding along its own axis onto the curve).
3. Tests: none new. The rule (a route end touches the drawn round outline) comes from the owner's direction; the wrong result is an end that stops short of the cylinder; iso-map.test.ts already asserts round route ends off the middle of a side meet the visible outline at both pitches.
4. Verify: route lab before and after on c9cf7687, the 9176a68c against c9cf7687 comparison, the stress case and large-world; browser pages of c9cf7687 and the comparison for the owner, checking actor ends in iso and 2D; bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-23 implemented and verified:
- ports.ts no longer treats round buildings differently: portSpan gives every building its wall's middle half, and only external-system targets keep one arriving route per wall. Endpoint.round had no other reader and is gone (geometry.ts, scene.ts, the sheet-route.test.ts helper).
- Ends on the drawn cylinder need no new code: onVisibleBuilding (src/viewers/web/iso/project.ts) already slides every route end along its own axis onto the first visible face. Checked on the real scenes with presentScene: every route end at a round building lies on its drawn outline in the iso pose (NESTED_POSE) and the flat 2D pose (OVERHEAD_POSE): c9cf7687 4 of 4, the 9176a68c against c9cf7687 comparison 10 of 10, the stress case 98 of 98. iso-map.test.ts already asserts the same for round ends off the middle of a side.
- Ports spread like a square building's: in the stress case the architect actor holds 83 route ends on its east wall between 26 and 75 percent of the wall, 10 on its north wall and 5 on its south wall.
- Route lab, round rules to square treatment: c9cf7687 crossings 51 to 50, bends 130 to 131, length 4,284 to 4,284 cells, crowding under the bundle spacing 0 to 0; comparison 519 to 523, 494 to 499, 44,429 to 44,504, 145 to 145; stress case 42 to 15, 226 to 213, 7,600 to 7,165, 617 to 102; large-world 150 to 149, 668 to 663, 19,691 to 19,684, 0 to 0. No building crossings or shared runs.
- bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail).

Owner approved the actor routes on the review pages (c9cf7687, the comparison and the stress case): "yes perfect" (2026-09-23). Documentation already described route ends sliding onto the round actor along their own axis and never stated the removed round-only port rules, so it needed no change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Round actors now take route ports exactly like square buildings: spread over the middle half of each wall, with several routes allowed on one side; only external-system targets keep one arriving route per wall, and the Endpoint.round field that carried the old rules is gone. The viewer already slides every route end along its own axis onto the drawn cylinder, so the lines still touch the actor. On the dense 96-route actor stress case crossings fell from 42 to 15 and route length closer than the bundle spacing from 617 to 102 cells; c9cf7687 and the 9176a68c against c9cf7687 comparison changed by a crossing or four. Verified with the route lab, an outline check of every actor route end in the iso and 2D poses (4, 10 and 98 ends on the three maps, none off the outline), iso-map.test.ts, bun run check, and the owner's review.
<!-- SECTION:FINAL_SUMMARY:END -->
