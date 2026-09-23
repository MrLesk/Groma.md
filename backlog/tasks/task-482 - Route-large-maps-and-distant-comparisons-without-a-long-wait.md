---
id: TASK-482
title: Route large maps and distant comparisons without a long wait
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 19:57'
updated_date: '2026-09-23 17:39'
labels: []
dependencies: []
references:
  - relationships
  - web-server
  - scene
modified_files:
  - src/sheet/route-graph.ts
  - src/sheet/route-paths.ts
  - src/sheet/route-order.ts
  - src/sheet/route-nudge.ts
  - src/sheet/route-geometry.ts
  - src/sheet/route-space.ts
  - src/sheet/route.ts
  - src/sheet/route-grid.ts
  - src/sheet/route-search.ts
  - src/sheet/route-spacing.ts
  - test-bun/route-spacing.test.ts
  - src/viewers/web/map-session.ts
  - groma/systems/groma-md/containers/cli/components/relationships.md
  - groma/systems/groma-md/containers/cli/components/route-graph.md
  - groma/systems/groma-md/containers/cli/components/route-paths.md
  - groma/systems/groma-md/containers/cli/components/route-order.md
  - groma/systems/groma-md/containers/cli/components/route-nudge.md
  - src/sheet/route-queue.ts
  - src/sheet/route-lines.ts
  - src/sheet/route-ports.ts
  - test-bun/building-port-attachment.test.ts
  - test-bun/route-lines.test.ts
  - docs/viewers/web/index.md
  - groma/systems/groma-md/containers/cli/components/route-ports.md
  - groma/systems/groma-md/containers/cli/components/route-lines.md
  - groma/systems/groma-md/containers/cli/components/route-queue.md
  - test-bun/route-nudge.test.ts
  - test-bun/sheet-route-space.test.ts
  - docs/viewers/index.md
  - docs/viewers/creating-a-plugin.md
  - src/sheet/route/route.ts
  - src/sheet/route/ports.ts
  - src/sheet/route/graph.ts
  - src/sheet/route/paths.ts
  - src/sheet/route/queue.ts
  - src/sheet/route/lines.ts
  - src/sheet/route/order.ts
  - src/sheet/route/nudge.ts
  - src/sheet/route/finish.ts
  - src/sheet/route/geometry.ts
  - src/sheet/route/space.ts
  - src/sheet/route/checks.ts
  - src/sheet/route/relationships.ts
  - src/sheet/route-finish.ts
  - src/sheet/relationships.ts
  - src/sheet/scene.ts
  - src/sheet/compose.ts
  - src/sheet/measure.ts
  - src/sheet/place.ts
  - test-bun/sheet-shared-transition.test.ts
  - test-bun/sheet-port-matching.test.ts
  - test-bun/sheet-compose.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/route-crossings.test.ts
  - test-bun/route-order.test.ts
  - src/sheet/route/costs.ts
  - groma/systems/groma-md/containers/cli/components/lines.md
  - groma/systems/groma-md/containers/cli/components/route.md
  - groma/systems/groma-md/containers/cli/components/checks.md
  - groma/systems/groma-md/containers/cli/components/costs.md
  - groma/systems/groma-md/containers/cli/components/finish.md
  - groma/systems/groma-md/containers/cli/components/geometry.md
  - groma/systems/groma-md/containers/cli/components/graph.md
  - groma/systems/groma-md/containers/cli/components/nudge.md
  - groma/systems/groma-md/containers/cli/components/order.md
  - groma/systems/groma-md/containers/cli/components/paths.md
  - groma/systems/groma-md/containers/cli/components/ports.md
  - groma/systems/groma-md/containers/cli/components/queue.md
  - groma/systems/groma-md/containers/cli/components/route-relationships.md
  - groma/systems/groma-md/containers/cli/components/space.md
