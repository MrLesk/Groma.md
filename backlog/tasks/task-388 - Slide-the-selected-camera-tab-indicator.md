---
id: TASK-388
title: Slide the selected camera tab indicator
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 20:20'
updated_date: '2026-09-13 20:23'
labels: []
dependencies: []
references:
  - map-view
modified_files:
  - src/viewers/web/chrome/map-view.ts
  - docs/viewers/web/index.md
ordinal: 434000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The floating camera bar currently replaces the selected tab background abruptly. A single moving selection pill should connect the three choices with a smooth segmented-control transition.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One pill slides and resizes between Iso, 2D and Layers, with smooth label and icon color changes and no bar layout shift.
- [x] #2 Clicks, keyboard selection and F2 drive the same indicator; rapid changes continue from its displayed position, and reduced motion removes the animation.
- [x] #3 Verify the sliding control in the browser and pass bun run check.
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
Keep the existing tab actions and selection state. Add one decorative indicator behind the buttons, measure the selected tab only on selection or bar size changes, and animate its transform and width with CSS.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced separate selected-tab backgrounds with one decorative pill behind the existing tab buttons. It moves and resizes over 340 ms with a smooth ease-out curve; icon and label colors transition over 180 ms. Measurements run only on selection or bar resize, not on every camera animation frame. CSS transitions naturally retarget from the displayed position during rapid changes. Browser verification covered clicks, arrow selection, F2 and reverse switching. Observed an intermediate transform differing from its target while sliding. With reduced motion emulated, duration was 0 seconds and displayed transform matched the destination immediately; emulation was cleared afterwards. Local Groma restarted and verified one indicator, working tab selection and no plugin issues. Self specification and quality reviews found no blocker. Full bun run check passed: lint, types, 16 Node tests, 307 Bun tests, 6 optional native tests skipped; git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a single smoothly sliding and resizing selection pill to the camera tabs, with coordinated icon and label color transitions. Verified keyboard, F2, rapid switching and reduced motion in the browser. Full repository check passed; local Groma updated.
<!-- SECTION:FINAL_SUMMARY:END -->
