---
id: TASK-34.10
title: Make the tree cursor obvious and Enter expand what it selects
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-16 12:47'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: bug
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hierarchy cursor row is barely visible: its tint is too subtle to spot. The focused cursor row now renders inverted, selection accent background with background-colored text. Enter on a tree row keeps selecting the element on the map and additionally expands the row when it has collapsed children, so Enter on a system or container opens its group in place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With the hierarchy pane focused, the cursor row renders inverted in the selection accent and is obvious at a glance
- [ ] #2 Enter on a collapsed parent selects it on the map and expands its children in the tree
- [ ] #3 Enter on a leaf keeps its current select-on-map behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. hierarchy.ts: focused cursor row paints selection-accent background with background-color text; the selection bar stays visible on that row.
2. reduceTree enter: also move the row from collapsed to expanded when it has children.
3. Reducer test for select+expand; live agent-tty screenshot for the highlight.
<!-- SECTION:PLAN:END -->