priority: high
type: bug
ordinal: 563000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comparing an old revision with a new one in the web time machine takes about 16 s before the map appears; the owner reported it as very slow. The comparison already reads only its two endpoint commits (git snapshots 0.6 s, all file diffs 0.1 s). The time is route layout. A comparison map holds both worlds, so 9176a68c (2026-09-10) against c9cf7687 draws 233 elements and 172 routes, where c9cf7687 alone has 117 and 59.

Routing that map takes 15.9 s, of which 15.7 s is the untangle pass in src/sheet/route-search.ts. On the same grid of 2.1 million points, the first pass visits 471 thousand search states for all routes (0.1 s) and untangle visits 90.6 million, about 527 thousand per route. Each crossing costs as much as 24 cells of distance, which the distance estimate cannot see, so every re-search floods a wide area around its route.

Measured variants on that pair: no crossing penalty 2.4 s; a quarter of the turn penalty 8.6 s; searching only 12 cells around each first path 9.6 s with 59 routes changed. TASK-430 already pruned searches that cannot beat the first path and found that a turn-aware priority gave no useful gain. The owner suggested letting the map's cell grid guide the pathfinding instead of computing fine points. This sheet is 837 by 426.5 cells, and 64% of today's route corners sit between cells because lanes are 1/8 cell apart.

Plain maps pay the same cost: 9176a68c alone routes in 4 s, and the 572-route large-world test fixture in about 4.4 s. Inside a comparison, opening an unchanged file (/source.json) builds the whole comparison payload again, layout included (sourceSelection in src/viewers/web/map-session.ts).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening the 9176a68c against c9cf7687 comparison in the live web viewer returns its map in under 2 s on the development machine (payload timings total; about 16.5 s before)
- [x] #2 Routes keep relationship direction, building clearance, lane spacing and determinism, and the existing routing tests (crossing reduction, dense routing safety, large-world fixture) pass without changed assertions or timeouts
- [x] #3 The owner approves how routes look on the c9cf7687 map and on the 9176a68c against c9cf7687 comparison after the change
- [x] #4 Opening an unchanged file during a comparison answers without laying out the map again
- [x] #5 Routes sharing a corridor are spread evenly at a comfortable spacing where the corridor has room, instead of packed at the 3-unit minimum
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
Final approach. The dense lane grid and its untangle pass are gone. Routing lives in src/sheet/route/; routeAll in route.ts is its entry, and the rest of the sheet uses only routeAll, mapRelationships (relationships.ts) and the shared units in space.ts.
1. ports.ts: assignFixedPorts spreads each endpoint's ports over the walls that face the other end, balancing crowded sides; portChoices adds, at a building only, the middle of every other clear wall. Ports use the middle half of a wall (PORT_SPAN and portStretch in space.ts); a round building's ports only slide toward the middle.
2. graph.ts: centre lines of the channels between building clearance boxes, a private ray out of every port guard, and a connector line where a ray meets no channel. Each edge knows how many routes fit across it at the least spacing (capacity) and at the bundle spacing (comfort), the lines beside it in a narrow channel, and the line it lies on.
3. paths.ts, with queue.ts and LineRuns in order.ts: an A* search per route, busiest endpoints first, from any open source guard to any open target guard, priced by costs.ts: length, a bend (3 cells), a crossing (5 bends: running straight over another route, or sharing a stretch whose ends alternate), another wall (a quarter bend), crowding past comfort, and overflow only where nothing else fits. One improve pass re-searches every route with the others placed.
4. route.ts drawn(): the paths get their walls; nudge.ts orders the runs on each line by where their routes part (compareOnLine in order.ts) and spreads them into bundles at the bundle spacing, centred on the channel, shrinking toward the least spacing only along chains that do not fit; ports slide within the middle half of their wall.
5. finish.ts: fan ordering, facing alignment and shortcuts, at the search's bend price and never closer than the bundle spacing where routes were not already. checks.ts then makes routing throw if a route crosses a building or shares a run.
6. src/viewers/web/map-session.ts: /source.json and /code.json inside a comparison read both revisions without laying out the map.
Tests: the existing routing tests keep their assertions; route-nudge.test.ts covers the owner's spacing rule (a roomy channel spreads to the bundle spacing, a narrow one shrinks only as far as its walls require); route-order.test.ts covers crossing only where routes meet or part (a staggered bundle is not a crossing, a swap inside a shared corner is).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Progress 2026-09-22 (new router wired into routeAll; old grid router deleted):
- Pipeline: assignFixedPorts, alignFacingPorts (facing walls share a coordinate when the wall has room), routeGraph (channel centre lines plus private port tracks; a public cross line joins a track that meets no channel), RoutePaths (A* with bend, crossing, crowding and hard channel capacity; one improvement pass), nudgeRoutes (neighbour sweep constraints, per-chain spacing that shrinks only where needed, block solver, exact settle), existing finishing passes and safety checks.
- Lab measurements (scratchpad route lab, same placement): c9cf7687 59 routes: 385 ms to about 80 ms; crossings 57 to 76-77; bends 169 to about 151; route length at the 3-unit minimum 938 cells to 0. 9176a68c against c9cf7687, 172 routes: 17.4 s to about 0.8 s; crossings 661 to about 925; bends 747 to about 650; length at the minimum 20,856 cells to about 1,400; building crossings and overlaps 0. 96-route actor-to-system stress case: crossings 1,039 to 464, bends 352 to 184.
- Tests: 92 of 93 routing and map tests pass. Failing: route-crossings.test.ts "routing goes around a crossing when the endpoints have a clear outer path". With the fixed east and west ports the only crossing-free path is a loop around every building; the old router reached it through an eight-bend crossing cost plus shortenEnds moving both ends to other walls. Raising the crossing cost here makes large maps worse and does not fix the test.
- route-spacing.test.ts tested the deleted separateRoutes; replaced by two tests of the owner's spacing rule on nudgeRoutes (a roomy shared channel spreads to BUNDLE_SPACING around its line; a narrow one shrinks only as far as its walls require).

