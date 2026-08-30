---
id: TASK-159
title: Compare libavoid and MSAGL routing on production placement
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-23 20:27'
updated_date: '2026-08-24 17:57'
labels: []
dependencies: []
modified_files:
  - layout-comparison/package.json
  - layout-comparison/bun.lock
  - layout-comparison/src/types.ts
  - layout-comparison/src/model.ts
  - layout-comparison/src/geometry.ts
  - layout-comparison/src/cola-avoid.ts
  - layout-comparison/src/msagl.ts
  - layout-comparison/src/render.ts
  - layout-comparison/src/server.ts
  - layout-comparison/tsconfig.json
  - layout-comparison/test/geometry.test.ts
  - layout-comparison/test/model.test.ts
  - layout-comparison/src/avoid.ts
  - layout-comparison/src/manhattan.ts
  - layout-comparison/test/manhattan.test.ts
  - layout-comparison/test/msagl.test.ts
type: spike
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can inspect the current Groma architecture through two isolated routing pipelines on the exact production semantic placement and compare visual clarity, obstacle avoidance, performance, and integration cost before either router is adopted by the production viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Starting the comparison serves Groma plus libavoid at http://localhost:4141 and Groma plus MSAGL corridor routing at http://localhost:4242
- [ ] #2 Both pages render the same normalized architecture elements and the exact production semantic placement while using their named external routing engines
- [ ] #3 Routes avoid the complete projected visible area of isometric buildings and retain directed arrowheads and fixed ports
- [ ] #4 Each page reports placement, routing, building-crossing, and route-conflict diagnostics
- [ ] #5 The comparison does not modify or depend on Backlog work data and does not replace the production web layout
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the exact production semantic placement for both comparison views.
2. Route libavoid in the canonical flat map with fixed ports and complete height-swept polygon obstacles.
3. Route MSAGL in the same canonical flat map with the same fixed ports and polygon obstacles.
4. Let the comparison renderer alone project completed routes into the isometric web view.
5. Report equivalent placement, routing, building-crossing, and route-conflict diagnostics and verify both live views.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built an isolated comparison package that reads loadAnnotatedArchitecture directly, so it has no ELK or Backlog dependency and does not touch the production viewer. Both engines recursively place the same semantic hierarchy and route the same current 44 leaf buildings and 56 relationships.

Live servers: Cola plus Avoid on :4141 and MSAGL on :4242. Five cold runs produced median model/place/route times of 26.5/56.6/28.0 ms for Cola plus Avoid and 25.9/18.2/45.4 ms for MSAGL. The height-swept silhouette validator reports 0 crossings for libavoid and 4 MSAGL fallback routes; the MSAGL page paints those routes red.

Verification: comparison TypeScript check passes; two concurrent geometry tests pass; both /health endpoints respond; Browser QA found no console warnings/errors; wheel zoom changes the SVG view and double-click restores the initial fitted view.

Restored the production semantic geography in the comparison: actor roots share a visible Actors island in the west, internal system roots stay in the centre, and external roots share a visible External systems island in the east. Both engines still independently place contents inside those fixed areas. A focused test verifies containment and projected west-to-east order. TypeScript and 3 concurrent tests pass. Live Browser QA on :4141 and :4242 confirms both labels and all 44 buildings/56 arrows, no console warnings or errors, and zoom/reset. Current live results: Cola 58.1 ms placement, 45.1 ms routing, 0 crossings; MSAGL 24.1 ms placement, 51.2 ms routing, 1 crossing.

Final semantic-parity pass uses one shared domain shell for both candidates: Actors is a compact square island west, Groma is central, External systems is a compact square island east, authored groups remain visible zones, and outside-fed children are forced to the west before an engine places siblings. Actor and external buildings use curved footprints; containers use slab surfaces; routes retain arrowheads and description tooltips.\n\nThe final native engine choices are WebCola stress placement plus libavoid orthogonal routing, and MSAGL MDS placement plus its rectilinear router. Hard flow-rank columns and MSAGL layered layout were rejected because they produced long strips unlike the production map. A second Cola compaction pass was removed because it reduced area only slightly, worsened the aspect ratio, and added redundant placement logic. A four-cell seed experiment also produced a long strip and was reverted.\n\nFinal live evidence on the current 51-element model (44 leaf buildings, 56 routes, 5 zones): Cola is 141.5 x 178.5 cells with a 101.3 x 170.5 Groma surface and 0 visible-building crossings; MSAGL is 261.2 x 143.7 cells with a 221.0 x 135.7 Groma surface and 2 crossings. Production is 99 x 110 cells with a 64 x 102 Groma surface. Current cold diagnostics are model/place/route 32.6/52.0/38.5 ms for Cola and 40.7/14.5/53.8 ms for MSAGL. Both pages show the required west/centre/east geography, equivalent semantic content, zones, shapes, arrows, tooltips, and timings. Browser QA found no console errors.\n\nVerification: bun run typecheck passes; 5 concurrent tests pass with 16 assertions. The tests cover semantic island geography and containment, production flow-rank delivery to each engine, visible authored zones, full height-swept obstacle geometry, and crossing detection. Acceptance criterion 3 is not yet satisfied for MSAGL because its native router still produces 2 crossings, so the task remains In Progress for human review rather than being marked done.

