---
id: TASK-238.5
title: 'Light routes only for the selection, a flow or a task'
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - render
dependencies:
  - TASK-238.4
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When nothing is lit, Groma draws every route dim with junction glyphs where routes cross; when an element is selected, a flow is lit or a task is active, the routes touching it turn heavy in the brand green with arrowheads and first-word labels, and everything else stays dim. A route may end on any border cell of a building; on the top border it lands on the name itself, the arrowhead stops above it and no port dot is drawn, since a lit route lights both its ends; elsewhere a port dot marks the cell. Enter on a relationship row in the details pane selects that relationship: its route lights and the pane shows both ends. Lane spacing comes from the sheet. The lit flow keeps its marching dash.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unlit routes draw dim and thin; a crossing of two unlit routes draws a junction glyph instead of one overwriting the other
- [ ] #2 Routes touching the selection, a lit flow or an active task draw heavy in the brand green with an arrowhead at the target; port dots mark ends on side and bottom borders, none on a top border
- [ ] #3 Route labels appear only on lit routes, following the first-word rule, and never overwrite a name
- [ ] #4 Enter on a relationship row selects the relationship: its route lights and the details pane shows both ends as links
- [ ] #5 The marching dash on a lit flow keeps its timing; routes and labels stay on their cells while the selection stays on screen
- [ ] #6 The scale checks from the large-world fixture pass with 500 relationships
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
