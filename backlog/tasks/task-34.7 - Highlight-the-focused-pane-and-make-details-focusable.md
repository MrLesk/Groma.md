---
id: TASK-34.7
title: Highlight the focused pane and make details focusable
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:13'
updated_date: '2026-08-16 12:19'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pane being used is visibly highlighted: the focused pane's border draws in the selection accent while the other panes stay dim. The details pane becomes focusable so the highlight applies to it too: Right on the map with nothing further right moves focus into the details pane (reopening it if hidden, matching the left-edge escape into the tree), Up/Down scroll overflowing details content, and Esc or Left returns to the map. Hiding the focused details pane returns focus to the map.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The focused pane's border renders in the selection accent: hierarchy pane in tree focus, map pane in map focus, details pane in details focus
- [x] #2 Right on the map with nothing further right focuses the details pane, reopening it when hidden; selection and camera unchanged
- [x] #3 In details focus Up/Down scroll overflowing content, Esc or Left returns to the map, and selection changes reset the scroll
- [x] #4 Hiding the focused details pane with ] returns focus to the map
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. navigation.ts: ViewerFocus gains 'details'; ViewerState gains detailsScroll; right-edge escape mirrors the left one; details branch handles scroll and return keys; toggle-details drops focus.
2. chrome.ts/details.ts: focused pane border uses theme.selected; drawDetails takes focused and scroll, clamping scroll to content.
3. Footer hints for details focus; tests for the reducer rules; docs update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review applied: required view/detailsScroll params, dead focus guard collapsed, Bounds type named, syncTree comment covers the scroll reset, clamp split documented. Follow-up recorded, not fixed: holding Down past the end of details content accumulates hidden scroll (upper bound clamps only at render); fixing needs content height in the reducer. Verified live with agent-tty: Right at the right edge focuses details (footer switches to scroll hints); screenshot confirms the focused pane border draws in the selection accent while others stay dim.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The focused pane's border now draws in the selection accent (hierarchy, map, or details) and the details pane is focusable: Right at the map's right edge enters it and reopens it when hidden, Up/Down scroll overflowing content with the reducer flooring at zero and the painter clamping to content, Esc or Left returns to the map, and ] while focused hands focus back. Selection changes reset the scroll via the shared sync. Verified by reducer tests and live agent-tty screenshot.
<!-- SECTION:FINAL_SUMMARY:END -->
