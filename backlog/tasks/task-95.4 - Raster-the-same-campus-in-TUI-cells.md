---
id: TASK-95.4
title: Raster the same campus in TUI cells
status: To Do
assignee: []
created_date: '2026-08-18 20:48'
labels: []
dependencies:
  - TASK-95.1
references:
  - src/viewers/tui
  - test/fixtures/openclaw-view
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone uses groma view on the OpenClaw fixture, the terminal map paints the same city contract as the SVG proof: one campus, named level plus underlay, people and externals as marks, readable titles at Context scale.

This task is the TUI raster only. It does not add cone arrows or change chrome/map-first layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI Context shows named systems, people, and externals plus container underlay
- [ ] #2 Software wrappers keep campus size; people and externals are marks
- [ ] #3 Titles remain readable at Context scale
- [ ] #4 The TUI campus matches the city contract from TASK-95.1
- [ ] #5 Fixture tests cover projection and navigation invariants, not decorative glyphs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
