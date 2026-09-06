---
id: TASK-34.6
title: Escape from the map's left edge into the hierarchy pane
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:02'
updated_date: '2026-08-16 12:06'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing Left on the map when nothing lies further left, no same-level peer and no outer item in that direction, moves focus into the hierarchy pane with the tree cursor on the current selection, instead of doing nothing. Selection and camera stay unchanged; a hidden hierarchy pane reopens, matching Tab. Escaping right into the details pane waits until that pane is interactive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Left on the leftmost element focuses the hierarchy pane with the cursor on the selection; selection and camera unchanged
- [x] #2 Left with a peer or outer item in that direction keeps its existing selection movement
- [x] #3 The escape reopens a hidden hierarchy pane, matching Tab
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
1. In reduceViewer's architecture-move branch, when moveView returns the unchanged view for a left action, return the same state Tab produces (hierarchy focus, pane visible, tree synced).
2. Extend the unit navigation test where Left on the leftmost person previously did nothing; docs bullet under arrows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Escape branch reuses the tab reduction so 'matches Tab' is structural. Verified live with agent-tty at 120x36: Left from Groma selects Human architect, Left again focuses the tree with the bar on the selection and footer hints switching to hierarchy focus. Unit test covers escape (with hidden pane reopening) and the right edge staying put.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Left on the map with nothing further left now escapes focus into the hierarchy pane by reusing the Tab reduction: tree cursor lands on the unchanged selection and a hidden pane reopens. Verified by unit tests and a live agent-tty session.
<!-- SECTION:FINAL_SUMMARY:END -->
