---
id: TASK-238.4
title: Draw components as buildings with floors
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - render
dependencies:
  - TASK-238.9
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a container map is open, Groma draws each component as a building: the name and kind glyph in the top border; inside, one row per floor, the same one to five floors Core folds the component files into, each row naming the largest file of its floor with +N for the rest, dim; a building is as wide as its name or its longest row; two rows lie between lines of buildings so routes bend between them; the selected building draws its frame one weight level up in the brand green with a bold name; a ghost has one empty row and a dashed or dotted frame. The corner that names a task belongs to TASK-238.7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A building lists one row per floor from Core floorsOf, each row the largest file of the floor and +N for the rest, dim; a ghost shows one empty row
- [ ] #2 A building is as wide as its name or its longest row; a longer file name truncates with an ellipsis and the full name stays in the details pane
- [ ] #3 Two rows lie between lines of buildings and buildings never overlap
- [ ] #4 The selected building draws a heavier frame in the brand green with a bold name; fills and rows never change with selection
- [ ] #5 The scale checks from the large-world fixture pass
- [ ] #6 tui-test screenshots at 120x36 and 200x60 match the container map frames on the design page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
