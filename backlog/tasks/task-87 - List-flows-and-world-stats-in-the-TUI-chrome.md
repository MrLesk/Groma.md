---
id: TASK-87
title: List flows and world stats in the TUI chrome
status: To Do
assignee: []
created_date: '2026-08-17 21:38'
labels: []
dependencies: []
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI hierarchy pane shows only the element tree and the header only the wordmark. List every person command above the tree, reachable with the pane cursor and pickable with Enter, and show the observed system name with live flow and element counts in the header, matching the web chrome. Dark mode is out of scope: the terminal already owns the palette.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The hierarchy pane lists every person command above the tree; the pane cursor reaches them and Enter lights that walk, with the active row marked
- [ ] #2 The header shows the observed system name with live flow and element counts
- [ ] #3 The flows rows joining the pane cursor and the Enter pick are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
