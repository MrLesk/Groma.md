---
id: TASK-238.11
title: Browse revision history in the terminal
status: To Do
assignee: []
created_date: '2026-09-02 21:04'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - core
dependencies:
  - TASK-238.2
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing `h` lists in the hierarchy pane the commits of the current branch that changed the Groma directory, newest first, as the browser revision menu does; Enter loads that revision as a read-only world with no Backlog work; the header names the revision; Escape returns to Current and live updates resume. Commits without the required Groma project profile are listed but cannot be selected. Uses the core Git history reader the browser calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `h` lists the revisions in the hierarchy pane, newest first, with subject, short hash and date; `h` or Escape leaves the list
- [ ] #2 Enter on a revision loads its world read-only with no work markers; the header names the revision
- [ ] #3 Escape from a historical world returns to Current and live updates resume
- [ ] #4 Commits without the required project profile are shown as unsupported and cannot be selected
- [ ] #5 Tests cover the list and the switch using a fixture repository under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
