---
id: TASK-57
title: Open person actions with Enter and space people apart
status: Done
assignee: []
created_date: '2026-08-16 19:22'
updated_date: '2026-08-16 19:22'
labels: []
dependencies: []
references:
  - src/viewers/tui/navigation.ts
  - src/world-layout.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: bug
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone selects a person, Enter focuses details so they can pin actions. Right still moves to siblings and never reaches details. Root people also sit too close; increase sibling spacing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on a person or other leaf focuses the details pane and the first action.
- [x] #2 Enter on a system or container with children still descends. Footer says enter actions when the selection has outgoing rows.
- [x] #3 Root sibling people are spaced farther apart than the previous node gap.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enter on a leaf focuses details.
2. Footer: enter actions when there are outgoing rows.
3. Increase root ELK node spacing.
4. Update navigation tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Enter on a leaf focuses details. Root node spacing 52. Footer says enter actions when the selection has outgoing rows. bun navigation + world-layout + test-bun pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enter on a person opens the action list in details. People sit farther apart on the map. Verified with navigation and viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
