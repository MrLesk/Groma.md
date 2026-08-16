---
id: TASK-34
title: Redesign the TUI into three fixed panes
status: Done
assignee: []
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 12:26'
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
- [x] #1 The TUI renders header, three panes, and footer as described by the subtasks, verified with agent-tty at 120x36 and 200x60
- [x] #2 docs/viewers/tui/index.md describes the three-pane TUI without overlay details or the z strip
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI now runs in fixed chrome: header with the groma wordmark and exit hint, three width-reserving panes (containment tree, map viewport, always-on details), and a contextual footer with a zoom readout that doubles as the / filter line. Panes collapse with [ and ], the focused pane is highlighted, map edges escape into the side panes, and the z strip and overlay details are gone. Delivered across TASK-34.1-34.7, each verified with logic tests (21 concurrent bun tests plus 56 node tests) and live agent-tty sessions at 120x36, 80x12, and 200x60; docs/viewers/tui/index.md describes the new surface with no overlay or z strip mentions.
<!-- SECTION:FINAL_SUMMARY:END -->
