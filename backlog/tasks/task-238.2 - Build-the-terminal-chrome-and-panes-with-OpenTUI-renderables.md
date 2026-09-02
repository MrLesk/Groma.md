---
id: TASK-238.2
title: Build the terminal chrome and panes with OpenTUI renderables
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-02 21:03'
labels:
  - tui
dependencies:
  - TASK-238.1
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view`, Groma shows the same header, hierarchy pane, details pane and footer built from OpenTUI Box, Text, ScrollBox and TabSelect renderables instead of hand-painted cells, with the pane typography from the design page: a kind glyph, a bold title, one dim line of detail, values coloured by meaning. Every colour is a terminal intent: default foreground and background, bold, dim and the brand green #1D9E75. Nothing is a sampled palette mix, so a terminal theme switch recolours the viewer live, as the splash does, and the startup palette query goes away. The map stays the current painter inside one renderable so this ships alone. Keys do not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Header, hierarchy, details and footer are OpenTUI renderables laid out by the toolkit; panes reserve width and never overlay the map
- [ ] #2 Hierarchy and details scroll and wrap through ScrollBox; long descriptions are never clipped
- [ ] #3 Rows and cards follow the page: glyph, bold title, dim detail line, coloured values; the details tabs use TabSelect
- [ ] #4 Every colour is a default, dim, bold or brand-green intent; no palette query at startup; a test proves no sampled RGB reaches a cell
- [ ] #5 Every existing key, focus rule and pane toggle behaves as before; navigation tests pass unchanged
- [ ] #6 tui-test screenshots at 120x36 and 200x60 match the pane treatment on the design page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