Architecture correction: generic graph placement was removed after it could not match Groma's compact business layout. Both pages now reuse the pure production placeWorld result as the single semantic authority and compare only external routing. The task and thread were renamed to reflect this. WebCola and its dependency were deleted. The converter also consumes production floors and shape decisions directly rather than remeasuring them.\n\nThe routing candidates are now Groma plus libavoid orthogonal routing at :4141 and Groma plus MSAGL's constrained-Delaunay corridor router at :4242. The corridor router is the game/navigation-mesh approach: buildings are exact six-point height-swept obstacles and paths use free-space corridors. Both routers receive the same fixed Groma ports. A shared port planner rejects departure sides blocked by a foreign visible building.\n\nAn engine-neutral validator now reports both foreign-building crossings and route-to-route conflict pairs. On a stable 66-element snapshot, tuned libavoid and MSAGL corridor both reached zero building crossings; repeated warm medians were 21.2 ms for libavoid and 12.6 ms for MSAGL. Route conflicts were 178 and 185 respectively, versus 84 for the production A* router, while production routing took about 2.63 s. Higher libavoid crossing penalties, wider nudging, native graph placement, MSAGL rectilinear routing, polygon/rectangle variants, and a two-router greedy ensemble were tested and rejected because they did not materially improve clarity or caused regressions.\n\nThe shared architecture changed repeatedly during verification as another fork edited the map: observed elements changed 51 -> 66 -> 63 and production dimensions changed with them. On the latest 63-element live snapshot, each external router has one different foreign-building crossing (libavoid relationship:13 through observed:create; MSAGL relationship:14 through observed:page), and the page paints it red. A validator-driven repair/reroute pass would make building avoidance invariant across changing snapshots, but that is fallback behavior and requires explicit approval under project delivery boundaries. TASK-159 therefore remains In Progress and acceptance criterion 3 is not yet met.\n\nVerification after cleanup: bun run typecheck passes; 6 concurrent tests pass with 17 assertions. Browser QA reports no console errors. Tests cover exact semantic-placement conversion, west/centre/east containment, authored zones, full height-swept obstacle geometry, building-crossing detection, route-conflict measurement, and blocked-port side rejection.

Follow-up on the latest valid 58-element / 57-route snapshot: aligning port-side validation with libavoid's 12 px obstacle margin fixed libavoid's remaining crossing. Groma plus libavoid now reports 0 building crossings, 189 route conflicts, and 28.0 ms cold routing on :4141.\n\nMSAGL corridor remains at 1 building crossing (relationship:56, World loader -> Architecture reader, grazing Architecture watch), 149 route conflicts, and 16.2 ms routing on :4242. Global corridor padding 0/1/2/3/6, extra mesh headroom, exact polygons in both windings, conservative bounding rectangles, fixed ports, and faithful curve conversion were checked. Conservative rectangles reduce conflicts but increase building crossings; no single global MSAGL configuration tested satisfies full visible-building avoidance on the latest dense aligned case. A per-route validated alternative remains the smallest known way to enforce the invariant, and still requires explicit approval as fallback behavior.

Screen-space MSAGL rectilinear experiment: 56 routes in about 72 ms on the current 51-element map. It produces 138 route conflicts and 25 visible-building crossings. Native rectilinear routing therefore achieves the requested screen angles but currently violates the building-avoidance invariant; the comparison keeps these routes red and visible at :4242 rather than masking the failure.

Canonical flat-map MSAGL revision: native rectilinear routing was tested directly against the exact six-point height-swept polygons, both polygon windings, fixed ports, and the smallest stable padding. Zero padding breaks MSAGL port entrance construction, 12 px padding crashes its overlapping-obstacle tree, and 1 px runs but produces 15 foreign-building crossings on the real map.

The accepted comparison pipeline therefore uses MSAGL routeCorridorEdges for the polygon-safe navigation corridor, followed by one deterministic Manhattan legalizer in the same flat coordinate system. The existing renderer alone projects the completed routes into isometric space. Current 51-element / 56-route evidence: MSAGL 31.6 ms, 0 building crossings, 193 route conflicts; libavoid 26.8 ms, 0 building crossings, 161 route conflicts. Seven concurrent tests pass with 19 assertions. Browser QA confirms 56 arrowheads, no red routes, no console warnings/errors, and working wheel zoom at :4242.
<!-- SECTION:NOTES:END -->
