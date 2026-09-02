---
id: TASK-238
title: Give the terminal map a facelift
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:03'
labels:
  - tui
  - render
dependencies: []
references:
  - 'https://claude.ai/code/artifact/e748f7d4-fb0a-4fe8-af7b-8727a745f727'
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view`, Groma shows the terminal map approved on the design page: grey plus the brand green; kinds by glyph, shape and surface pattern; depth by line weight; origin by line style. The root map lists each island as rows, one row per child with one block per component and the current task at the row end; the selected island is fitted to the map width and centered, neighbours peek in the padding, Left and Right pan to them. Enter opens a container map fitted and centered the same way, its buildings one row per floor. Chrome and panes are OpenTUI renderables; the map is one renderable whose painter reads Core sheet. Design and frames: https://claude.ai/code/artifact/e748f7d4-fb0a-4fe8-af7b-8727a745f727. rataflow: conventions only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every subtask is done and `groma view` at 120x36 and 200x60 matches the root map and container map frames on the design page
- [ ] #2 On the large-world fixture, arrow keys reach every element of the current scope, the selected system or container stays centered, and the map scrolls only as far as a selection needs
- [ ] #3 Task corners and status toggles on the map match the browser Live work behaviour
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
