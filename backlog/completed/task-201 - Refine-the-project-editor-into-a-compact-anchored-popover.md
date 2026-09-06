---
id: TASK-201
title: Refine the project editor into a compact anchored popover
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 20:25'
updated_date: '2026-08-28 06:24'
labels: []
dependencies: []
references:
  - iso-projection
  - project-editor
modified_files:
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/project/editor.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/project-editor.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - design-qa.md
type: enhancement
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refine the existing web project-profile editing surface to match the approved mockup: keep the pencil as a compact boxed control on the isometric title plate and open long Markdown in an upright editor anchored to that plate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The project title plate shows a compact pencil control inside a bordered box that follows the existing blueprint pattern.
- [x] #2 Activating the pencil opens an upright editor visually anchored to the title plate, matching the approved mockup.
- [x] #3 Long project Markdown remains editable in a scrollable surface without expanding or moving the isometric title plate.
- [x] #4 The existing Save and Cancel behavior remains unchanged, including live refresh after a successful save.
- [x] #5 The approved interaction is verified in the running web viewer at normal and narrow viewport sizes.
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
1. Replace the title plate’s full-height edit column with one fixed square edit cell and cap only the plate preview so long Markdown does not grow the blueprint.
2. Paint the bordered cell and reuse the existing pencil and interaction semantics.
3. Position the existing upright project-profile dialog beside that cell, clamp it inside the viewport, and give the Markdown editor a bounded scroll area.
4. Update focused projection invariants and the two owning architecture records without touching unrelated shared web work.
5. Run focused checks, browser comparison at normal and narrow sizes, the required cold simplicity review, the full-context complexity review, and the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the first focused slice: the blueprint caps its visible description at three projected lines, uses a fixed inset square edit cell, and paints the existing pencil inside that border. The editor now opens beside the cell, draws a connector, stays inside the viewport, and bounds the Markdown surface. TypeScript and all 16 iso-map tests pass.

Cold simplicity review and full-context complexity review both passed. Applied their only shared simplification: renamed editWidth to editReservationWidth so junior developers do not confuse content reservation with the square cell size. Kept the second dialog layout read because it makes connector geometry explicit and correct. Visual QA passed at 1280×720 and 520×720; the first connector coordinate bug was fixed and the post-fix comparison is recorded in design-qa.md.

Final verification: bun run check passed after the shared TASK-199 scrollbar module marker landed. Biome reported only existing warnings, TypeScript passed, 81 core tests passed, and 189 viewer tests passed. The first full run had one concurrent architecture-watch timeout; that exact test passed alone in 416 ms and the final full run passed it in 1.32 s. Task-scoped lint has no new warning; its one warning is the pre-existing wrapBlock complexity. Browser evidence covers desktop and narrow layout, long Write/Preview scrolling, Cancel without persistence, green Save styling, keyboard-accessible pencil semantics, and an empty console.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refined the project editor into the approved compact anchored popover. The title plate now limits its Markdown preview to three projected lines and places the existing pencil inside a fixed bordered cell. The existing editor opens upright beside that cell, stays inside desktop and narrow viewports, and keeps long Write and Preview content scrollable without changing the plate. Save, Cancel, live publication, keyboard access, the existing name field, and Markdown modes remain intact. Browser QA passed at 1280×720 and 520×720 with no console errors. The cold simplicity and full-context complexity reviews passed after one naming simplification. The final shared repository check passed with 81 core tests and 192 viewer tests; Biome reported only existing warnings.
<!-- SECTION:FINAL_SUMMARY:END -->
