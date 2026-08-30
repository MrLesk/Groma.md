---
id: TASK-205
title: Add lane-quality parity routing variant
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-28 22:28'
updated_date: '2026-08-28 23:01'
labels: []
dependencies: []
references:
  - layout-comparison
  - crossing-parity
modified_files:
  - layout-comparison/src/crossing-parity.ts
  - layout-comparison/src/types.ts
  - layout-comparison/src/server.ts
  - layout-comparison/src/geometry.ts
  - layout-comparison/src/avoid.ts
  - layout-comparison/test/crossing-parity.test.ts
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the routing playground and selects the fourth variant, Groma replays production's chosen endpoint sides on Current placement, routes them with libavoid, and applies a bounded crossing-focused cleanup. This isolates how much of production's quality comes from port discipline while keeping Current, Terrain routes, Terrain layout, and topography available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The playground exposes a fourth Port parity variant without changing or removing the existing three variants or topography
- [ ] #2 The fourth variant preserves Current placement and hard safety invariants while reporting the same diagnostics
- [ ] #3 The variant replays production endpoint sides, uses libavoid plus the existing refiner, then accepts only safe lexicographic improvements from bounded orthogonal subpath shortcuts
- [ ] #4 The full cost of obtaining production port choices is reported honestly, and the comparison is deterministic and visually inspectable at localhost:4141
- [ ] #5 Focused tests and bun run check pass
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
1. Infer each relationship endpoint side from a measured production route and feed those preferences into the existing comparison port distributor, which revalidates them against Current placement.
2. Route once with libavoid, run the existing safe staircase/lane refiner, then try bounded orthogonal subpath shortcuts. Preserve endpoints, obstacle clearance, minimum lane gap, crowding, and conflict counts; accept lexicographic improvements in crossings, tiny segments, under-spacing, and ink.
3. Append the result as the fourth generic scene variant; keep rendering, interaction, terrain, production Web, and TUI code unchanged. Include the production side-planning time in the variant routing time.
4. Cover preferred-side mapping, preference revalidation, shortcut safety, score order, determinism, and live scene invariants; run browser QA and repository checks.
5. Run the required cold simplicity review and full-context architecture/junior-safety review before asking for visual approval.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one fourth `Port parity · production oracle` playground variant without changing the existing three variants, topography, renderer, interaction, production Web, or TUI. The variant runs production measuredSheetScene only to infer each relationship endpoint side, revalidates those preferred sides on Current placement, routes with libavoid, reuses the existing safe refiner, and then accepts bounded orthogonal shortcuts only when crossings-first diagnostics improve without worsening hard safety, obstacle clearance, minimum lane gap, crowded-body length, or conflict count.

The reviewers materially narrowed the design: Sol Max proved all 18 proposed libavoid parameter combinations produce identical geometry; the existing refiner already implements safe staircase collapse and deterministic lane separation. Claude and both Sol reviews agreed that port discipline is the meaningful remaining quality variable. Live attribution on the current 66-arrow map: Current is 186 proper crossings / 201 tiny / 43 under-spaced / 2862.4 crowded at 60.2 ms; production-side libavoid plus refinement reaches 170 / 198 / 22 / 1403; bounded shortcuts finish at 164 / 179 / 18 / 1235.1. Final Port parity reports the complete production-oracle wall time, 3476.2 ms, rather than presenting it as fast libavoid work. All variants remain at zero building crossings, route artifacts, and shared paths, with 12.0 obstacle clearance.

Verification: 43 playground tests pass, playground TypeScript passes, and `bun run check` passes with 81 Node and 193 Bun viewer tests; only pre-existing complexity warnings remain. Browser QA at localhost:4141 confirms all four switches, active Port parity diagnostics, topography and selected-route persistence, and zero console errors. Cold simplicity review found no blocker and led to simpler direction-based side inference plus a precise clearance comment. The full-context architecture/junior-safety review found the domain boundary solid and led to the explicit `production oracle` label and one complete wall-clock timer. Human visual approval remains open before finalization.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-28 22:43
---
Claude and two independent Sol Max reviews changed the experiment boundary. The proposed libavoid parameter grid is a measured no-op on the live 66-route map; safe dogleg collapse and deterministic lane separation already exist; production port sides are not exposed without invoking the 3.5-second production router. TASK-205 therefore targets the remaining visible gap directly with a bounded, safety-checked topology cleanup.
---

created: 2026-08-28 22:52
---
Live mixed-result evidence: Current reports 186 proper crossings, 201 tiny segments, 43 under-spaced pairs, 2862.39 crowded-body length, and about 61 ms. Port parity reports 164 crossings, 179 tiny segments, 18 under-spaced pairs, 1235.09 crowded-body length, and about 3.53 s, with zero building crossings, artifacts, and shared paths and unchanged obstacle clearance. Port choices materially improve quality, but their only current source is the slow production router; the fourth option reports that cost rather than hiding it.
---
<!-- COMMENTS:END -->
