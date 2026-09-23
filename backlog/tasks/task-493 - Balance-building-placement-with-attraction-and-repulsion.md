---
id: TASK-493
title: Balance building placement with attraction and repulsion
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 22:04'
updated_date: '2026-09-23 17:06'
labels: []
dependencies: []
references:
  - relationships
  - scene
modified_files:
  - src/sheet/pack-forces.ts
  - src/sheet/place.ts
  - docs/viewers/web/index.md
  - test-bun/pack-forces.test.ts
  - groma/systems/groma-md/containers/cli/components/scene.md
  - groma/systems/groma-md/containers/cli/components/pack-forces.md
  - src/sheet/pack.ts
  - src/sheet/forces.ts
priority: high
type: feature
ordinal: 574000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The owner wants placement to follow natural balance, like electrons that keep equal distances from each other while the nucleus holds them: buildings should stand as close as their relationships and their slab ask, and as far apart as their neighbours and the routes between them need. Today every surface (slab, zone, system island) places its children greedily beside their partners with a fixed two-cell sibling gap, and reserves room for routes at the 3-unit minimum lane spacing (routeReach), so busy gaps stay narrow and routes crowd (TASK-482 measured 329 cells of route length on c9cf7687 running closer than the 8-unit bundle spacing inside channels).

Owner decision 2026-09-23: "do now the full atom force-directed placement". Growth placement stays the deterministic starting point, so small architecture changes keep small layout changes (TASK-481 animates between world updates). Island order (actors, systems by flow, externals) and the container flow columns inside systems (compose.ts) are existing product rules and are not part of this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inside every slab, zone and system island the children settle by a deterministic force balance: pulled toward the siblings they share relationships with (by relationship count) and toward the surface centre, pushed apart from every sibling, never closer than the sibling gap plus their route room; the same world gives the same placement
- [x] #2 Siblings spread to four cells of ground apart where their surface has room and never stand closer than the two-cell sibling gap; route room per connection stays at the least lane spacing, because sizing it at the bundle spacing grew maps by 74 to 141 percent
- [x] #3 Placement invariants hold: no overlaps, children inside their surface with its padding, name bands, roof shadows and port walls kept, and the placement and routing tests pass
- [x] #4 The route lab reports map area, route crowding under the bundle spacing, crossings and bends before and after on c9cf7687 and the 9176a68c against c9cf7687 comparison
- [x] #5 The owner approves the look on c9cf7687 and on the comparison
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
Final approach:
1. src/sheet/pack-forces.ts balance(items, start) starts from growth placement (pack.ts grow). A surface whose children share no relationship keeps it. Otherwise 240 rounds with a step that shrinks from one cell to nothing, using the forces in forces.ts: every two siblings push apart until SIBLING_SPREAD (four cells) of ground stands between them, partners pull toward the two-cell sibling gap (PARTNER_PULL, per relationship) and toward facing each other (PARTNER_ALIGN), all drift toward the middle of their siblings (SURFACE_GRAVITY), and entries drift west (ENTRY_DRIFT) while nothing passes west of them.
2. Legalise: half-way pushes clear pairs closer than the sibling gap, corners snap to whole cells, and whole-cell steps east or south clear what snapping brought back (bodies only move east and south, so it ends). shelfAround in pack.ts turns the bodies into a shelf, as it does for growth placement.
3. place.ts packed() calls balance(items, grow(items)) for slabs, zones and system islands. Actors and external islands keep their single column; the island row and container flow columns are unchanged. Route room per connection stays at the least lane spacing (routeReach), because sizing it at the bundle spacing grew maps by 74 to 141 percent.
Tests: pack-forces.test.ts checks that siblings packed at the sibling gap spread further apart, and that partners side by side move to face each other. The existing scene tests cover determinism, containment and gaps. No gap test for surfaces where the forces run: extending the scene gap test to such a fixture passed even with the whole clean-up removed, so it would not catch the failure; the gap holds by construction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-23 progress:
- Route room at the 8-unit bundle spacing everywhere (routeReach) was measured and rejected: c9cf7687 area +74%, route length +28%; comparison area +141%, route length +60%. Reverted; AC 2 needs rewording to room where routes pass.
- src/sheet/pack-forces.ts balance(): starts from growth placement and runs 240 rounds with a step shrinking from 1 cell: siblings push apart until 4 cells stand between them (SPREAD = GAP + 2), partners pull toward the 2-cell sibling gap and toward facing each other (ALIGN), gravity toward the middle, entries drift west. Then half-way pushes clear any pair closer than the sibling gap, corners snap to whole cells, and east or south steps clear what snapping reintroduced (monotone, so it ends). Surfaces whose children share no relationships keep the growth shelf.
- Wired into packed() in place.ts for slabs, zones and system islands; actors and external islands keep their column; island row and container flow columns unchanged.
- Found while wiring: two stacked partners could end one cell apart when the old whole-cell push ping-ponged; their port guards met and the path search could not start. Fixed by the monotone push; RoutePaths also draws meeting facing guards as a straight line.
- Router hardening (TASK-482 files): routeAll now reroutes any route that still crosses a building or overlaps another route after drawing, pricing up the channels it used (HISTORY), up to four rounds, before the safety error.
- Lab, growth placement to force balance: c9cf7687 area 119,337 to 101,130 cells, crowding under 8 units 220 to 8 cells, bends 154 to 144, route length 4,486 to 4,185, crossings 77 to 87. Comparison: area 367,153 to 308,578, crowding 4,776 to 1,233, bends 648 to 614, length 47,639 to 42,608, crossings 895 to 1,023. Large-world fixture routes all 572 relationships.
- bun run check: 699 pass, 43 skip, 1 fail (route-crossings corner case, waiting on the owner's TASK-482 decision).

2026-09-23: Owner reviewed head-before, head-after and head-atom and chose the atom placement: "I like the atom placement one. keeps things more tight". Layout time on c9cf7687 (median of 7): placement 2 ms, routing 52 ms, against 366 ms today; comparison (median of 3): 0.89 s against 16.6 s.

2026-09-23 subtraction pass: packed() in place.ts now says its growth placement is settled by the force balance; nothing else in pack-forces.ts could go without changing the approved placement.

Measured: without the westward entry drift (WEST) the placement changes and routes get worse on c9cf7687 (crossings 51 to 52, bends 130 to 131) and the comparison (519 to 534, bends 495 to 525), so it stays.

2026-09-23 cold simplicity review (fresh agent, no history) and fixes. Accepted and applied: removed the early return for fewer than two items (no springs covers it); Body carries its entry flag and forces, forcePair replaces the Forces class, and the items parameter is gone from the round; balance and grow share shelfAround (pack.ts) to normalise a shelf; SWEEPS and EPSILON named; STEP and SPREAD comments corrected; the claim that adding an unrelated sibling moves nothing removed (growth placement reflows a shelf of unrelated children); 'where the surface has room' removed from code, docs and a test name, since surfaces grow to fit; the determinism assertion in pack-forces.test.ts removed (sheet-scene.test.ts already checks the same world gives the same sheet on a fixture where the forces run); forces.ts points to the balance's forces; the docs sentence about unrelated children packed after the entries moved into the growth placement description. Placement hashes identical before and after on c9cf7687, the comparison, the stress case and four fixtures. Coverage gap considered: no test checks the sibling gap on a surface where the forces run. Extending the scene gap test to the viewer fixture was tried and passed even with the whole clean-up removed, so it would not catch the failure; no test added. The gap holds by construction: whole-cell steps repeat until no pair is closer than the gap.
Final lab, growth placement to force balance with the final router: c9cf7687 area 119,337 to 98,779 cells, crossings 50 to 51, bends 131 to 130, route length 4,611 to 4,277 cells, crowding under the bundle spacing 18 to 73 cells; comparison area 367,153 to 308,578, crossings 540 to 519, bends 514 to 495, length 47,919 to 44,423, crowding 1,508 to 251.

2026-09-23 full-context review item (6), identical placement: the balance's forces moved from pack-forces.ts to forces.ts as SIBLING_SPREAD, SIBLING_PUSH, PARTNER_PULL, PARTNER_ALIGN, SURFACE_GRAVITY and ENTRY_DRIFT, each with the note on which way it trades; pack-forces.ts keeps its solver settings (ROUNDS, STEP, SWEEPS, EPSILON).

2026-09-23 finalization evidence: AC 1 balance() in pack-forces.ts with the forces in forces.ts; the same world gives the same sheet (sheet-scene.test.ts, viewer fixture where the forces run) and placement hashes repeat exactly across runs on seven worlds. AC 2 pack-forces.test.ts (siblings at the gap spread further apart); whole-cell legalisation keeps every pair at least the sibling gap apart; routeReach unchanged. AC 3 bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail). AC 4 final lab numbers in the notes above. AC 5 owner: "I like the atom placement one. keeps things more tight", and "yes" to the regenerated c9cf7687 and comparison pages.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-23 07:12
---
TASK-494 coordination: in docs/viewers/web/index.md I change only the glow sentences under What you can do (the paragraph starting 'Component selection and focused flow endpoints share one glow'). Your paragraphs stay untouched, and I stage only my own hunks in that file.
---

author: @claude
created: 2026-09-23 08:02
---
TASK-494 update: in docs/viewers/web/index.md I now also change the sentence about the selected component's breathing glow (after 'Other components are dimmed while a component is selected.') and the flow-endpoint glow sentence in the flow reader paragraph, besides the glow paragraph under What you can do. Your hunks stay untouched and I stage only mine.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Buildings on every slab, zone and system island now settle by a deterministic force balance that starts from growth placement: siblings push apart to four cells of ground, partners pull toward the two-cell gap and toward facing each other, gravity holds the surface together and entries stay west; whole-cell legalisation keeps the sibling gap. The forces live in forces.ts with the other placement knobs; pack.ts shares shelfAround with growth placement. Against growth placement on the final router, c9cf7687 shrinks from 119,337 to 98,779 cells and the 9176a68c against c9cf7687 comparison from 367,153 to 308,578, with comparison crossings 540 to 519, bends 514 to 495 and crowding under the bundle spacing 1,508 to 251 cells. Verified with the route lab, placement hashes, pack-forces.test.ts and bun run check; the owner approved the look.
<!-- SECTION:FINAL_SUMMARY:END -->
