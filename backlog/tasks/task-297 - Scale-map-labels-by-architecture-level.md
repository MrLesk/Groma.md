---
id: TASK-297
title: Enlarge map headings and compass with clear spacing
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 13:16'
updated_date: '2026-09-06 13:38'
labels: []
dependencies: []
references:
  - sheet-composition
  - iso-map
  - iso-projection
modified_files:
  - src/sheet/measure.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/sheet/place.ts
  - src/sheet/compose.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/blueprint.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/sheet-compose.test.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
  - test-bun/web-layer-mode.test.ts
type: enhancement
ordinal: 336000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer reading the web map sees larger, clearer component names and a proportional hierarchy above them: groups, containers, systems and the project title. Surface labels sit close to their outer edge with extra clearance above them. The compass and direction letters are substantially larger. Component size is tried and accepted before the other headings receive their final proportional increase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Component text increases to a size accepted by Alex; the other heading levels are then scaled proportionally from the accepted size.
- [x] #2 Surface name bands and title-plate bounds reserve space for the larger text and its padding in the supported map example.
- [x] #3 Names and their surrounding geometry remain correctly aligned when projected; routing and containment checks pass after spacing changes.
- [x] #4 The updated hierarchy and spacing are verified in the browser, relevant geometry checks and bun run check pass, and web documentation describes the behavior.
- [x] #5 The compass is substantially larger, with readable direction letters and enough space inside the map frame.
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
Use the accepted 16 px component size as h5. Scale the preceding heading sizes proportionally to project 52 px, systems 38 px, containers 29 px, and groups 22 px. Measure roofs, surface label bands, and the title plate from these sizes. Keep surface names close to the outer edge with clearance toward their contents; double the compass and preserve frame clearance. Verify the supported map in the browser and geometry checks, run bun run check, update web documentation, and finish implementer reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope extended by Alex during implementation: enlarge the map compass substantially, with enough room for its direction letters and the surrounding frame.

Alex clarified the label spacing: keep surface names close to their outer edge; reserve extra padding above the labels toward the contents, not around every side.

Alex superseded the original component-size lock: try larger component text first, obtain feedback, then increase the other headings proportionally from the accepted component size. Starting with 16 px (originally 11 px).

The 16 px trial passes focused geometry checks and the captured 113-route map. Full-suite validation exposed floating-point cancellation in the existing layer-bounds assertion (1.14e-13 pixels). The assertion now compares point offsets with width/height using the same subtraction as bounds measurement; it remains strict and retains the complete scenario.

Current trial verification: 16 px component text is rendered with correctly measured roofs, while the other headings remain at the preceding 36/26/20/15 trial sizes pending Alex’s feedback. The compass radius and direction font are doubled and visually checked inside the frame. Surface chips keep compact side and bottom insets; the extra space stays toward the contents. bun run check passes with 106 Node tests and 327 Bun tests, with only six pre-existing complexity warnings. Browser preview: http://localhost:4773/?component=iso-map&hud=off. Final proportional heading sizes and task finalization wait for the component-size choice.

Alex accepted the 16 px component trial and requested the proportional increase of all higher heading levels. Final rounded sizes are h1 52, h2 38, h3 29, h4 22, and h5 16 plane pixels.

Final verification: Alex accepted 16 px components; the browser renders project/system/container/group/component sizes at 52/38/29/22/16 px. Visual checks confirm compact outer-edge labels, clearance toward contents, correctly aligned roofs, a padded project title plate, and the enlarged compass. The captured supported world composes 76 buildings, 18 groups, and all 113 routes. bun run check passes: 106 Node tests and 327 Bun tests; six existing complexity warnings remain unchanged. The first sandboxed check could not start a native FSEvents stream; the complete check passed with native file-watch access. Implementer specification and quality reviews found no unmet criterion or supported-flow defect. Shared font metrics own sizing from placement through projection and painting; groups remain visual groupings under existing architecture parents. All changed source and test files remain below 500 lines; git diff --check passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enlarged map headings to 52/38/29/22/16 px and doubled the compass. Roofs, surface title bands, and the project plate reserve space for their text, with surface labels near the outer edge and clearance above. Verified in the browser, across all 113 routes in the supported map, and with bun run check (433 tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
