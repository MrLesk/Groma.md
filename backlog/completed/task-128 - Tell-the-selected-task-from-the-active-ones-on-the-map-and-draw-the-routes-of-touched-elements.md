---
id: TASK-128
title: >-
  Tell the selected task from the active ones on the map, and draw the routes of
  touched elements
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 12:59'
updated_date: '2026-08-23 13:06'
labels: []
dependencies: []
references:
  - iso-map
  - render
modified_files:
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
ordinal: 139000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex finds the current selection visuals confusing: the accent ring and the accent task label mark the selected task, while active tasks only regain their colour. New model: every active task's pins wear the accent ring around their badge and keep their own label colour; the selected task (the one in the details pane) carries a small arrowhead above its pin pointing down; routes touching the elements the active tasks touch draw in the accent, solid when both ends are touched (by any active task together) and dotted when only one end is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An active task's pins show an accent ring around their badge and no accent on the task label; the selected task's pin shows a small downward arrowhead above its badge
- [x] #2 Routes with both ends among the elements the active tasks touch draw solid in the accent; routes with one end touched draw dotted in the accent; other routes are unchanged
- [x] #3 Two active tasks touching the two ends of one route between them make it solid
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
1. src/viewers/web/organisms/pins.ts: the accent ring moves to .pin.active .badge, the label keeps --pin, .pin.selected .head::before draws the arrowhead; the chips in the island get the same ring when active and keep the accent border when selected.
2. src/viewers/web/iso/map.ts: mark(ids) also classes each route touched when an end is in the set and half when only one end is; style.ts draws touched routes in the accent, half ones dotted.
3. docs/viewers/web/index.md: the activation paragraph.
4. Browser: classes and computed styles on an active and a selected pin, route classes for one and two active tasks, Escape clears.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (Chrome, 1280x800, checked against an oracle computed from /world.json: touched union per task and ends per route): with TASK-103 active its pins show the accent ring, the task label keeps the pin colour (rgb 47 158 214) and the head's ::before arrowhead is drawn in the accent; 18 elements outlined, 10 routes touched, 6 of them half (dotted, stroke-dasharray 1px 4px), no mismatch; activating TASK-106 as well moved the arrowhead to it, kept both rings, and relationship:40 (one end touched by each task) went from half to solid, again with no mismatch over the union; the active chip in the island shows the 2 px ring; Escape cleared all touched elements, routes and pins. bun run check green (136 bun).

Review applied: the touched-route rules join the existing endpoint and selected accent rules (only the half dash rule is new), the stylesheet header and the docs now name the one exception to line style meaning origin, mark() counts touchedEnds and carries a one-line doc, the arrowhead geometry has a comment, and the docs say dotted when only one end is touched, pins and chips in the plural, and no longer claim solid for ghost routes (a planned or missing route keeps its own dash in the accent). Ring widths stay 3 px on pins and 2 px on the 28 px chip badges on purpose.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Active tasks show an accent ring around their pins' and chips' badges while labels keep the pin colour; the selected task's pins carry a small downward arrowhead; routes touching the elements the active tasks touch, counted together, draw in the accent, dotted when only one end is touched. Verified in Chrome against an oracle computed from /world.json (touched union and route ends for one and two active tasks) and by bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
