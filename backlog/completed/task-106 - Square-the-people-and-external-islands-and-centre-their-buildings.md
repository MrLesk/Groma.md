---
id: TASK-106
title: Square the people and external islands and centre their buildings
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 19:15'
updated_date: '2026-08-22 19:20'
labels: []
dependencies: []
references:
  - sheet
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The people and external islands are shelf-packed columns at least as wide as their own name, so the external island is a 7 by 4 strip whose only building, Git, sits at the west pad with four empty cells beside it. Make both islands squares whose side is the widest of their packed buildings and their name, and centre the buildings on the square, the name keeping its front band, so a lone building sits in the middle of an island a little bigger than itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The people island and the external island are squares: their rect has w equal to d
- [x] #2 The buildings on each of those islands are centred: the free cells west and east of them are equal, and the free cells north and south (the name band included) differ by at most one
- [x] #3 Islands still form one row, keep ISLAND_GAP apart and stay inside the sheet margin; system islands are unchanged; bun run check passes with a fixture test for the square and the centring
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
1. src/sheet/place.ts: a squared(node) step after packing the people and external islands: side = max(w, d), grown by one when the width margins would be unequal; the children shift so the content block is centred on the square.
2. test-bun/sheet-scene.test.ts: a hand-built world with two people and one external system asserts square rects and equal west/east margins.
3. docs/viewers/web/index.md: the islands sentence. Browser check at fit and zoomed on the external island.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented squared() in src/sheet/place.ts after packing the people and external islands: side = max(w, d) of the packed node (the name width already folded into w), plus one cell when the west and east margins would differ; the children shift so the content block is centred on the square, the name keeping its front band. Evidence on the live world (/world.json): island:external is 8 by 8 at (100,17) with Git (2 by 2) at (103,20), three free cells on every side; island:people is 8 by 8 at (4,17) with both 4 by 2 people at gx 6, two free cells west and east, one north and one south; the row still runs people, system, external with ISLAND_GAP between. Tests: new fixture test in test-bun/sheet-scene.test.ts (square rects, equal west/east margins, north/south within one cell, PAD kept); bun run check green (92 node + 120 bun tests). Browser: fit view and a 949% view of the external island with Git in its middle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
People and external islands are now squares with their buildings centred (src/sheet/place.ts squared()), so Git sits in the middle of an 8 by 8 island instead of the west pad of a 7 by 4 strip cut for the island's name. Verified with a fixture test for the square and the centring, the live sheet's rects, and browser views at fit and zoomed; bun run check green.
<!-- SECTION:FINAL_SUMMARY:END -->
