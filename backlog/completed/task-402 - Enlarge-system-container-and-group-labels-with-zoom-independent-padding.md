---
id: TASK-402
title: 'Enlarge system, container, and group labels with zoom-independent padding'
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:56'
updated_date: '2026-09-15 15:06'
labels:
  - web
  - map
dependencies: []
references:
  - scene
  - map
documentation:
  - docs/viewers/web/index.md
  - docs/component-markdown.md
modified_files:
  - src/sheet/measure.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/map.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 448000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect reading the dense Call for Papers web map needs clearer system, container, and group headings and more space around them. Current heading sizes and spacing are expressed in plane pixels, so visible spacing scales with the camera. Increase the hierarchy labels and their surrounding padding, with the added padding remaining a fixed screen-space distance when zoom changes.

Component names must remain visible at every zoom: previous zoom-dependent hiding left roofs empty even on large displays with room to show their names. Keep that constraint explicit when making the hierarchy clearer. This changes presentation of existing C4 levels and Groma groups only; a group remains a visual grouping inside its parent, and ordinary OKF architecture content and ownership remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Systems, containers, and groups use visibly larger label text and more surrounding padding than the current map, retaining a clear hierarchy in the Call for Papers view and a minimal example containing a group.
- [x] #2 The increased padding and label clearance are measured in screen pixels and remain the same at different camera zoom levels at a fixed viewport and orientation; they do not grow on zoom-in or shrink on zoom-out.
- [x] #3 Component names remain visible across zoom levels, including the overview and a large desktop viewport; no zoom threshold, abbreviation, or name-hiding rule is introduced to accommodate larger hierarchy labels.
- [x] #4 The larger labels and their reserved space remain correctly fitted, positioned, and selectable in the supported isometric and 2D map views, with no new clipping or overlap caused by this change.
- [x] #5 Browser evidence compares the supported example at multiple zoom levels and at normal and large desktop sizes, including measured screen-space padding. Relevant geometry/camera invariants are verified without tests for decorative text or exact font choices; bun run check passes.
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
1. Enlarge system/container/group headings within the existing measured label bands. 2. Add screen-space clearance around hierarchy label text, corrected for camera scale and projection without hiding component names or changing architecture. 3. Verify fixed added padding, fit and geometry invariants and inspect Call for Papers plus a grouped fixture in Iso and 2D at normal and large viewports. 4. Run the repository check and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Geometry checks pass for Iso and 2D on the grouped fixture: added clearance remains screen-constant at half-fit, fit, double-fit and maximum zoom; text stays off roofs and other labels; expanded hit regions fit the viewport; source sheet remains unchanged. Browser Call for Papers at 1280x800 Iso and 1920x1080 2D measures exactly 8 screen pixels at 100% and 125%, with 1217 component roof labels retained. Grouped browser fixture shows clear labels and selecting the Api label opens its container. Cold simplicity review passed without required changes.

Final full check passed: 340 Bun tests, 17 optional scanner-package skips, 16 Node tests, lint and types. Browser grouped fixture verified in Iso and 2D: no clipping or overlap, 8px added padding, Api container and Shop system label selections open the correct details. Implementer specification and quality reviews passed; existing plane-space label bands remain documented, only added clearance is screen-constant.

Full-context complexity review passed with no blockers or material recommendations. The additional 8px screen clearance is distinct from existing plane-space bands. The disposable Call for Papers preview remains at http://localhost:4757/?component=company-list-component; temporary viewport overrides were reset and the grouped fixture server was stopped.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enlarged system, container and group headings and added 8px of camera-corrected screen clearance. Component names remain visible and packed architecture stays unchanged. Verified Iso/2D geometry, fixed spacing across zoom, normal/large browser views and label selection. Full repository check and both required reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
