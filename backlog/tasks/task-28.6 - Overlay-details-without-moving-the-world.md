---
id: TASK-28.6
title: Overlay details without moving the world
status: Done
assignee:
  - '@grok'
created_date: '2026-08-15 15:28'
updated_date: '2026-08-15 15:34'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
  - src/viewers/tui/projection.ts
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect opens or keeps the side details panel, the world stays put. The panel paints over the world. The only allowed camera change is to better show the selected item and the items it connects to at the current level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening or closing side details does not change card positions or scale for the same selection and level
- [x] #2 Side details paint over the right of the world instead of shrinking it
- [x] #3 Selecting an item may reframe the camera to that item and its current-level connections
- [x] #4 Headless viewer tests and an agent-tty 120x36 walkthrough cover closed context, person details, and Groma inspect
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
1. Stop reserving world width for the side panel. The world always uses the full viewport; details paint on top of the right side.
2. Drive the camera from the current selection and its visible connections at this level, not from the panel. Level enter still uses the parent system or container.
3. Update the side-panel tests that expected a narrower world, and verify with agent-tty that opening details does not jump the cards.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The world always uses the full viewport. Details paint on top. Projection no longer takes a panel flag. At context the camera is the selection plus its visible connections; inside a system or container it stays on that parent. Simplicity review moved side-panel width into details.ts and dropped the unused panel option. Verified with bun run check (52 Node, 9 viewer) and agent-tty 120x36: selecting Human architect reframes to that person and Groma; Enter overlays details without moving those cards; Enter on Groma still shows Containers with the panel on top.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Side details overlay the world and no longer shrink it. Selecting an item may reframe to that item and its connections. Verified with viewer tests and an agent-tty 120x36 walkthrough of closed context, person details, and Groma inspect.
<!-- SECTION:FINAL_SUMMARY:END -->
