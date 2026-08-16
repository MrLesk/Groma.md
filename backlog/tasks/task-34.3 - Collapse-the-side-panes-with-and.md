---
id: TASK-34.3
title: 'Collapse the side panes with [ and ]'
status: To Do
assignee: []
created_date: '2026-08-16 11:17'
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
- [ ] #1 [ and ] toggle their panes and the map pane takes or returns the width immediately
- [ ] #2 Collapsing or restoring a pane never changes the world layout, only the camera viewport, verified by comparing map cells with agent-tty
- [ ] #3 Footer shows the pane toggles among its hotkeys
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