2026-09-23: Owner found lines crowded where too many routes share one channel while other channels around buildings stay free. Crowding cost is now priced per unit length of the crowded stretch and grows with each route beyond the comfortable count (CROWDING = 2), so busy channels send routes around other buildings. Found and fixed a rare overlap: the neighbour sweep can miss two runs that only just share a stretch, so each nudging pass now adds constraints for any runs left closer than the least spacing and solves again. Lab after the change: c9cf7687 crossings 77, bends 154; comparison crossings about 895, bends 648, no building crossings or overlaps; 96-route stress case safe. 93 of 94 routing, map and web revision tests pass; the corner crossing test still waits for the owner's A/B decision. Owner then asked for force-directed placement next (separate task).

2026-09-23 live check (in-process map session on this repository, scanning off, forward comparison 9176a68c against c9cf7687, with TASK-493 placement): /world.json 1,783 to 1,920 ms wall over three runs; server timings architecture load 873 to 962 ms, placement 7 to 12 ms, routing 884 to 926 ms, total 1,765 to 1,900 ms (AC 1 under 2 s, with little margin on a busy machine). /source.json for an unchanged file in that comparison (src/viewers/tui/flow-navigation.ts): 1,347 ms, previously about 16 s because it rebuilt the whole comparison and its layout (AC 4). Architecture records: the scan watcher had created one component per new route file; groma edit relationships --combine route-graph route-paths route-order route-nudge folded them into Map connections.

2026-09-23 owner decision: "B" (routes choose their walls during the search), asked as the best visual solution for the failing corner-crossing test and the higher crossing count; delegated to a fresh implementer agent, supervised in this session.

