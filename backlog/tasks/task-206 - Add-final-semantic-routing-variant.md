---
id: TASK-206
title: Integrate composed flow into the shared map
status: Done
assignee:
  - '@codex'
created_date: '2026-08-28 23:03'
updated_date: '2026-08-29 21:26'
labels: []
dependencies: []
references:
  - sheet
  - sheet-router
modified_files:
  - layout-comparison/src/semantic-routing.ts
  - layout-comparison/src/types.ts
  - layout-comparison/src/server.ts
  - layout-comparison/test/semantic-routing.test.ts
  - layout-comparison/src/composed-flow.ts
  - layout-comparison/src/render.ts
  - layout-comparison/test/composed-flow.test.ts
  - package.json
  - bun.lock
  - src/sheet/compose.ts
  - src/sheet/place.ts
  - src/sheet/route-geometry.ts
  - src/sheet/route-spacing.ts
  - src/sheet/route-lanes.ts
  - src/sheet/route.ts
  - src/sheet/scene.ts
  - test-bun/sheet-grow.test.ts
  - test-bun/sheet-compose.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/sheet-port-layout.test.ts
  - src/sheet/port-layout.ts
  - src/sheet/forces.ts
  - src/sheet/grid.ts
  - src/sheet/types.ts
  - test-bun/sheet-scene.test.ts
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
  - test-bun/iso-map.test.ts
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens groma web or groma view, the shared sheet builder shows the visually approved Composed flow map: component relationships are lifted into weighted container links for placement, every authored relationship remains an individual directed route, and one Libavoid pass plus deterministic lane refinement replaces the slow lattice search. The production map retains its existing Web and TUI interaction behavior, while the isolated layout-comparison prototype and its architecture records are removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web and TUI consume one shared composed sheet whose weighted container graph is derived from authored component relationships without requiring container-level relationships
- [x] #2 On the current Groma world, actors and CLI remain west, Web and Terminal remain entry surfaces, View host and Scanner sit between entries and Core, Scanner is west and south of Core, and external systems remain east; whole container subtrees and groups move together
- [x] #3 Every original relationship remains an individual deterministic orthogonal arrow routed through macro-facing ports, one Libavoid transaction, and defensive lane refinement, with zero building crossings, route artifacts, or shared paths
- [x] #4 The current 82-element and 66-relationship Groma world completes shared placement and routing in under 500 ms after routing initialization, without the former production lattice router
- [x] #5 Existing Web and TUI navigation, selection, camera, Backlog overlay, and debug timing behavior remain unchanged apart from the new shared map geometry and timing
- [x] #6 The isolated layout-comparison prototype, its dependencies, and its prototype-only architecture components are removed after production visual and interaction verification
- [x] #7 Focused shared-sheet tests, Web browser checks, TUI checks, TypeScript, and bun run check pass; the required simplicity and full-context architecture reviews find no blocking issue
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
1. Move the approved weighted container-role composition into the shared sheet placement boundary, translating complete slabs, descendants, zones, islands, and sheet bounds together. 2. Replace the dense quarter-cell A* route body with one initialized Libavoid transaction using full height-swept building obstacles and macro-derived endpoint sides. 3. Port only the deterministic, safety-checked lane refinement required to preserve the approved arrow clarity; delete the superseded router and port machinery instead of keeping dual paths. 4. Cover composition, deterministic routing, obstacle safety, individual relationship preservation, and generic fixture behavior with focused shared-sheet tests. 5. Verify the same sheet through Groma Web and TUI, measure the current world, run repository checks and both required reviews, then remove the isolated playground and its prototype-only architecture records.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A first checkpoint-based corridor design was rejected before delivery: it introduced a building crossing and, after excluding root routes, still created shared paths and much worse crowding. The simpler macro-port policy keeps corridor separation in the existing refiner and improved the same-placement Current metrics without extra route passes.

Implemented a fifth same-placement variant. Architecture semantics constrain only actor/external boundary arrows to the west-east flow axis; libavoid owns local obstacle routing; the existing refiner and bounded crossing cleanup own lane separation. On the latest 90-element Groma world, Current versus Final was: 150→141 conflict pairs, 8356.4→6750.8 crowded body, 0.0→1.7 minimum gap, 60→51 under-spaced segments, 158→145 proper crossings, and 207→189 tiny segments. Final measured 92.6 ms on the served run and 118.7–163.3 ms across repeated deterministic checks, with zero building crossings, route artifacts, and shared path. The 44 playground tests, playground TypeScript check, and bun run check pass; browser verification found no console errors.

Cold simplicity review: no blockers. Applied both deletion suggestions by replacing the unused two-axis centre helper with centreX and removing unused children overrides from the focused fixture. Focused test and playground TypeScript check pass after simplification.

Full-context architecture review: no blockers. It confirmed the fifth variant changes 31 of 66 route geometries while constraining only 8 macro boundary relationships, makes one libavoid call, and keeps Current placement/geography. Applied its junior-safety suggestion by replacing the root-parent proxy with an explicit actor-or-external boundary predicate. The generic crossing cleanup remains in crossing-parity.ts because splitting it now would add another scanned architecture component and change the map under review. Final focused checks and bun run check pass. The retained fourth production-oracle variant still makes total comparison-page startup about 4.6 seconds; the reported 93.7 ms is the fifth algorithm cost, not whole-page load time.

