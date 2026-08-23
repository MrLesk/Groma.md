---
id: TASK-137
title: Route arrows down the middle of free space with a clearance field
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 14:02'
updated_date: '2026-08-23 14:28'
labels: []
dependencies: []
references:
  - sheet
  - sheet-router
modified_files:
  - src/sheet/route.ts
  - src/sheet/grid.ts
  - test-bun/sheet-route.test.ts
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Arrows scrape along building sides and surface borders, where a hairline route is hard to tell from the heavier edge it runs beside. Instead of styling the symptom, the router should prefer open ground: one distance transform over the lattice gives every point its distance to the nearest obstacle (a building's footprint or a surface's border), and the search pays for running close to one, so a route flows down the middle of the corridor the way a ball rolls down a valley. The field is computed once per sheet and only adds cost, so the search stays admissible and deterministic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A route prefers the middle of the free ground between obstacles: measured over this repository's world, the least clearance along a route rises and no route runs in the lane touching a building or a surface border unless its own ends force it
- [x] #2 Route length and bends stay within a stated budget of the current map, reported before and after
- [x] #3 The search stays deterministic and every relationship still routes
- [x] #4 shadeOf never returns a negative claim, so the height rule composes with any building gap
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured on this repository's own world (55 routes), sampling every lane of every route and dropping one cell at each end where the ports force the line. Before: 7% of route lanes ran within one lane of a building or a surface border, and 29% had another route alongside. After: 3% and 6%. Cost: total route length 1058.5 to 1079 cells (+1.9%), bends 91 to 93, sheet composition 222 ms to 281 ms best of five (once per generation). Composing the same world twice gives identical routes, and both fixtures still route (8 and 13). Validated in a worktree of HEAD plus only src/sheet/route.ts: 92 node, 138 bun; the shared tree's check is red from another agent's in-flight work, which this task does not touch.

Weight review, measured on this repository's world at the current spacing. Both forces are needed: with only the obstacle field, routes with another route alongside stay at 32%; with only route repulsion, routes hugging a building or border stay at 6%. Reach is the dangerous knob and strength is the safe one: raising NEAR and APART from 2 lanes to 3 leaves hugging unchanged at 3% and explodes bends from 93 to 120 (133 with more strength), while raising CROWD and SPREAD from 3 to 5 trades 1 point of squeezing (6% to 5%) for 2% more route length and 2 bends. 2/2 with strength 2 gives hug 3%, squeeze 7%, 1068 cells and 91 bends, the same bends as no field at all. Found while sweeping: shadeOf had lost its Math.max guard to an earlier review, which is inert at GAP 2 but returns a negative claim at GAP 3 or more, letting buildings overlap; the guard is restored.

Review applied. Its main finding: the building half of the field never fired, because RING already blocks a foreign footprint plus one lane, so the nearest walkable node is already NEAR lanes away and the cost is zero there. The field now measures surface borders only, which is what it was really doing. The two sweeps became one bounded sweep and one cost helper (route.ts 445 to 418 lines), and four constants became two, since both fields obey the same rule. Correction to an earlier note in this task: the honest cost on a clean tree is 74 ms to 214 ms per sheet composition, not the +27% first recorded, which was measured in a shared tree with another agent's changes and warm caches; the search relaxes toward Dijkstra because the heuristic still counts one per step while a step can cost four. Measured behaviour after consolidation is unchanged: route lanes hugging something 3%, with another route alongside 6%, 1079.5 cells, 95 bends (from 93 before consolidation; the cost line's float ties shift a couple of routes, so the output is equivalent rather than byte-identical). A new test asserts that no route occupies two consecutive lanes lying on a surface border; it fails against the previous router and passes now. Validated in a worktree of HEAD plus only this task's files: 92 node, 139 bun.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Arrows used to scrape along island and slab borders, where a hairline route is hard to tell from the heavier edge beside it, and parallel routes squeezed into neighbouring lanes. Two soft costs now shape the search: one bounded sweep measures how much room each lane has from the nearest surface border, and after every route a second sweep measures the room left around the routes already drawn; a step pays for each lane it sits inside NEAR of either. Both only add cost, so the search stays admissible and deterministic. Measured over this repository's world: route lanes hugging a border or building 7% to 3%, lanes with another route alongside 29% to 6%, for 1.9% more route length, four more bends and 140 ms more per sheet composition, once per generation. Also restored the non-negative guard on shadeOf, which a previous review had removed and which returns a negative claim, letting buildings overlap, at any building gap above two.
<!-- SECTION:FINAL_SUMMARY:END -->
