---
id: TASK-28.15
title: Keep the footer zoom strip open after Enter
status: Done
assignee:
  - grok
created_date: '2026-08-15 20:44'
updated_date: '2026-08-15 20:45'
labels: []
dependencies: []
references:
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect focuses the footer zoom strip with z, choosing a level or the plus or minus and pressing Enter currently returns to the map. Enter should apply that action and leave the strip focused. Only z toggles footer focus. Esc still leaves the strip without changing level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on a footer slot changes level, enters, or leaves and keeps the footer focused
- [x] #2 z is the only key that toggles footer focus; Esc still leaves the strip without changing level
- [x] #3 Viewer tests cover Enter keeping footer focus after a level change
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
1. When the footer is focused, Enter applies leave, enter, or jumpView and leaves focus on zoom.
2. Update unit and headless tests so Enter keeps footer hints on zoom; z still toggles; Esc still dismisses.
3. Document that Enter applies the slot and only z or Esc returns to the map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity: Enter while zoom-focused already applied the slot; the only extra work was setting focus back to architecture. Removing that keeps the strip open. Nothing else to delete.

Verification: bun test test-bun/terminal-viewer.test.ts 13/13; bun run check (tsc, architecture, 52 Node tests, 13 viewer tests). Unit inspect after z keeps focus zoom for jump/leave/enter. Headless z then left/right Enter keeps footerHints zoom; z toggles; Esc dismisses.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enter on the footer strip now changes level, enters, or leaves and leaves the strip focused. z still toggles focus; Esc still dismisses without changing level. Verified by unit and headless viewer tests and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
