---
id: TASK-34.2
title: Show the containment tree in the hierarchy pane
status: To Do
assignee: []
created_date: '2026-08-16 11:17'
labels: []
dependencies:
  - TASK-34.1
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hierarchy pane lists the merged world as a containment tree: people, internal systems, and external systems at the root; containers under their system; components under their container. Ghosts carry a distinct marker. The tree and the map share one selection: map moves update the tree highlight, and choosing a tree row selects that element on the map, panning or zooming the camera so it is visible. Groups from element frontmatter stay invisible to the tree, matching navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every element of the merged world appears exactly once, nested by containment; ghosts are marked distinctly
- [ ] #2 Rows are collapsed except the path to the current selection; collapsed rows with children show a child count
- [ ] #3 With the hierarchy pane focused, Up/Down move through visible rows, Left/Right collapse and expand, Enter selects that element on the map and the camera brings it into view
- [ ] #4 Map arrows keep working while the tree highlight follows the map selection
- [ ] #5 The tree scrolls when taller than the pane, keeping the highlighted row visible
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
