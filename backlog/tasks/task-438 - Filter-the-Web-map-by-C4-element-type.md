---
id: TASK-438
title: Filter the Web map by C4 element type
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 09:56'
updated_date: '2026-09-19 19:40'
labels: []
dependencies: []
references:
  - render
  - web-page
  - map
  - c4-filter
modified_files:
  - src/viewers/web/chrome/c4-filter.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/web-c4-filter.test.ts
  - docs/viewers/web/index.md
ordinal: 511000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer exploring the map needs compact controls beside the hierarchy pane to show or hide C4 element types without changing the architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Toggles hide the chosen map elements, their attached routes and pins, and restore them without changing stored architecture, layout, or camera.
- [x] #2 Filtering survives map view changes and live updates; focused tests and the repository check verify the supported flow.
- [x] #3 A floating vertical bar beside the hierarchy provides tiny icon toggles for Actors, Systems, Containers, and Components, using modern versions of the existing circle, large square, parallelogram, and small square symbols, with accessible names and visible active states.
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
1. Build a compact floating C4 filter using shared kind labels and clean versions of the existing Unicode marks. 2. Keep visibility state in the browser control and filter projected map bodies, routes, and pin anchors without changing architecture, hierarchy, layout, or camera. 3. Verify fixture behavior, keyboard and visual presentation, map-view and snapshot continuity, update documentation, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a page-local visibility filter in chrome/c4-filter.ts. The control filters projected scene bodies and routes after projection, preserving geometry and bounds. render.ts uses remaining map anchors to filter pin painting. It does not change the world, hierarchy, selections, OKF documents, C4 ownership, or language-specific behavior. This is a viewer concern owned by the browser session; ordinary Markdown/OKF readers see the same architecture.

Focused validation: 11 tests pass across web-c4-filter and web-map-presentation. Browser verification on viewer-view: four 32px icon buttons, pressed states, keyboard Space and focus labels, expanded/collapsed hierarchy placement, no camera transform change on toggle, component bodies/routes hidden in Iso and Layers, task pin removed and restored, and filters retained across periodic snapshot updates. Specification and quality self-review traced control click -> hidden-kind set -> projected scene filter -> map painter -> visible pin anchors. No supported-flow defect or extra architecture concept found. Initial sandbox check encountered local-server restrictions; unrestricted bun run check is running.

Final unrestricted bun run check passed: lint and TypeScript completed; Node tests passed; Bun viewer suite finished with 604 pass, 35 skip, 0 fail. The lint warning is pre-existing complexity in test-bun/iso-map.test.ts. Final diff whitespace check passed; render.ts remains 499 lines. No separate review agents were needed for this bounded viewer feature.

User correction: the first version renamed Actor to People and invented unrelated icon shapes. Replace those choices with the existing Groma labels and glyph shapes. Filtering behavior remains unchanged.

Correction implemented: labels now come from shared kindLabel; Actors replaces People. SVG geometry mirrors the established filled circle, large square, outlined parallelogram, and small square. Only the filter control and its documentation changed in this revision. Visual inspection confirmed shape hierarchy and keyboard tooltip/focus states. The targeted self-review found no change to filtering, projection, or pin behavior.

Final verification after icon correction: bun run check passed, including lint, TypeScript, Node tests, and 608 passing Bun tests with 35 skips and zero failures. No decorative-content tests were added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a compact C4 filter bar beside the hierarchy with shared Actors, Systems, Containers, and Components labels and polished versions of the existing circle, large square, parallelogram, and small square marks. Filtering hides bodies, connected routes, and attached pins while retaining architecture and camera. Fixture tests and browser checks cover filtering, keyboard use, placement, view changes and updates. Final bun run check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
