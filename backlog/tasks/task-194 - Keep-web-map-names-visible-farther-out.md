---
id: TASK-194
title: Keep web map names visible farther out
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:58'
updated_date: '2026-08-27 19:17'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/scale.ts
  - test-bun/iso-scale.test.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/map.ts
  - docs/viewers/web/index.md
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person zooms the web architecture map out, surface names should remain visible at smaller screen sizes so the map stays understandable instead of hiding its labels too early.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Island, slab, and zone names remain visible while zooming so the map keeps its structural context
- [x] #2 Building names remain visible until their projected font is smaller than 6 screen pixels
- [x] #3 The zoom visibility check covers the building-name threshold
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
1. Keep structural island, slab, and zone names outside semantic-zoom hiding. 2. Rename the generic name-visibility state to building-name visibility so future changes cannot easily hide every label again. 3. Verify the building cutoff test, rendered Fit and zoom states, repository checks, and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lowered the shared surface-name threshold from 10 to the documented 6 screen pixels. The focused scale test passes (2 tests), and bun run check passes (81 Node tests and 184 Bun tests); Biome reports only the repository's existing complexity warnings and no errors. Cold simplicity review and full-context defensive-architecture review both found the one-constant change plus boundary test to be the simplest solid design, with scale.ts remaining the single owner and no further deletion or refactor available.

Rendered browser QA at http://localhost:4747 passed. At 745% relative zoom the camera scale was 0.4528 and all 87 surface labels were hidden; one Zoom In action moved to scale 0.566 and all 87 labels became visible. The page identity was groma.md, meaningful map content rendered, no framework error overlay appeared, and the console had no warnings or errors.

Reopened after the user reported no visible difference. The prior browser evidence explains the failure: changing the projected-font cutoff from 10px to 6px moved first visibility only from roughly 1,500% to 930% of the fitted view, which is still too late to be a meaningful product change.

Corrected the architectural regression rather than lowering the cutoff again: island, slab, and zone labels now remain structural context, while the six-pixel visibility rule applies only to building names. Renamed the generic visibility function and camera state to building-specific names so the code encodes that boundary. The focused scale test passes (2 tests).

Rendered QA on the rebuilt server passed. At Fit, 3 island, 6 slab, and 11 zone labels remain present while 67 building labels are hidden. At 477% the structural labels are visible and building labels remain hidden; at 931% all 67 building labels appear. The page title is groma.md and no error overlay is present. bun run check passed lint/typecheck and all 81 Node tests on its retry, but the Bun phase is blocked by the unrelated in-progress web-live watcher test in files changed by another task; the same watcher test times out when run alone.

Final focused verification after concurrent grid edits: bun test test-bun/iso-scale.test.ts passes 2/2, bun run typecheck passes, and git diff --check passes. Cold simplicity and full-context defensive-architecture reviews both pass with no further changes recommended.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored semantic label hierarchy in the Web map: island, slab, and zone names remain available through zoom, while only building names wait for a readable six-pixel roof font. Renamed the visibility rule and camera state to be building-specific, reducing the chance of another broad-label regression. Verified in the rendered map at Fit, 477%, and 931%; the focused scale test, TypeScript check, diff check, and both architecture reviews pass. The full suite remains affected by an unrelated in-progress Web watcher test.
<!-- SECTION:FINAL_SUMMARY:END -->
