---
id: TASK-134
title: Keep a corridor clear behind a tall building
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 13:36'
updated_date: '2026-08-23 13:56'
labels: []
dependencies: []
references:
  - sheet
  - iso-map
modified_files:
  - src/sheet/grid.ts
  - src/sheet/route.ts
  - src/sheet/place.ts
  - test-bun/sheet-route.test.ts
  - test-bun/sheet-scene.test.ts
  - docs/viewers/web/index.md
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A building's roof is drawn lifted up the screen, so it hides the ground behind it, toward smaller gx and gy: the north and west sides. GAP is measured on the ground plan and ignores that occlusion, so behind a tall building the visible corridor is narrower than GAP and an arrow has no room; in this repository's world the route from Scanner plugin (3.5 floors) to Typescript files starts a quarter cell from its neighbour and crowds. A building should claim, on its north and west, the ground its roof hides, so its neighbours there stand further away in proportion to its height while its south and east neighbours do not move.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A building's north and west neighbours stand further from it in proportion to its floors; its south and east neighbours keep the usual gap
- [x] #2 Behind every building the corridor holds enough visible ground for a route to leave it and reach its neighbour, measured over this repository's world and the fixtures
- [x] #3 Footprints, origins and the drawn buildings, routes and pin anchors keep using the real footprint, and placement stays deterministic
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
1. src/sheet/grid.ts: ROOF_SHADOW moves here from route.ts (two consumers now, and it is sheet geometry, not routing policy), with CLEAR and shadeOf(floors) = max(0, ceil(floors * ROOF_SHADOW + CLEAR - GAP)).
2. src/sheet/place.ts packed(): a building takes its shade into the packing (w and d grow by it) and stands that far inside what it claimed, so pack.ts stays a plain rectangle packer and only north and west neighbours move.
3. src/sheet/route.ts imports ROOF_SHADOW from grid.ts; test-bun/sheet-route.test.ts follows.
4. test-bun/sheet-scene.test.ts: no sibling stands within a building's roof shadow plus the cell an arrow needs.
5. docs/viewers/web/index.md: the placement paragraph.
6. Measure before and after: corridors behind buildings, sheet size, route length and bends.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured on this repository's own world, before and after: corridors behind a building with under one cell of visible ground 11 to 0 (5 of them carried a route; the worst was 0.25 cells, Scanner plugin at 3.5 floors), sheet 94x75 to 96x84 cells, route length 1013 to 1059 cells, bends 98 to 93, sampled route length hidden behind buildings 9% to 7% with no fully hidden route. Both fixtures are byte-identical, since every building in them is one floor. 14 of 44 buildings claim the extra cell, and because growth placement re-solves from the new sizes, 31 of 44 moved within their surface, most by a cell. Review applied: a local behind(child) helper instead of a Map, the test guard reads shadeOf(floors) > 0 and only counts pairs behind a shaded building, ROOF_SHADOW and CLEAR carry their derivations, and the dead Math.max is gone (floorsOf never returns under 1). The new test fails against the previous placement and passes with this one. Validated in a worktree of HEAD plus only this task's files (92 node, 138 bun): the shared tree's check is red from another agent's in-flight WorkSnapshot refactor, which this task does not touch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A roof is drawn lifted up the screen, so it hides half a cell of ground per floor to its north and west, which GAP never accounted for. A building now claims that ground: shadeOf(floors) = ceil(floors * ROOF_SHADOW + CLEAR - GAP) extra cells, where CLEAR is the one cell an arrow needs to leave one building and enter the next. place.ts widens a building's packing item by its shade and stands it that far inside the claim, so pack.ts stays a plain rectangle packer and only north and west neighbours move. Every corridor behind a building now shows at least one cell of ground (was 11 too tight, 5 of them routed), at the cost of a slightly larger sheet and 4.5% more route length, with fewer bends. Verified by measurement over this repository's world, byte-identical fixtures, and a placement test that no sibling stands in another's roof shadow.
<!-- SECTION:FINAL_SUMMARY:END -->
