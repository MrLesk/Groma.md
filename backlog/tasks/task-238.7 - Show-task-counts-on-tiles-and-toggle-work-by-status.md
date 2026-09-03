---
id: TASK-238.7
title: Show task corners and toggle work by status
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 15:56'
labels:
  - tui
  - work
dependencies:
  - TASK-238.5
modified_files:
  - src/work/status-filter.ts
  - src/viewers/web/work/status-filter.ts
  - src/viewers/web/work/island.ts
  - test-bun/work-status-filter.test.ts
  - src/viewers/tui/work/model.ts
  - src/viewers/tui/work/navigation.ts
  - src/viewers/tui/panes/hierarchy.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/view-host.ts
  - test-bun/work.test.ts
  - docs/viewers/tui/index.md
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
- [x] #1 A touched row, slab or building names one task and +N for the other shown tasks, chosen and coloured by the rule in the description; an untouched element shows nothing
- [x] #2 The task sits in the top border beside the name when it fits, else in the bottom border, or at the end of a row; in the root map a task on a component stands on its container row
- [x] #3 Work focus shows one toggle per configured status that has at least one mapped task; default and terminal statuses start hidden; toggling hides or shows tasks on the map, in corners and in the recap row without changing selection, scope or camera
- [x] #4 The recap row shows the count per status and marks which statuses are shown
- [x] #5 The details pane lists the tasks touching the selected element under To do, In progress and Done with acceptance progress; Enter opens the full task record
- [x] #6 Corners and toggles update on a live Backlog change without a repaint of the architecture
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
1. The web's status filter rules move to src/work/status-filter.ts beside pins.ts so both viewers read one: the first snapshot shows every configured status except the default and the final ones, only statuses with a mapped task are toggles, and a toggle flips one status.
2. work/model.ts: the Work focus carries its shown statuses; projectWork gives every visible element its corner: the task naming it (the selected task if it touches the element, else the first shown task in work order), how many other shown tasks touch it, its stage (to do, in progress, done) and whether it is the selected one; hidden statuses count nowhere on the map. At root a task on a component stands on its container row through the visible promotion; a system island carries only tasks touching the system.
3. molecules/work-marker.ts draws the corner: the task id and +N, in progress in the accent, to do plain, done dim, the selected task bold; in the top border beside the name when it fits, else in the bottom border; on a row at the row end.
4. Work focus: the task list's status headers are cursor stops with a shown or hidden mark; Enter on one toggles the status without changing selection, scope or camera; the recap row counts every status and marks the shown ones.
5. Details pane: the What tab lists the tasks touching the selection under To do, In progress and Done with acceptance progress; the cursor walks them after the relationships; Enter opens the full record (description, criteria, Definition of Done, references, files, plan, notes, comments) read through the work source the host passes in, and Escape returns.
6. Live Backlog changes flow through the existing update path, keeping the shown statuses. Tests in work.test.ts on synthetic worlds: the corner rule and promotion, the toggle start state and its effect, the recap marks, the details task list and the record opening with a stub reader. Docs: the Work focus section. Captures at 120x36.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: the web's status filter rules moved to src/work/status-filter.ts beside the pin rules so both viewers read one (the web's import follows). work/model.ts: the Work focus carries its shown statuses (at first every configured status but the default and final ones); mappedStatuses names the toggles; projectWork gives every visible element a corner from the shown tasks touching it (the selected task if it touches the element, else the first shown task in work order; +N for the others; stage from the status; selected flag), promoting a component's task to its container row at root while a system island carries only tasks touching the system; workRows lists statuses and tasks and moveWorkFocus walks both. work/navigation.ts: Enter on a status header toggles it, Enter on a task's details opens its record. molecules/work-marker.ts draws the corner: task id and +N, in progress in the accent, to do plain, done dim, the selected task bold; in the top border beside the name when it fits, else the bottom border; on a row at the row end. The recap row counts every status with a shown mark on the toggles. The details pane lists the tasks touching the selection under To do, In progress and Done with acceptance progress; the cursor walks them after the relationships; Enter opens the full record (description, criteria, Definition of Done, plan, notes, comments), read through readTask, which the host wires to the work source; Escape returns. Live Backlog changes flow through the existing update path and keep the shown statuses. Docs: the Work focus section.

Evidence: work tests cover corners with hidden statuses and the selected task, root promotion, the toggle start state and its flip without moving the map, the details task walk and record opening, and the host read of the record; terminal suites 61 pass, typecheck clean, lint 4 pre-existing warnings. tui-test captures of the repository's own map at 120x36: corners 'TASK-238.7' at the row ends of the touched containers, the recap '✓ 1 In Progress · ○ 10 To Do · ○ 261 Done', and the Work focus list with '✓ In Progress' and '○ To Do' toggles. Reviews: implementer-only while the review agents are rate-limited until 12:50; separate-agent passes owed. Follow-up: a row does not reserve space for its corner, so the label covers the end of a full strip of blocks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every row, slab or building a shown task touches carries a corner naming its current task and +N for the others, coloured by stage and bold when selected, placed beside the name, in the bottom border or at the row end; at root a component's task stands on its container row and a system carries only its own. Work focus offers one toggle per status with a mapped task, starting with the default and final statuses hidden, and the recap row counts every status and marks the shown ones. The details pane lists the tasks touching the selection by stage with acceptance progress and Enter opens the full record through the work source; live Backlog changes keep the toggles.
<!-- SECTION:FINAL_SUMMARY:END -->
