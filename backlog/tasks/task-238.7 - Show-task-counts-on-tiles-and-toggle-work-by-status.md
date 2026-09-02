---
id: TASK-238.7
title: Show task corners and toggle work by status
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:03'
labels:
  - tui
  - work
dependencies:
  - TASK-238.5
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 267000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When Backlog tasks touch elements, the corner of every touched row, slab or building names its current task and adds +N for the other shown tasks: the selected task in Work focus if it touches the element, else the first shown task in work order; in progress in the brand green, to do in the default foreground, done dim, the selected task bold; in the top border beside the name when it fits, else in the bottom border; on a row, at the row end. In the root map a task on a component stands on its container row; a system carries only tasks that reference the system. In Work focus one toggle per configured status hides or shows its tasks on the map, in the corners and in the recap row without changing selection, scope or camera; default and terminal statuses start hidden as in the browser. The details pane lists the tasks touching the selection under To do, In progress and Done with acceptance progress, and Enter opens the full task record: description, criteria, Definition of Done, references, files, plan, notes and comments. Counts of children never appear.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A touched row, slab or building names one task and +N for the other shown tasks, chosen and coloured by the rule in the description; an untouched element shows nothing
- [ ] #2 The task sits in the top border beside the name when it fits, else in the bottom border, or at the end of a row; in the root map a task on a component stands on its container row
- [ ] #3 Work focus shows one toggle per configured status that has at least one mapped task; default and terminal statuses start hidden; toggling hides or shows tasks on the map, in corners and in the recap row without changing selection, scope or camera
- [ ] #4 The recap row shows the count per status and marks which statuses are shown
- [ ] #5 The details pane lists the tasks touching the selected element under To do, In progress and Done with acceptance progress; Enter opens the full task record
- [ ] #6 Corners and toggles update on a live Backlog change without a repaint of the architecture
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
