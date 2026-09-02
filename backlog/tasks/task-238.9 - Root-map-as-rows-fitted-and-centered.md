---
id: TASK-238.9
title: 'Root map as rows, fitted and centered'
status: To Do
assignee: []
created_date: '2026-09-02 21:04'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - render
dependencies:
  - TASK-238.3
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens the root map, Groma shows the sheet island row, actors, systems and external systems west to east, each island listing one row per child in the sheet placement order: kind glyph and name, then one Unicode block per component (observed ▪, planned and missing ▫, missing dim), then the current task from TASK-238.7. An island is never wider than the map minus the side padding; a longer row wraps its blocks onto the next line with the task at the end of the last line; an island grows down, never past the fold. The selected island is centered, its neighbours peek in the padding on both sides, and Left or Right crosses to a neighbour with a short animated pan. Up and Down walk the rows of an island; the island itself is one stop; Enter on a row opens the container map, which is fitted to the map width and centered the same way with sibling containers peeking; Right past the last building or Left past the first crosses to the neighbouring container and selects its first building; the map scrolls down and up only as far as a selection needs. Groups appear only in the container map. No counts anywhere. A small world fits without wrapping or panning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each island lists one row per child with glyph, name and one block per component in the sheet placement order; no counts
- [ ] #2 A row wider than the island wraps its blocks; an island is never wider than the map minus the padding and grows down instead
- [ ] #3 The selected island is centered with its neighbours peeking on both sides; Left and Right cross to a neighbour with an animated pan; Up and Down walk rows; the island is one stop; Enter on a row opens the container map
- [ ] #4 The container map fits and centers the selected container with sibling containers peeking; Right past the last building or Left past the first crosses to the neighbour; vertical scrolling moves only as far as the selection needs
- [ ] #5 The root map shows no collapsed groups; groups appear only in the container map; the viewer documentation states the change
- [ ] #6 A test on the large-world fixture proves the selected island or container stays centered after every arrow move and that scrolling never exceeds what the selection needs
- [ ] #7 tui-test screenshots at 120x36 and 200x60 match the root map frames on the design page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
