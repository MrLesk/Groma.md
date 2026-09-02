---
id: TASK-238.6
title: Show a keys box with ?
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:04'
labels:
  - tui
dependencies:
  - TASK-238.8
parent_task_id: TASK-238
priority: medium
type: feature
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing `?` shows a keys box listing every map key: arrows, Enter, Backspace, Tab, Escape, `/`, `w`, `[`, `]`, `t`, `s`, `x`, `h`, `p`, `r`, `?` and Ctrl+C. It takes the details pane area, opening the pane if it is folded, so it never overlays the map; Escape or `?` closes it and restores the previous details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `?` shows the keys box in the details pane area and opens that pane if it was folded; Escape or `?` closes it and the previous details return
- [ ] #2 The listed keys are exactly the keys the viewer handles; a test compares the list with the key table
- [ ] #3 The map never changes while the keys box is open
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
