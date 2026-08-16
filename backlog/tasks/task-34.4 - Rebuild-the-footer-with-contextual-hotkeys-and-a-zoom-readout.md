---
id: TASK-34.4
title: Rebuild the footer with contextual hotkeys and a zoom readout
status: To Do
assignee: []
created_date: '2026-08-16 11:17'
labels: []
dependencies:
  - TASK-34.1
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The footer shows only the hotkeys that apply to the focused pane, plus zoom controls with a readout of camera state: fit when the whole map fits, a percentage between, and 1:1 at the closest zoom. The z level strip and its focus mode are deleted; the hierarchy pane owns level jumps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Footer hotkeys change with the focused pane
- [ ] #2 Zoom readout shows fit at whole-map fit, a percentage in between, and 1:1 at closest zoom, updating as the camera zooms
- [ ] #3 The z strip, its keybinding, and its focus mode are removed from code, keys, and docs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
