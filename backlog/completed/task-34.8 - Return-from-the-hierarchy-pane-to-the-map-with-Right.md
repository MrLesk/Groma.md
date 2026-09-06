---
id: TASK-34.8
title: Return from the hierarchy pane to the map with Right
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:31'
updated_date: '2026-08-16 12:33'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: bug
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Escaping into the hierarchy pane with Left leaves no arrow way back: Right only expands. In tree focus, Right on a row that cannot expand further, a leaf or an already expanded row, returns focus to the map, mirroring how Left escapes in. A collapsed parent still expands. Selection and the tree cursor stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In tree focus, Right on a leaf row returns focus to the map with selection and cursor unchanged
- [x] #2 Right on an already expanded row returns focus to the map
- [x] #3 Right on a collapsed parent still expands it and keeps tree focus
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
1. reduceTree right branch: when the cursor row has no children or is already expanded, return focus 'architecture' instead of no-op.
2. Extend the tree reducer test; docs sentence under the Tab bullet; live agent-tty check Left-escape then Right back.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review: no findings. Verified live with agent-tty at 120x36: Left Left escapes into the tree (footer shows tree hints), Right returns to the map (footer shows map hints); reducer tests cover leaf, expanded row, and collapsed parent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Right in the hierarchy pane now returns focus to the map when the cursor row cannot expand further (leaf or already expanded), mirroring the Left-edge escape in; a collapsed parent still expands. Verified by reducer tests and a live agent-tty round trip.
<!-- SECTION:FINAL_SUMMARY:END -->
