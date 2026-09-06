---
id: TASK-56
title: Pin relationship actions and trace them on the TUI map
status: Done
assignee: []
created_date: '2026-08-16 19:10'
updated_date: '2026-08-16 19:15'
labels: []
dependencies: []
references:
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/relationship-text.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone focuses details on an element with outgoing relationships, Up/Down move among those actions and Space pins them. Pinned actions stay highlighted on the map after leaving details. x clears the pins. The path is the union of walks from each pin along existing directed edges, stopping at cycles. No new Markdown shape. TUI only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Details focus moves a cursor among outgoing relationship rows. Space toggles a pin on the cursor row.
- [x] #2 Pinned paths stay lit after leaving details and while the map selection changes. x clears all pins from details or the map.
- [x] #3 The path is the chosen edges plus outgoing walks from their targets, cycle-safe. Tests use a fixture, not live groma/.
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
1. Path function: union of outgoing walks from pinned relationship ids.
2. Viewer state: pinnedIds plus details action cursor. Space toggles, x clears, persist across focus.
3. Details paints cursor and pin marks; footer names the keys.
4. Map dims off-path routes and cards.
5. Fixture tests for toggle, union, persist, clear, cycle.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Actions are outgoing relationship rows. Space pins, x clears, pins survive leaving details. Path is a cycle-safe outgoing walk. Fixture tests for walk, union, pin/clear. bun test-bun 40/40, node tests 61/61.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI details pane can pin outgoing relationship actions. The map traces the union of those walks until you press x. No new Markdown. Verified with fixture tests and the viewer suite.
<!-- SECTION:FINAL_SUMMARY:END -->
