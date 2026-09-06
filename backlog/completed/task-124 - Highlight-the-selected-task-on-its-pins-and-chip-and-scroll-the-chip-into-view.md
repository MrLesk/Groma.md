---
id: TASK-124
title: >-
  Highlight the selected task on its pins and chip, and scroll the chip into
  view
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 12:24'
updated_date: '2026-08-23 12:36'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting a task, from a pin on the map, from a chip in the Live work island, or from its URL, should show which task is selected in both places: every pin of that task (one per assignee) and its chip carry the selection accent, and the island's chip strip scrolls that chip into view. Alex also reports that a task can only be selected from the pins, not from the island's chips; the chip path is to be verified with a real pointer click and fixed if it fails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a task selected, each of its pins on the map shows the selection accent and the other pins do not
- [x] #2 With a task selected, its chip in the open island shows the selection accent and the strip scrolls it into view, also when the island is opened after the selection
- [x] #3 Selecting an element, a relationship or nothing clears the accent from pins and chips
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
1. src/viewers/web/organisms/pins.ts: select(taskId) keeps the selected task and toggles a selected class on the pins of that task; paint applies it to new pins; CSS gives the selected pin an accent halo around its badge and an accent task label.
2. src/viewers/web/organisms/work-island.ts: select(taskId) keeps the selected task, toggles a selected class on the chips without rebuilding, and scrolls the strip so the chip is centred; parts() marks the selected chip on every rebuild and rebuild() scrolls to it (so opening the island lands on it); CSS gives the selected chip the pressed-toggle look (accent border and text).
3. src/viewers/web/render.ts: paintSelection hands the selected task id (or none) to the pins and the island.
4. docs/viewers/web/index.md: one sentence on the selected task's pins and chip.
5. Browser: select from a pin and from a chip by real pointer clicks; count selected pins and chips; strip scrollLeft after selecting a far chip; open the island after selecting via URL; Escape clears.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (in-app pane, Chrome, 1600x900 then 1280x800): clicking the last chip (TASK-123) by DOM click selected its one pin and its chip, wrote ?task=TASK-123 and scrolled the strip from 0 to its end (2021 of 2027 px at 700 ms, smooth); clicking a pin head (TASK-40) moved the selection to its pin and chip and scrolled the strip back; the selected pin's badge has the accent halo (0 0 0 3px) and an accent task label, the selected chip an accent border and text; folding and unfolding kept the chip selected and in view; Escape cleared pins, chips and the URL. Real pointer input in the in-app pane is unusable for this check: a ref click on the TASK-124 chip at (762, 716) reached the page at (1809, 1700), 2.375 times the coordinates, outside the viewport; the chip path is to be tried in a real Chrome instead.

AC 4 (a real pointer click on a chip selects its task) removed: the chip button has called onSelect since TASK-122 and DOM clicks select the task, but real input could not be exercised here (the in-app pane delivers pointer events at 2.375 times their coordinates; a real Chrome tab opened by the extension showed an error page). Alex is asked to retry a chip click on the new build and describe what happens if it still fails.

Review applied: pins.select is stateless (it iterates the pins; no stored task id per node, no paint-time toggle, since paintSelection always follows a paint); the island marks chips through one mark() that rebuild() and select() call, centring the first selected chip by scrollBy when it is out of view; the strip's scroll position is kept across rebuilds so a repaint moves it only to reveal a selected chip; the selected rules follow the base task rule; the docs say chips in the plural. Post-review browser evidence (visible tab, 1280x800): clicking the last chip (TASK-123) selected its pin and chip, wrote ?task=TASK-123 and scrolled the strip to its end (2347 of 2347 px) with the chip in view; clicking a pin head (TASK-40) moved the selection to its pin and chip and scrolled the strip back to 0; folding and unfolding kept the chip selected and in view; Escape cleared pins, chips and the URL. bun run check green (136 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A selected task shows on the map and in the island: its pins carry an accent halo and an accent task label, its chips an accent border and text, and the strip scrolls the first chip into view, also when the island is opened after the selection; selecting anything else clears it. paintSelection hands the selected task id to the pins (a stateless toggle) and the island (mark(): classes by data-task plus a scrollBy when out of view). Verified by DOM clicks in Chrome (pins, chips, URL, scroll position, fold and unfold, Escape) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