2026-09-23 option B implemented (walls chosen during the search):
- Ports: route-ports.ts (split out of route-geometry.ts) gives each route end its assignFixedPorts port (preferred, lined up by alignFacingPorts) plus the middle of every other clear wall. A non-preferred wall costs a quarter bend and is open only while it has room: ports that fit its middle half at the least spacing, one on round buildings and on external or round targets. The graph gives every distinct guard one private ray owned by all routes that may use it; RoutePaths searches from every open source guard to any open target guard entered along its ray. Nudging spreads ports that meet at a wall middle.
- Crossing count: the previous exit rule counted every route still on the line where a route left it, including routes that joined later from the same side (a staggered bundle never crosses). With wall choice that phantom cost moved whole parallel bundles to other walls (the parallel-connections test failed at every crossing cost, two bends included). route-lines.ts now counts per shared line: two routes sharing a stretch cross when they keep opposite orders at its two ends, and routes turning a corner together carry their order round it (without the carry the search hid crossings in shared corners: stress case 96 modelled, 916 drawn). Modelled crossings now equal drawn crossings after nudging on c9cf7687 and the stress case.
- Costs: crossing 5 bends (was 2), other wall a quarter bend. The corner test needs every crossing above 312 units: the outer loop in the channel graph is 240 units and one bend longer than the middle path, and leaving both buildings by side walls to cross the other route cleanly in the middle channel is the other alternative. Pricing perpendicular crossings lower (2 bends, shared ones 6) removed all long detours and gave 779 comparison crossings but fails that test. Measured uniform 5 and 6 and several splits; 5 kept routes shortest.
- Speed: bend-aware search estimate (fewest bends to reach a target entry; with crossing cost 0 every one of 744 searches found the same optimum as without it), typed two-array heap (route-queue.ts), per-edge arrays for parallel lines and owners, one load lookup per move, boxes filed in strips for channel room (graph build about 105 to 50 ms).
- shortenEnds kept: without it bends rise (comparison 508 to 523, large-world 671 to 714).
- Lab, same placement, before to after: c9cf7687 crossings 79 to 51, bends 146 to 130, length 4194 to 4277 cells, 79 to 74 ms; comparison 1011 to 508, 609 to 508, 42606 to 44286, 916 to about 970 ms (equal to the old code back to back under the same load); 96-route stress case 375 to 119, 167 to 207, 7698 to 10765; large-world 298 to 133, 777 to 671, 18710 to 19854, about 520 to 490 ms. Map areas unchanged; no building crossings or overlaps.
- Longer detours: routes more than 40 cells longer than straight rise from 1 to 14 on the comparison (worst 80 to 254 cells) and 1 to 6 on large-world (worst 48 to 112); the old grid router on today's placement had 22 (worst 394) and 5 (worst 154).
- The scan watcher created components route-ports, route-lines and route-queue for the new files; not curated in this change.

2026-09-23 supervisor review of the wall-choice change: bun run check exit 0 (705 Bun pass, 43 skip, 0 fail; 16 Node pass); lab reproduces the implementer's numbers (c9cf7687 crossings 51, bends 130; comparison crossings 508, bends 508, crowding 101 cells; stress case crossings 119; large-world crossings 133). Folded the watcher's route-ports, route-lines and route-queue components into relationships with groma edit relationships --combine.

2026-09-23 owner decisions after reviewing wall choice ("yeah looks good"): keep the current crossing price (5 bends, quarter-bend side cost), which passes the corner test with fewer long detours than the old router (comparison 14 routes more than 40 cells over straight, worst 254, against 22 and 394); offer other walls only on buildings, so slabs and islands keep their assigned port and routes stop wrapping across their own target surface. Sent back to the implementer.

2026-09-23 owner decisions: keep crossing 5 bends and the quarter-bend side cost; wall choice only at buildings. route-ports.ts now offers other walls only when the endpoint is a building; slabs and islands keep the port assignFixedPorts gave (after alignFacingPorts). Docs sentence updated. Lab on the same placement, original router to now: c9cf7687 crossings 79 to 51, bends 146 to 130, length 4194 to 4277 cells (unchanged by this step: no slab or island ends); comparison 1011 to 511, 609 to 504, 42606 to 44616; stress case 375 to 380, 167 to 176, 7698 to 8629 (was 119, 207, 10765 with choice on its target island); large-world 298 to 143, 777 to 673, 18710 to 19725. Routes more than 40 cells longer than straight: comparison 18 (worst 245 cells), large-world 7 (worst 112). Large-world crowding under the bundle spacing now reads 530 cells: one pair (merchant to auth, shopper to checkout) runs 4 units apart for 18 cells in the narrow gap between the two stacked actor buildings, and the lab counts each long segment whole. Timing back to back under the same load: comparison 949 ms old, 980 ms new; large-world 561 and 444 ms. bun run check passes.

