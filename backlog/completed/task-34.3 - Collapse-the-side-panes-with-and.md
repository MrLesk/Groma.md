---
id: TASK-34.3
title: 'Collapse the side panes with [ and ]'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 12:02'
labels: []
dependencies:
  - TASK-34.1
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
[ toggles the hierarchy pane and ] toggles the details pane. A collapsed pane gives its width to the map pane immediately; with both collapsed the map fills the full width. Only the camera viewport changes; the world layout stays fixed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 [ and ] toggle their panes and the map pane takes or returns the width immediately
- [x] #2 Collapsing or restoring a pane never changes the world layout, only the camera viewport, verified by comparing map cells with agent-tty
- [x] #3 Footer shows the pane toggles among its hotkeys
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
1. layout.ts: paneLayout(width, height, panes) where panes says whether the hierarchy and details panes are visible; a hidden pane gets zero width and the map pane absorbs it (existing zero-width guards in the painters skip hidden panes).
2. navigation.ts: ViewerState gains panes {hierarchy, details}; toggle-hierarchy and toggle-details actions flip them; hiding the focused hierarchy pane returns focus to the map; Tab reopens a hidden hierarchy pane.
3. terminal-viewer.ts: [ and ] dispatch the toggles; the layout is computed from state.panes each repaint so the camera viewport follows immediately.
4. chrome.ts: footer hints include the pane toggles.
5. Tests: reducer toggle/focus rules; projection invariance (same camera over two viewports differing only in size and origin yields translated cells at equal zoom); live agent-tty check comparing frames before and after toggling. Docs update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review applied: detailsWidth hoisted in layout, initial fitView takes state.panes, test hoists paneLayout and documents the leaf-card clamp skip. Verified live with agent-tty at 120x36: ] then [ gives a full-width map with the camera re-fitting via the existing zoom clamp, [ ] reopen restores three panes; footer shows '[ ] panes'. Reducer tests cover toggle flags and focus fallback; projection test proves equal zoom and pure translation between viewports.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
[ and ] toggle the hierarchy and details panes: pane visibility lives in ViewerState.panes and flows into paneLayout, where a hidden pane gets zero width and the map pane absorbs it; painters skip zero-width panes via existing guards. Hiding the focused hierarchy pane returns focus to the map; Tab reopens it. Verified with reducer and projection-translation tests plus live agent-tty toggling.
<!-- SECTION:FINAL_SUMMARY:END -->
