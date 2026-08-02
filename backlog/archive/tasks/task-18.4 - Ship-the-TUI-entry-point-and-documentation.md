---
id: TASK-18.4
title: Ship the TUI entry point and documentation
status: To Do
assignee: []
created_date: '2026-08-01 22:50'
updated_date: '2026-08-02 17:17'
labels: []
milestone: m-3
dependencies: []
references:
  - groma/plans/05-tui-viewer/README.md
  - README.md
parent_task_id: TASK-18
priority: medium
type: feature
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the TUI the same first-class front door the browser viewer has: a documented run command that selects a plan revision or the observed source the way the viewer's server does, and README documentation of the keyboard interaction. No new configuration surface — the terminal theme and viewport are the only environment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A documented command starts the TUI against the same default revision the viewer serves, with the same revision-selection argument the viewer's server accepts.
- [ ] #2 The README documents the TUI's keyboard interaction and its four-level model alongside the browser viewer.
- [ ] #3 No new configuration is introduced: theme and viewport come from the terminal, everything else from the model.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