2026-09-23 subtraction pass (supervisor), each cut measured in the route lab on the same placement:
- Deleted alignFacingPorts (route-ports.ts, with WallPorts and facingPair). Lining up facing ports one at a time before routing scrambled the port order on crowded walls: without it the 96-route stress case drops from 380 crossings to 42 (bends 176 to 228, length 8629 to 7599 cells, crowding under the bundle spacing 3371 to 617 cells). c9cf7687 is unchanged (51 crossings, 130 bends). Comparison: crossings 511 to 519, bends 504 to 495, length 44616 to 44423, crowding 101 to 251 cells. Large-world: crossings 143 to 150, bends 673 to 682, length 19725 to 19662. The alignFacingRoutes finishing pass still draws facing routes straight (the facing-wall tests pass unchanged).
- Deleted the meeting-guards path in RoutePaths (facing ports whose guards coincide). Added for partners one cell apart, which the monotone clean-up in pack-forces.ts no longer produces; a probe showed no test and no lab map reaches it.
- Deleted alignGuardRun in attachWalls: it corrected grid rounding of the deleted router; graph guards are exact and all four lab maps measure identically without it.
- Kept after measuring: every finishing pass (without the fan passes crossings rise, without alignFacingRoutes, shortenDirect or shortenEnds bends rise), the improve pass (without it comparison crossings 511 to 708), busy-endpoints-first order (without it comparison crossings 511 to 578).
- Smaller: clearanceBoxes no longer exported; the Map.groupBy wrapper in route-ports.ts inlined; drawn() names its Box type.
- bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail).

2026-09-23 cold simplicity review (fresh agent, no history) and fixes. Accepted and applied:
- Deleted the repair loop (REPAIRS, reroute, HISTORY, sharedRouteIds). A probe that made reroute throw passed the whole Bun suite and all four lab maps, so no test or map reaches it; the failure it was added for came from a placement bug the monotone clean-up in pack-forces.ts removed. routeAll now draws once and fails loudly on a building crossing or a shared run, as the old router did, and names the relationship id when a route has no path.
- RoutePaths counts routes running straight through each node (node * 2 + axis) instead of every pair of edges (node * 16 + from * 4 + to); only straight-through pairs were ever read.
- Folded attachWalls into drawn() (compactPath already copies), graphOf into routeGraph; nudging builds its constraint links once per solving round and uses BUNDLE_SPACING directly instead of a parameter every caller set to it; Segment.index deleted.
- Clarity: search state helpers (stateOf, nodeOf, headingOf, joinedOf); parents and openLoad documented where they are read; the read of LineRuns.carry explains its order; OTHER_WALL, wallCost and signOf replace three different meanings of side; BEND = ROUTE_UNIT * 3; route-lines.ts and route-order.ts point to each other as the two halves of one ordering rule; runOrder states its sweep-order assumption; the three kinds of nudging Item are named; NARROW, STRIP, the 64-step walk and the 16 shrink rounds explained.
- Tests: the nudging tests moved to test-bun/route-nudge.test.ts (route-spacing.ts is the overlap measure); the dense-connections test no longer says bypass lanes.
- Docs: removed the repair clause and a sentence the new cost sentence repeats; docs/viewers/index.md and creating-a-plugin.md no longer call routes lattice routes on whole cells.
Evidence: sheetScene output (placement and routes) hashes identical before and after on c9cf7687, the comparison, the stress case and four fixtures (large-world, viewer-view, openclaw-view, containers-view); bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail).

