---
id: TASK-125
title: >-
  Toggle tasks active from their pins and chips: greyscale until active, several
  at once, the last one in the details pane
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 12:33'
updated_date: '2026-08-23 12:52'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/render.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/style.ts
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex wants the map's pins in greyscale by default, so colour itself signals activation: clicking a pin or a chip activates its task (the pin's and chip's real colours come back and the elements the task touches are outlined), clicking it again deactivates it, several tasks can be active at once, and the task activated last is the one the details pane shows. Escape or a click on empty sheet clears every active task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pins and chips are greyscale until their task is active; an active task's pins and chip show their real colour
- [x] #2 Clicking a pin or a chip activates its task, clicking it again deactivates it; several tasks can be active at once and the map outlines the union of the elements they touch
- [x] #3 The task activated last is selected: the details pane shows it and its pins and chip carry the selection accent; deactivating it selects the task activated before it, or nothing
- [x] #4 Escape or a click on empty sheet deactivates every task; opening a task=<id> link activates that task
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
1. src/viewers/web/render.ts: an ordered list of active task ids next to the selection; toggleTask(id) adds or removes it and selects the task activated last (or the one before it, or nothing); paintSelection marks the union of the active tasks' touched elements and hands the active set plus the selected id to the pins and the island; deselect clears the list; a task id from the URL starts the list.
2. src/viewers/web/organisms/pins.ts and work-island.ts: activate(active, selected) toggles active and selected classes; CSS greys pins and chips with filter grayscale(1) unless active; clicks call onToggle.
3. docs/viewers/web/index.md: the activation paragraph replaces the selection sentences.
4. Browser: click a pin, colour and outlines; click again, grey; two active tasks, both coloured, union marked, last one in the pane; deactivate the last, the earlier one in the pane; Escape clears; reopening task=<id> activates it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (visible tab, 1280x800): pins and chips start with filter grayscale(1) and no active class; clicking the TASK-40 pin head activated it (filter none, active and selected on its pin and chip, ?task=TASK-40, one touched element, scanner-plugin); clicking the TASK-125 pin head kept TASK-40 active, selected TASK-125 and marked three touched elements (the union); clicking the TASK-125 chip deactivated it and TASK-40 became the selection again with its one touched element; clicking the TASK-40 chip cleared everything (no active task, empty pane, empty URL); two active then Escape cleared all; opening /?task=TASK-40 activated and selected it with its chip active and its element outlined. bun run check green (136 bun).

Reproduced Alex's report that chips cannot be clicked: a real pointer click at a chip's centre hit the strip, because the sheet's name-chip rules (#map .chip: pointer-events none and a paper fill) matched the island's .chip buttons inside #map; computed pointer-events on a chip was none. Fix: the two rules are scoped to #map > svg .chip. DOM .click() had bypassed hit testing, which is why earlier checks passed.

Post-review: toggleTask restated with wasActive (no known guard, no activeAction line), active passed as a readonly array, the invariant (the selected task is one of the active ones) noted in the activate docs, the docs say what deactivating the selected task does and that the Done badge flips to a checkmark. Real pointer click evidence after the hit-testing fix: a click at the TASK-125 chip's centre reached the chip (pointerdown and click targets) and activated it, ?task=TASK-125, its pin and chip active, two touched elements; computed pointer-events on chips is auto and elementFromPoint at a chip's centre returns the chip.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pins and chips are greyscale until their task is active; clicking a pin head or a chip toggles the task (colour, outlined touched elements, selection for the last activated one; deactivating the selected task hands the selection to the one before it); Escape and an empty-sheet click clear all; a task=<id> link activates that task. Fixed on the way: the sheet's name-chip rules (#map .chip with pointer-events none) had matched the island's chips, which is why real clicks on chips did nothing; they are scoped to #map > svg .chip. Verified by DOM and real pointer clicks in Chrome and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
