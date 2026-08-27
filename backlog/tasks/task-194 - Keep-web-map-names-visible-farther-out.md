---
id: TASK-194
title: Keep web map names visible farther out
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:58'
updated_date: '2026-08-27 19:02'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/scale.ts
  - test-bun/iso-scale.test.ts
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person zooms the web architecture map out, surface names should remain visible at smaller screen sizes so the map stays understandable instead of hiding its labels too early.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Island, slab, zone, and building names remain visible until their projected font is smaller than 6 screen pixels
- [x] #2 The existing zoom visibility check covers the revised threshold
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
1. Lower the shared web-map surface-name visibility threshold from 10 to 6 projected screen pixels in src/viewers/web/iso/scale.ts. 2. Adjust the existing scale test to prove names stay visible at the new boundary while still hiding below it. 3. Run the focused scale test, bun run check, rendered browser QA, and the required simplicity reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lowered the shared surface-name threshold from 10 to the documented 6 screen pixels. The focused scale test passes (2 tests), and bun run check passes (81 Node tests and 184 Bun tests); Biome reports only the repository's existing complexity warnings and no errors. Cold simplicity review and full-context defensive-architecture review both found the one-constant change plus boundary test to be the simplest solid design, with scale.ts remaining the single owner and no further deletion or refactor available.

Rendered browser QA at http://localhost:4747 passed. At 745% relative zoom the camera scale was 0.4528 and all 87 surface labels were hidden; one Zoom In action moved to scale 0.566 and all 87 labels became visible. The page identity was groma.md, meaningful map content rendered, no framework error overlay appeared, and the console had no warnings or errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the web map's shared surface-name visibility threshold from 10 to the documented 6 screen pixels, so island, slab, zone, and building labels remain visible farther out. Verified with the focused boundary test, bun run check (81 Node and 184 Bun tests), rendered browser interaction across the threshold, and both required simplicity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