2026-09-23 full-context review (general-purpose agent with a written brief and the transcript path; the fork agent type is not available). Verdict: keep the channel router and the force balance; weak spots are ownership and grouping. Owner decision: "all now". Scope added to this task: (1) one folder src/sheet/route/ for the routing files, route-spacing.ts renamed checks.ts; (2) one owner for legality checks (building and route crossing checks move beside the overlap measure) and no second import path for the route-space constants; (3) one middle-half-of-a-wall rule, the round-building comment corrected and centrePorts renamed round; (4) one cost model: finishing passes price bends and keep spacing like the search and nudging, passes that stop changing routes are deleted, and assignFixedPorts' side balancing at buildings is measured; this changes the look and needs the owner's review; (5) open() returns the load instead of leaving it in a field; (6) one home for tuning values per domain, stated in forces.ts; (7) fewer names and copies: Segment folded into Run, one EPSILON, route-lines.ts and route-order.ts merged.

2026-09-23 full-context review items applied with identical output (sheetScene hashes identical on seven worlds after each step; bun run check exit 0, 705 Bun pass, 16 Node pass):
- (1) Routing moved to src/sheet/route/: route.ts (entry, with a header naming what the rest of the sheet may use: routeAll, mapRelationships, space.ts), ports.ts, graph.ts, paths.ts, queue.ts, order.ts, nudge.ts, finish.ts, geometry.ts, space.ts, relationships.ts, checks.ts (was route-spacing.ts), costs.ts.
- (2) checks.ts owns every legality check: crossingRouteIdsFor and routesCross moved there beside sharedPathMeasure; geometry.ts no longer re-exports the space constants, so each has one import path.
- (3) One middle-half rule: PORT_SPAN and portStretch in space.ts, used by portShare and portSpan (ports.ts), the finishing passes (was usableSpan) and portSideCells. Endpoint.centrePorts renamed round; portSpan says a round building's ports slide toward the middle but not away.
- (5) open() in paths.ts returns the load of the move, -1 when closed; the openLoad field is gone.
- (6) Tuning values: route costs in route/costs.ts; forces.ts states that routes have their own costs there.
- (7) route-lines.ts merged into order.ts (one ordering rule for search and drawing; test renamed route-order.test.ts); one EPSILON exported by geometry.ts (finish.ts keeps its 0.01 port tolerance); Segment folded into Run (checks.ts measures overlaps on runsOf).

2026-09-23 item (4), one cost model (changes the look). Finishing passes now price a bend at the search's BEND (3 cells, was 0.75 per point) and may not bring routes closer than the bundle spacing along more length than before (keepsSpacing; sharedPathMeasure takes the spacing it guards). Measured in the route lab against the refactored router: c9cf7687 crossings 51 to 51, bends 130 to 130, length 4277 to 4284 cells, runs closer than the bundle spacing 73 to 0 cells; comparison 519 to 519, 495 to 494, 44423 to 44429, crowding 251 to 145; stress case 42 to 42, 228 to 226, crowding 617 to 617; large-world 150 to 150, 682 to 668, 19662 to 19691, crowding 536 to 0. Every finishing pass still changes routes (large-world: fans 6, facing 178, direct 79, ends 50); without the second fan pass the stress case gains a crossing, so none was deleted. Without assignFixedPorts' side balancing at buildings crossings rise (c9cf7687 51 to 56, comparison 519 to 550, stress 42 to 78), so it stays. finish.ts now uses the shared EPSILON instead of its 0.01 tolerance (output identical on seven worlds). Lab fix: the lab still set Endpoint.centrePorts after the rename to round; corrected before measuring.

2026-09-23 after all review items: architecture records re-curated (the scan watcher emptied relationships and created one component per moved file; the empty lines component was removed and the rest combined into relationships, which now owns the 13 files in src/sheet/route/). Docs: shortcuts keep the bundle spacing. bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail). Live timing on the comparison (in-process map session, scanning off): routing 976 to 1,034 ms as before; total 1,914 to 2,918 ms while other processes held the load average at 12 to 14 (architecture load 931 to 1,877 ms); on the idle machine earlier the same code path totalled 1,827 to 1,924 ms. Opening an unchanged file: 1,432 ms. Finding for the owner, not applied: treating actors as square (no one-arrival-per-wall and no middle-only port span on round buildings) gives c9cf7687 crossings 51 to 50, comparison 519 to 523, stress case 42 to 15 (crowding 617 to 102 cells), large-world 150 to 149.

