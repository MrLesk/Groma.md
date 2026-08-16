---
id: TASK-34
title: Redesign the TUI into three fixed panes
status: To Do
assignee: []
created_date: '2026-08-16 11:17'
labels: []
dependencies: []
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI moves from overlay details and a footer level strip to fixed chrome: a header, a footer, and three width-reserving panes (hierarchy tree left, map center, details right). Panes never overlay the map. Collapsing a pane resizes the map viewport; the world layout itself never changes. The sidebar owns level navigation, the footer owns contextual hotkeys, zoom state, filtering, and messages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The TUI renders header, three panes, and footer as described by the subtasks, verified with agent-tty at 120x36 and 200x60
- [ ] #2 docs/viewers/tui/index.md describes the three-pane TUI without overlay details or the z strip
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
