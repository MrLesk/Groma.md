---
id: TASK-190
title: Select playground relationships from arrows
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-27 18:40'
updated_date: '2026-08-27 18:51'
labels: []
dependencies: []
references:
  - layout-comparison
modified_files:
  - layout-comparison/src/render.ts
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the isolated layout-comparison playground, a developer can click an arrow to keep that relationship visually emphasized while inspecting routing, without changing layout or route geometry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clicking a visible arrow makes that relationship modestly bolder while preserving its normal, crossing, dashed, and ghost colour semantics
- [ ] #2 Only one relationship is selected; clicking another replaces it and clicking empty map space clears it
- [ ] #3 The selected relationship remains selected across Raw and Refined modes and through pan, zoom, camera reset, and topography changes
- [ ] #4 Route geometry, production Web and TUI behavior, URL state, and browser storage remain unchanged
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
1. Add relationship selection state and click-versus-drag handling to the isolated playground renderer. 2. Reuse the existing route selected class with neutral and crossing colour overrides. 3. Verify selection persistence, clearing, route-mode switching, and unchanged geometry with focused checks and browser QA.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added page-session relationship selection, click-versus-drag handling, and neutral/crossing selected-route emphasis in the playground renderer.

Browser QA at http://localhost:4141 verified one logical selection across Raw and Refined, replacement and click-away clearing, persistence through pan, zoom, topography and deterministic double-click camera reset, unchanged route points, and no console warnings or errors. Focused result: 34 playground tests and playground TypeScript check pass. Repository result: typecheck, 81 Node tests, and 180 Bun tests pass; Biome reports 43 pre-existing cognitive-complexity warnings outside the task file and applies no fixes. Cold simplicity review passed after replacing timer-based reset handling with explicit selection restoration.

Full-context architecture review confirmed the shared data-id/selected-state design and no obsolete code. Applied its junior-safety recommendation by naming the gesture completion and selection-preserving reset operations, and by preventing sub-threshold pointer jitter from moving the camera.

Final browser QA after the architecture cleanup passed against the latest Groma model: one selected relationship in both route layers, exact sub-threshold jitter behavior, real pan persistence, Raw/Refined persistence, topography and zoom persistence, camera-reset persistence, unchanged route geometry, and zero console warnings or errors. The 4141 server remains running for human visual approval.
<!-- SECTION:NOTES:END -->
