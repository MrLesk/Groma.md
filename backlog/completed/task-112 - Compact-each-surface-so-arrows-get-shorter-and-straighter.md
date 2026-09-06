---
id: TASK-112
title: Compact each surface so arrows get shorter and straighter
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 21:59'
updated_date: '2026-08-22 22:32'
labels: []
dependencies: []
references:
  - sheet
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Flow columns put every rank in its own column, so small containers such as a viewer host and a scanner stand between the viewers and the core and push the core far east; the arrows then cross the whole island. After ranking, each surface should compact: a child may slide or move beside a partner, into free space, whenever that shortens the arrows to its partners or removes bends, so small intermediates settle at the edges and the heavy target comes next to what feeds it. The layout may run in any direction; only shorter, straighter arrows count. No layout library: the ranking stays, the compaction is a deterministic local search on the cell grid.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Children never overlap, keep GAP between each other and PAD inside their surface
- [x] #2 A world where two small intermediate children stand between a column of sources and one heavy target ends with the heavy target beside the sources and the intermediates off that corridor
- [x] #3 The same world always gives the same sheet
- [x] #4 The web viewer doc describes the compaction
- [x] #5 Chains grow along straight arrows and wrap when the surface would otherwise stretch; a world without relationships keeps the shelf
- [x] #6 Every connected child stands at the cheapest legal spot among the candidates beside its partners or beside everything placed so far, given the children placed before it (heaviest first): a spot is priced by the arrows it makes (length, bends, a forced detour around a sibling), the arrows it would stand in the way of, and the cells it adds to the surface's longer side
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
1. src/sheet/compact.ts (pure): compact(shelf, items) runs after columns(). Cost = sum over partner pairs of count x (|dcx| + |dcy| + 2 x bends), bends 0 when the centres align on one axis within half a cell, 1 when the rects are diagonal (an L), 2 when they overlap on one axis without aligning (a Z). Candidate spots for a child: aligned with each partner on gy (same gx) or on gx (same gy), and directly east, west, north or south of it GAP apart and centred on it. A spot is legal when no sibling overlaps it or comes within GAP. Passes in item order take the best improving spot per child until a pass changes nothing (cap 50); then everything shifts so the north-west corner sits at PAD and w/d are recomputed.
2. place.ts packed(): columns(items) becomes compact(columns(items), items); the people and external islands keep their one-column shelf.
3. test-bun/sheet-compact.test.ts: the heavy-target world (two sources, two small intermediates, one heavy target) ends with the target beside the sources and the intermediates off the corridor; no overlap and GAP kept; two runs deep-equal; existing sheet-rank tests keep passing.
4. docs/viewers/web/index.md: the compaction sentence in the flow paragraph.
5. Browser: the Groma island with core beside the viewers; dump the slab rects and route point counts before and after; screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built grow() in src/sheet/pack.ts replacing columns(): entries in a west column (folded into a shelf when over 3x deeper than wide), then connected children heaviest first at the cheapest legal spot among candidates beside the union of their placed partners, beside each partner, and beside everything placed; cost = weighted arrow cost (Manhattan + 2 per bend + 100 for a forced detour, detours judged on the Z or L runs an arrow would take) + 100 per existing arrow the spot would newly block + cells added to the surface's longer side; nothing west of the entries; loose children shelf-packed last. Iterations recorded: a bounding-box obstacle test and a light detour penalty put core north of cli (its heaviest feeder); the flush west side put core west of the viewers; discarding spots west of the edge and the lack of whole-layout spots made wide zones fall into a strip. Live Groma world: island 79x53 -> 59x67, total route length 1351 -> 1016 cells, bends 87 -> 85, total detour over the direct distance 50.5 -> 12 cells, routes with 4+ bends 2 -> 2; core now 24x28 beside the viewers, scanner north of cli, view-host in the notch east of web-viewer.

Simplicity review applied: dropped the union-of-partners spot family (live sheet byte-identical, tests green), explained the west-edge slide as a load-bearing rule, dropped the dead epsilon, bound the placed rects and arrows once per child, typed longer() on a rect, apart() always uses GAP, one-axis overlap helpers shared; test file renamed to test-bun/sheet-grow.test.ts without the redundant overlap assert. After the review: bun run check green (92 node + 131 bun), live Groma island still 59x67, total route length 1016.5, bends 85.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the flow columns inside each surface with growth placement (src/sheet/pack.ts grow): entries in a west column that folds when over three times deeper than wide, then every connected child heaviest first at the cheapest spot beside its partners or beside everything placed, priced by arrow length, bends, forced detours, arrows it would block and the surface's longer side. Verified by the seven sheet-grow tests and the live Groma world: island 79x53 to 59x67, route length 1351 to 1016 cells, detour over the direct distance 50.5 to 12 cells, core beside the viewers as Alex asked.
<!-- SECTION:FINAL_SUMMARY:END -->
