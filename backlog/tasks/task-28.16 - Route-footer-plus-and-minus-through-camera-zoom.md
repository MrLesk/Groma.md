---
id: TASK-28.16
title: Route footer plus and minus through camera zoom
status: Done
assignee:
  - grok
created_date: '2026-08-15 20:54'
updated_date: '2026-08-15 20:55'
labels: []
dependencies: []
references:
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/navigation.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enter on the footer plus or minus currently changes C4 level. Keyboard plus and minus zoom the camera. Both should use the same camera zoom. Level names on the footer still jump to that C4 level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on footer plus zooms in the same way as the plus key; Enter on footer minus zooms out the same way as the minus key
- [x] #2 Camera zoom from the footer plus or minus does not change C4 level
- [x] #3 Viewer tests cover footer Enter on plus and minus matching keyboard camera zoom
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
1. Route keyboard plus/minus and Enter on the footer plus/minus slots through the same zoomBy in the terminal viewer. Stop mapping those keys to C4 enter/leave.
2. Footer inspect on plus/minus is a no-op in the reducer; level names still jumpView.
3. Update docs and tests so footer Enter on plus/minus zooms without changing level, matching the plus/minus keys.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity: keyboard plus/minus and footer Enter on plus/minus now call the same zoomBy. The reducer no longer treats those footer slots as C4 enter/leave; level names still jumpView.

Verification: bun test test-bun/terminal-viewer.test.ts 13/13; bun run check. Opening-map test: footer Enter on plus then z matches the keyboard-plus frame; footer Enter on minus zooms out and stays System Context. Headless z then plus stays System Context.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Footer plus and minus now zoom the camera through the same zoomBy as the plus and minus keys. Level names still jump C4 level. Verified by the opening-map frame match and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