2026-09-23 finalization evidence. AC 1: final code, comparison /world.json in the in-process map session, ten runs at load average 7.8 (other sessions' Backlog watchers): totals 2,011 to 2,116 ms (routing 1,025 to 1,059 ms, architecture load 966 to 1,042 ms); one earlier run at load 12 totalled 1,914 ms; on the idle machine before the cost-model step, which left routing time unchanged in back-to-back lab runs, totals were 1,827 to 1,924 ms; about 16.5 s before this task. The owner chose to close with these measurements recorded. AC 2: bun run check exit 0 on the combined tree and on the TASK-482 commit alone (703 Bun pass, 16 Node pass); the named routing tests keep their assertions; determinism test in sheet-route.test.ts. AC 3: owner "yes" to the regenerated c9cf7687 and comparison pages. AC 4: /source.json for an unchanged file in the comparison 1,364 to 1,846 ms without layout (about 16 s before). AC 5: route-nudge.test.ts; lab crowding under the bundle spacing 0 cells on c9cf7687 and large-world, 145 on the comparison.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-09-22 20:30
---
Research 2026-09-22 (sources opened by the researching agent; product names left out on purpose).

- Established orthogonal connector routers and recent papers use one split: search a sparse graph built from the obstacle geometry, let routes share runs during the search, then order routes on each shared run and separate them into lanes. Reference numbers: Wybrow, Marriott and Stuckey (GD 2009, https://users.monash.edu/~mwybrow/papers/wybrow-gd-2009.pdf) route 276 connectors among 231 objects on a 52,318-node visibility graph in 38 ms (C++, no crossing penalty). Channel centre-line graphs from an O(n log n) sweep: Hegemann and Wolff (GD 2023, https://arxiv.org/abs/2309.01671). Route ordering on shared runs: Pupyrev et al. (GD 2011, https://arxiv.org/abs/1209.4227).
- Other routers treat crossings as soft: a crossing cost of 1 to 3 bends is typical (Groma uses 8), and crossing reduction reroutes only the connectors with the most crossings.
- Routing on whole map cells is about 6x fewer nodes than the current 2.1 million, predicting about 2.6 s of untangle, and cannot represent the half-cell gaps beside buildings. A channel graph is estimated about 50x smaller (unmeasured).
- Jump point search is not used for connector routing; its gains fade when costs vary (Carlson et al., AAAI 2023, https://pathfinding.ai/pdf/cmhse-aaai23-jpsw.pdf).
- Recommended prototype: keep the first pass; run untangle on a sparse channel graph, then the current fine search only inside a tube 1 to 2 cells wide around the coarse path, keeping the original when the coarse search finds nothing better. First log per-route untangle states to confirm that unchanged routes with unavoidable crossings dominate the 90.6 million states.
- Longer-term option: the full split for both passes (sparse graph, ordered routes per shared run, one-dimensional lane separation). Simplest end state, but routes look different.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the dense lane-grid router with a channel router in src/sheet/route/: routes search a sparse graph of channel centre lines between buildings (bend, crossing, other-wall and crowding costs; walls chosen at buildings), then nudging spreads routes sharing a channel into bundles a third of a cell apart, shrinking only where a channel is narrow, and the finishing passes use the same bend price and never undo that spacing. Opening a file inside a comparison no longer lays out the map. The 9176a68c against c9cf7687 comparison went from about 16.5 s to 1.8 to 2.1 s (routing about 1 s; the rest is loading both revisions), with crossings 661 to 519 and crowding under the bundle spacing near zero on c9cf7687 and large-world. Verified with bun run check on the commit alone, the route lab, live timing and the owner's review of both maps.
<!-- SECTION:FINAL_SUMMARY:END -->
