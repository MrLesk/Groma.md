---
id: TASK-480.5
title: Read diffs on an opaque pane and step between changed files
status: To Do
assignee: []
created_date: '2026-09-21 21:25'
labels: []
dependencies:
  - TASK-480.4
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
documentation:
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 561000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The details pane is frosted glass. With a file open, the zoomed map glows through the code. Hunk headers share the Added blue, so they read as additions. Moving to the next changed file of a component needs Back and another click. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 While a file or diff is open the details pane is opaque paper in every theme.
- [ ] #2 Hunk headers use muted ink on a neutral band, not the Added colour.
- [ ] #3 When the selected component has more than one changed file, the diff toolbar shows a stepper with position and total. It opens the previous or next changed file in place, and Back still returns to the same component tab and scroll position.
- [ ] #4 The shared renderer keeps serving task diffs. Task review behaviour is unchanged.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
