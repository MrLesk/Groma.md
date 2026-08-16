---
id: TASK-34.5
title: Jump anywhere with a / filter in the footer
status: To Do
assignee: []
created_date: '2026-08-16 11:17'
labels: []
dependencies:
  - TASK-34.4
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
/ turns the footer into a filter input over element names in the merged world. Typing narrows matches; the footer shows the match position and current match name; the selection and camera follow the current match live. Enter keeps the selection and closes the filter; Esc restores the selection and camera from before the filter opened.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 / opens the filter in the footer and typing filters merged-world element names
- [ ] #2 The current match drives selection and camera live, with match position and name shown in the footer
- [ ] #3 Enter accepts the match; Esc cancels and restores the prior selection and camera
- [ ] #4 The filter works with side panes collapsed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
