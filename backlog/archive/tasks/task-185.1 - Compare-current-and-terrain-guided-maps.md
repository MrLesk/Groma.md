---
id: TASK-185.1
title: Compare current and terrain-guided maps
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-28 17:06'
updated_date: '2026-08-28 20:24'
labels: []
dependencies: []
references:
  - layout-comparison
modified_files:
  - layout-comparison/src/refine.ts
  - layout-comparison/src/terrain-lanes.ts
  - layout-comparison/src/terrain-comparison.ts
  - layout-comparison/src/placement-optimizer.ts
  - layout-comparison/src/types.ts
  - layout-comparison/src/server.ts
  - layout-comparison/src/render.ts
  - layout-comparison/src/interaction.ts
  - layout-comparison/test/terrain-comparison.test.ts
  - layout-comparison/src/topography.ts
  - layout-comparison/src/avoid.ts
parent_task_id: TASK-185
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The isolated layout playground presents three deterministic views of the same Groma architecture: the current map, terrain-guided routes over fixed buildings, and terrain-guided routes with bounded semantic placement changes. This lets a developer compare the visible value of topography without mixing routing and placement effects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The playground exposes exactly Current, Terrain routes, and Terrain layout variants for the same architecture
- [ ] #2 Current preserves the existing placement and refined route geometry as the control
- [ ] #3 Terrain routes keeps every building fixed while using building and route congestion costs to produce a visibly distinct route candidate
- [ ] #4 Terrain layout permits only bounded whole-group, container, or sibling movements while preserving authored geography, containment, and map size
- [ ] #5 Each variant shows its own routing diagnostics and switching variants does not recalculate or mutate another variant
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
1. Keep the production Groma placement and existing refined libavoid routes as the explicit Current control. 2. Replace lane-only terrain routing with low-terrain corridor checkpoints that can change each relationship's orthogonal topology while buildings and ports remain fixed; retain libavoid's obstacle avoidance and route separation. 3. Replace the single Pareto-safe placement move with a deterministic multi-step whole-semantic-unit search scored as one map, preserving actors west, external systems east, containment, non-overlap, and sheet size while treating crossings/artifacts/shared paths as hard failures. 4. Precompute the three complete scenes server-side and expose visible delta diagnostics so a visually unchanged variant fails verification. 5. Verify focused logic, browser differences and artifacts, then run bun run check and the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discarded the measured full-map A* prototype: about 2.3 seconds, one artifact, and shared paths. Delivered design reuses libavoid topology, the existing safe lane solver, and one shared cached terrain sampler. Live Groma evidence: exactly current/terrain-routes/terrain-layout; fixed terrain routing changes 22 routes with identical buildings and endpoints; terrain layout moves only Core and its 11 descendants plus owned zones, preserving map size and islands. All variants have zero building crossings, zero route artifacts, and zero shared path. Browser checks passed for switching, independent metrics, topography, selected-arrow persistence across switch/zoom/reset/pan, empty-click clearing, and zero console errors. Playground: 36 tests pass and TypeScript passes. Full bun run check passes: 81 Node tests and 192 viewer tests; lint completes with pre-existing complexity warnings. Cold simplicity review and targeted re-review passed with no findings after centralizing terrain sampling, shrinking the scene contract, narrowing the raw-route input, and collapsing duplicate terrain-result assembly. Full-context architecture/junior-safety review found no blockers and recommends this smaller safe-lane architecture over the rejected second router. Visual approval remains before task finalization.

User rejected the first comparison as visually insignificant. Diagnosis: the playground loads the same architecture and production placeWorld result as Groma, imports production projection/style/measurement, Terrain routes only changed nearby lane coordinates, and Terrain layout accepted one Core-subtree move. The conservative Pareto gate defeated the purpose of exploring materially different topographic strategies; implementation is being replaced before approval.

Replaced the rejected micro-variants. Terrain routes now selects at most ten distinct ground-level valley checkpoints far from the baseline path and asks libavoid to route through them before safe lane refinement; on live Groma it keeps all buildings fixed and changes 44/66 routes, lowers terrain exposure 2758→1475 and conflicts 168→165, with zero building crossings, artifacts, or shared path. Terrain layout now applies only material whole-container moves (minimum four cells), currently moving View host and Scanner with all descendants; it lowers exposure to 1862 but raises conflicts to 176, a visible trade-off rather than a claimed improvement. Browser fit-map and topography views are materially distinct and have no console errors. Playground 37 tests and TypeScript pass; bun run check passes 81 Node and 192 viewer tests with only existing complexity warnings. Visual approval remains open.

Critical scope/performance correction after user challenge: 4141 is not comparing an independent placement engine. It loads production Groma placeWorld; webcola is used only for route-lane constraints and libavoid only for arrows. Measured live Groma: placeWorld 3–9 ms while production sheetScene is 3.5–4.6 s, so production arrow routing dominates shared Web/TUI sheet composition. In the current playground, one libavoid pass is ~123 ms, lane refinement ~94 ms, but the newly added brute-force terrain checkpoint selection is ~7.0 s and the complete terrain comparison ~14.3 s. Do not present TASK-185.1 as a faster placement experiment; its direction must be reconsidered with the user.
<!-- SECTION:NOTES:END -->
