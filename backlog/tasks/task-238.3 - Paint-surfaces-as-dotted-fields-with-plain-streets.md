---
id: TASK-238.3
title: Paint surfaces with the pattern of their kind
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:04'
labels:
  - tui
  - render
dependencies:
  - TASK-238.2
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the terminal map renders, Groma draws every island, slab and zone with the pattern of its kind from the design page: the actors island dots, the external island crosses, a slab a faint grain, a zone a faint hatch, a system island plain. Weight follows depth: island heavy, slab thin, building thin, route dim. The name and kind glyph sit in the top border and origin keeps its line style. Plain ground lies between surfaces. No kind colours: default foreground, dim, bold and the brand green only. Slabs and zones appear only in the container map. The painter reads Core sheet the way the browser renderer does and replaces the boundary, hatch and surface-pattern molecules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Islands, slabs and zones draw their kind pattern dim; the ground between surfaces stays plain
- [ ] #2 Line weight follows depth: island heavy, slab and building thin, route dim; origin keeps solid, dashed and dotted
- [ ] #3 The surface name and kind glyph sit in the top border; no counts anywhere in a border
- [ ] #4 Only viewport cells are painted; the scale checks from the large-world fixture pass
- [ ] #5 tui-test screenshots at 120x36 and 200x60 match the container map frames on the design page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
