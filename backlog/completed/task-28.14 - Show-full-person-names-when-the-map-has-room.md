---
id: TASK-28.14
title: Show full person names when the map has room
status: Done
assignee:
  - grok
created_date: '2026-08-15 20:36'
updated_date: '2026-08-25 21:34'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect zooms the TUI map, person cards stay the size of their scaled layout box, so names truncate to fragments like Cod and Hum even when empty cells surround the card. Person and external cards should use the compact titled size that fits the full name whenever that card does not cover another box.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Coding agent and Human architect show their full names when empty space around the card is large enough
- [ ] #2 Person cards do not overlap Groma, Git, or each other
- [ ] #3 Viewer tests cover full person names when the map has spare space around those cards
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
1. Size person and external cards to the compact titled box that fits the full name, centered on the layout box, when that titled box stays in the viewport and does not overlap another visible box. Otherwise keep the scaled layout size.
2. Add a viewer test at a zoom where the people have spare space, asserting full names and no overlap. Mention in the TUI docs that compact cards use the full name when there is room.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Historical implementation exists in commit 6aa693f, which added full-name and non-overlap coverage for the former zooming TUI. The current TUI contract now uses one fixed readable scale and no geometric zoom, so the task's original trigger has been superseded. Alex explicitly directed closure on 2026-08-25 regardless of implementation status. No acceptance criterion or Definition of Done item was marked verified by this administrative finalization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed by explicit maintainer direction as stale and superseded. Commit 6aa693f historically implemented and tested the behavior, but it was not re-verified against the current fixed-scale TUI. Acceptance criteria and Definition of Done remain unchecked intentionally.
<!-- SECTION:FINAL_SUMMARY:END -->
