---
id: TASK-386
title: Move map view tabs into a floating camera bar
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 20:06'
updated_date: '2026-09-13 20:09'
labels: []
dependencies: []
references:
  - page
  - map-view
  - island
modified_files:
  - src/viewers/web/atoms/floating-bar.ts
  - src/viewers/web/work/island.ts
  - src/viewers/web/chrome/map-view.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
ordinal: 432000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The header is crowded with camera presentation choices. Put those choices over the map using the same rounded floating surface as the bottom tasks bar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Iso, 2D and Layers appear as icon-and-label tabs in a floating bar at the top of the map, outside the header.
- [x] #2 The camera bar shares the tasks bar rounded surface and follows the available map area as side panels open or close; F1 hides it with other chrome.
- [x] #3 Click and keyboard tab selection update the existing camera view, including selected-tab synchronization with F2; existing camera behavior is preserved.
- [x] #4 Browser verification covers the new bar and the repository check passes.
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
Extract only the shared floating surface CSS, reuse it for tasks and camera, move the view markup outside the header, add tab keyboard interaction and icons, then verify existing view behavior and live UI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved map-view markup out of the header into a top floating tablist. Added cube, plan and layers SVG icons. Clicks and tab keyboard navigation call the existing map animator; painting keeps aria-selected and focus order synchronized with F2. Extracted only the shared rounded surface CSS into floating-bar.ts and applied it to the existing tasks bar and camera bar. Both bars share side-panel insets and reduced-motion handling. Browser verification covered all three views, ArrowRight, Home/End, F2 synchronization, F1 hiding/restoring chrome, and centering after closing details and collapsing hierarchy. Restarted localhost:4747 and confirmed camera control is outside the header and both bars have the same 28px radius. Self specification and quality review found no blockers; no changes to camera projection or architecture semantics. Full bun run check passed: lint, types, 16 Node tests, 305 Bun tests, 6 optional native tests skipped. Git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved Iso, 2D and Layers into icon-and-label tabs in a floating bar above the map. Reused the tasks bar rounded surface and existing view behavior. Verified clicks, keyboard, F1/F2, side-panel positioning and local appearance; full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