Visual review rejected the same-placement Final: Scanner remained east of Core and created too much empty space below Core and View host. TASK-206 now uses the explicitly requested Terrain-layout plus Semantic-flow hybrid.

Implemented the requested hybrid by routing Terrain layout's accepted placement with semanticRouting and composing the fifth variant from terrainPlacement plus Semantic routes. Objective evidence on the 90-element world: Scanner x=2113.92 versus Core x=2453.76, identical element placement to Terrain layout, 43/66 routes differ from Terrain and 57/66 differ from Current. Current→Hybrid: conflict pairs 150→127, crowded body 8356.4→5981.6, minimum gap 0.004→3.2, under-spaced 60→44, proper crossings 158→136, tiny segments 207→199. Hybrid routing measured 101.4 ms with zero building crossings, route artifacts, and shared paths. Browser page identity, variant activation, visible map, metrics, and console health passed. All 44 playground tests, playground TypeScript, and bun run check pass.

Replaced the five-choice experiment with Current and Composed flow. The live 91-element/66-arrow world derives CLI, Terminal viewer, and Web viewer as actor-facing entries; View host then Scanner as mediators; and Core as the strongest internal sink. A forced checkpoint-corridor attempt was removed before delivery because it produced 173 conflict pairs and 10702.5 crowded-path pixels. The simpler macro-direction policy uses one libavoid pass and improves Current from 149 to 122 conflict pairs, 3022.3 to 400.3 crowded-path pixels, 61 to 22 under-spaced segments, and 152 to 140 right-angle crossings. Both variants retain zero building crossings, route artifacts, and shared paths. The composed world is byte-for-byte deterministic; its cold composition plus routing measured 282.6 ms and its warm served route pass 41.4 ms. All 47 playground tests and playground TypeScript pass. Browser verification shows exactly two choices, 66 visible composed arrows, a working Topography overlay, and no console errors. The full repository check passes outside the filesystem sandbox; the sandboxed run alone exhausted its filesystem-watch descriptors.

Final full-context review found no code blocker and endorsed the phases as simple, cohesive, domain-grouped, and safe for junior developers. It identified one contract mismatch: acceptance criterion 4 still described the rejected explicit-corridor design. The criterion now states the implemented and measured contract: macro-derived port direction, one libavoid pass, then deterministic lane refinement. A final bun run check passed with 193 Bun tests and the full Node suite; only existing lint complexity warnings remain. Visual approval is the only pending gate.

Alex visually approved Composed flow and explicitly expanded TASK-206 to production integration plus removal of the isolated prototype. The playground has never been tracked as a complete dependency-safe commit, so TASK-206 remains In Progress and will produce one final production commit rather than a partial prototype commit that depends on other untracked task work.

Production integration now uses one shared Web/TUI sheet. Component relationships are aggregated into weighted container flow for entry, mediator, and core placement; complete slabs, groups, and buildings move together. One Libavoid transaction keeps all 66 authored arrows individual, and deterministic WebCola lane refinement is accepted only when ports stay fixed and obstacle/spacing safety does not regress. The former lattice router and port-layout module were deleted. The isolated layout-comparison directory and prototype-only architecture records were removed from the workspace; the untracked prototype remains recoverable at /private/tmp/groma-task-206-layout-comparison.

Objective current-world evidence: 82 elements and 66 relationships; CLI, Terminal viewer, and Web viewer are west entry surfaces; View host and Scanner mediate the flow; Scanner is west and south of Core; external systems remain east. Safety analysis reports zero building crossings, zero route artifacts, and zero shared-path length. A conservative obstacle bounding-box reject reduced cold placement plus routing to 264-284 ms and warm routing to 51-90 ms. It preserves the approved geometry exactly: SHA-256 459df0de2bd7657dc6492bcf9917c3b6e15089ed1f060f81a21935004401fe44.

Verification and reviews: focused sheet/routing/render tests pass, TypeScript passes, Web browser checks found the approved map and no console errors, and TUI root/container/200x60 checks kept navigation and fixed geometry. Cold simplicity, specification, quality, and the required full-context complexity/junior-safety review found no blocking issue. Applied the simplicity reductions: mutate only the fresh placement, remove the unused route sheet argument, replace dead containment arrays with one direct owner, and explain Libavoid shape lifetime.

Final repository verification passed with bun run check -- --max-concurrency=1: Biome and the scrollbar guard completed, TypeScript passed, all 81 Node tests passed, and all 168 Bun tests passed. The standard concurrent run passed 167 of 168 Bun tests but exposed the existing parallel directory-watch race; the same watcher test passed alone in 17 ms and as part of the serialized complete check in 12 ms. No unrelated watcher implementation was changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated the visually approved composed-flow placement and Libavoid/WebCola routing into the one shared Web/TUI sheet, deleted the old lattice router and isolated comparison prototype, and preserved every authored relationship as a deterministic obstacle-safe arrow. Verified the 82-element/66-route production world at 264-284 ms cold with zero building crossings, route artifacts, or shared paths; browser, TUI, focused tests, TypeScript, the complete repository check, and all required reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
