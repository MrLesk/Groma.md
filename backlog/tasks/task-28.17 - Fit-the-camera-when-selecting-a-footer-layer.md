---
id: TASK-28.17
title: Fit the camera when selecting a footer layer
status: Done
assignee:
  - grok
created_date: '2026-08-15 21:02'
updated_date: '2026-08-15 21:04'
labels: []
dependencies: []
references:
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/projection.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enter on a footer level name currently changes C4 level and the selected item but leaves the camera where it was, so the map does not zoom. Enter on context, containers, or components should jump to that level and tween the camera to fit that layer. Footer plus and minus still step-zoom the camera.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on a footer level name jumps to that C4 level and zooms the camera to fit that layer
- [x] #2 Footer plus and minus still step-zoom the camera without changing C4 level
- [x] #3 Viewer tests cover selecting a footer layer changing level and camera zoom
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
1. Add fitLayer: context fits the whole map; containers fits the selected system; components fits the selected container.
2. After Enter on a footer level name, jumpView as today and tween the camera to fitLayer.
3. Update TUI docs and tests so a footer layer Enter changes level and camera, while footer plus/minus still step-zoom.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity: fitLayer reuses overviewCamera. Enter on a level name still jumpView, then the viewer tweens to that layer. Plus/minus stay on zoomBy.

Verification: bun test 14/14; bun run check. New test: footer z, right, Enter, z is Containers and differs from the same level at world-fit camera. Opening-map test still matches keyboard plus via footer plus.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enter on a footer level name now jumps to that C4 level and tweens the camera to fit it. Plus and minus still step-zoom. Verified by the footer-layer camera test and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
