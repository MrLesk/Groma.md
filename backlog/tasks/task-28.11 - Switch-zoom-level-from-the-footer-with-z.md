---
id: TASK-28.11
title: Switch zoom level from the footer with z
status: Done
assignee:
  - grok
created_date: '2026-08-15 18:15'
updated_date: '2026-08-15 18:28'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone presses `z` in `groma view`, focus moves to the footer strip `- context | containers | components +`. The current level is highlighted. Left and right move that highlight across the minus, the three levels, and the plus. Enter on a level name goes to that level. Enter on minus leaves. Enter on plus enters. `z` again returns to the selected item. Esc leaves the footer without changing the view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `z` focuses the footer and highlights the current level
- [x] #2 Left and right move the highlight across minus, context, containers, components, and plus
- [x] #3 Enter on a level name switches to that level and returns focus to the map
- [x] #4 Enter on minus leaves; Enter on plus enters
- [x] #5 `z` again restores map focus without changing level
- [x] #6 Esc with the footer focused returns to the map without changing level
- [x] #7 docs/viewers/tui/index.md describes this
- [x] #8 Unit and headless tests cover z focus, arrowing the strip, Enter on a level, Enter on plus and minus, and Esc cancel
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
1. Add a zoomSlot on viewer state: leave, context, containers, components, enter. z sets focus to zoom and slot to the current level. z again returns focus to the map.
2. While zoom-focused, left/right move the slot along - context | containers | components +. Enter activates it: a level name jumps to that level, minus leaves, plus enters. Then focus returns to the map.
3. Jump keeps the current selection's ancestor or first child so context shows the system, containers frames that system, and components frames that system's container.
4. Esc with zoom focus and no details returns to the map without changing level.
5. Footer highlights only the current slot. Docs and unit/headless tests cover the strip.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
z sets focus to the footer and zoomSlot to the current level. Left/right move zoomSlot along leave, context, containers, components, enter. Enter activates: jumpView for a level name, leaveView for minus, enterView for plus, then map focus. Esc dismisses zoom focus without changing level. Chrome highlights only the current slot.

Simplicity: jumpView uses ancestorOfKind and firstChildOfKind; zoomSlots and zoomControl stay private; map selection always paints; unused showSelection option removed.

Verification:
- bun test test-bun/terminal-viewer.test.ts 9/9
- bun run check: tsc 7.0.2, 52 Node, 9 Bun
- agent-tty: z then Right Enter → Containers · Groma; z then Esc → map focus, still Containers

Reviews: simplicity FINDINGS applied, targeted re-review leftovers applied, specification PASS, quality PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`z` now focuses the footer strip. The current level is highlighted. Left and right move across minus, context, containers, components, and plus. Enter on a name jumps to that level. Enter on minus leaves. Enter on plus enters. `z` or Esc returns to the map. Verified by viewer tests 9/9, bun run check, and an agent-tty z / Right / Enter walkthrough.
<!-- SECTION:FINAL_SUMMARY:END -->
