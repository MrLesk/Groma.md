---
id: TASK-238.10
title: Open source and diffs in the details pane
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
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a component is selected, the Code section of the details pane lists each file with its line count and the declarations under it, as the browser How it is built tab does. Enter on a declaration opens the source read-only in the details pane at that line; Enter on a modified file of a task opens its unified diff; Escape returns to the previous details. The source, structure and diff readers move from the web plugin to the shared viewer layer so both viewers call one reader; the browser keeps its behaviour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The Code section lists each file with its line count and the declarations under it in authored order
- [ ] #2 Enter on a declaration shows the source read-only at that line inside the details pane; Escape returns
- [ ] #3 Enter on a modified file of a selected task shows its unified diff inside the details pane; Escape returns
- [ ] #4 The source, structure and diff readers live in the shared viewer layer and the web viewer calls the same readers with unchanged behaviour
- [ ] #5 Tests cover the Code section, the source view and the diff view from fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
