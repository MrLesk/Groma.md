---
id: TASK-238.8
title: Fit the chrome to the terminal
status: To Do
assignee: []
created_date: '2026-09-02 21:03'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - render
dependencies:
  - TASK-238.2
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view` in a narrow terminal, the panes start folded by width: the map keeps at least 60 columns; the hierarchy pane takes 26 columns and the details pane 32; at 120 columns and wider both panes are open; from 90 to 119 the details pane starts folded; under 90 both are folded and the footer names the selection. `[` folds or opens the hierarchy and `]` the details at any width; a pane takes its columns from the map and never covers it; both folded is the map-only view. Inside a container map the header shows the scope path (system, container, component count). `p` shows the project profile (title, description, overview) read-only in the details pane. A mouse click selects a row or a building.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Panes start folded by the width table: both open at 120 and wider, details folded from 90 to 119, both folded under 90 with the selection named in the footer
- [ ] #2 `[` and `]` fold or open the hierarchy and details at any width; a pane takes columns from the map and never overlays it
- [ ] #3 Inside a container map the header shows the scope path with the component count
- [ ] #4 `p` shows the project profile in the details pane; Escape or `p` returns to the previous details; nothing is editable
- [ ] #5 A mouse click on a row or a building selects it
- [ ] #6 Tests cover the fold decision per width and the profile view from a fixture under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
