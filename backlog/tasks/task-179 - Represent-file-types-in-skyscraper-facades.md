---
id: TASK-179
title: Represent files as real skyscraper sections
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 18:40'
updated_date: '2026-08-26 19:10'
labels: []
dependencies: []
references:
  - architecture-model
  - world-loader
  - sheet
  - iso-projection
  - iso-map
  - web-viewer-details
modified_files:
  - src/types.ts
  - src/core.ts
  - src/sheet/types.ts
  - src/sheet/measure.ts
  - src/sheet/place.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/organisms/details.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/iso-map.test.ts
  - test/core.test.ts
  - test-bun/web-task-camera.test.ts
  - docs/viewers/web/index.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-details.md
type: feature
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens a scanned component in groma web, the component reads as one tall skyscraper. Every source file is one visible stacked section: eight files produce eight sections. A section's height follows that file's lines of code, and its facade pattern identifies the normalized file extension.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A component renders one visible stacked tower section per source file; eight files produce eight sections.
- [x] #2 Each section is one to four storeys tall according to that file's LOC relative to the observed project files, so total tower height reflects both file count and code mass.
- [x] #3 Each section's side pattern is stable for its normalized file extension, including extensions not known in advance.
- [x] #4 Four or more aligned sections read as one vertical skyscraper; one to three files retain the existing block or stepped form.
- [x] #5 All sections initially share the component's existing footprint, so area does not imply an unapproved code metric.
- [x] #6 The selected element details identify the files and their file types represented by the sections.
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
1. Enrich each unique code file with its measured line count while retaining the existing component total used by other viewers. 2. Project one section per file, mapping each observed file to one through four storeys across the project file range; sum the sections for the tower height. 3. Keep one component footprint for every section, retain the stepped form for two or three files, and align four or more sections as a vertical tower with only its final roof visible. 4. Generate stable extension-derived side patterns without a file-type registry and show the normalized type beside each file in details. 5. Add focused model and projection tests, update the public Web/product documentation and observed architecture, run repository checks, then verify the result in the live Web viewer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture decision: deliver the tower grammar in two iterations. TASK-179 keeps a fixed component footprint so area has no false meaning. A later explicitly approved feature may expose file-level dependencies from TypeScript and C# scanners, using fan-in for width and fan-out for depth. Git history is excluded from the building grammar.

Applied the cold simplicity review: removed the aggregate component codeLines height fallback, made file sections the sole source of component height, removed duplicated tower level state from Shape, and corrected the iso-projection code symbol to projectScene. TypeScript and 32 focused tests pass.

Validation: bun run check passed (81 Node tests and 170 Bun viewer tests; 41 pre-existing lint warnings). Live browser verification at port 4848 found 54 component buildings and 123 file sections; Sheet has 8 sections, C# scanner has 5, all eight 4+ section towers expose only one final roof, .ts/.cs facade patterns are present, Sheet build details list each file with normalized extension and LOC, and browser logs are empty. The targeted simplicity re-review confirmed all three original findings resolved with no scoped regressions.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-26 19:09
---
Implementation and objective verification are complete. Leaving TASK-179 In Progress for Alex's visual approval before commit, push, final summary, and Done.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rendered each unique component source file as one LOC-scaled skyscraper section, with deterministic extension-derived facade patterns, aligned 4+ file towers, fixed footprints, and file type/LOC details. Verified with bun run check (81 Node and 170 viewer tests), live browser structure checks for the 8-section Sheet and 5-section C# scanner, empty browser logs, and a passing cold simplicity review plus targeted re-review.
<!-- SECTION:FINAL_SUMMARY:END -->
