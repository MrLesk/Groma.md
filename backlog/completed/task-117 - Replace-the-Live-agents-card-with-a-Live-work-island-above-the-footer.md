---
id: TASK-117
title: Replace the Live agents card with a Live work island above the footer
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:07'
updated_date: '2026-08-23 10:14'
labels: []
dependencies: []
references:
  - render
  - iso-map
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Live agents card sits top-right over the map and can cover pins. Alex's mockup moves the controls to a floating island at the bottom centre of the map, just above the footer. Collapsed it is a pill: the Backlog.md mark with a dot while a task is in progress, a divider and a chevron; it exists only while at least one task is in progress or done within the day. Pressing the chevron expands it, animated, into the Live work island: a pulse mark and the label, an Agents toggle that hides the in-progress pins on the map and a Completed toggle that hides the finished ones (eye icons, pressed state), then a horizontally scrollable strip of chips, one per pin: the pair's ringed badge and task id, in-progress first, a Done divider and the finished chips in grey. Clicking a chip selects the element its pin stands on. The island keeps its fold and toggles across live updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With at least one pin, a pill sits at the bottom centre of the map above the footer showing the Backlog mark, a dot when a task is in progress, and a chevron; with no pins the map shows nothing there
- [x] #2 Pressing the chevron expands the pill into the island with the Live work label, the Agents and Completed toggles and the chip strip (in progress first, then a Done divider and the finished chips in grey); pressing it again collapses the island; the change animates
- [x] #3 A chip shows its pair's ringed badge and task id and clicking it selects the element the pin stands on
- [x] #4 Agents hides every in-progress pin on the map and Completed hides every finished pin; each toggle shows whether it is on; the chips stay
- [x] #5 The fold and both toggles survive a live update of the pins
- [x] #6 The top-right Live agents card is gone and the web viewer doc describes the island
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
1. src/viewers/web/organisms/pins.ts: drop the Live agents card; add show(agents, completed) that toggles hide classes on the pin layer (CSS hides .pin:not(.done) or .pin.done).
2. src/viewers/web/organisms/work-island.ts (new): createWorkIsland(host, onSelect, onShow) builds #work at the map's bottom centre; collapsed pill (hammer mark, dot while a pin is in progress, divider, chevron), expanded island (pulse mark and label, Agents and Completed eye toggles with aria-pressed, chip strip in progress first then a Done divider and grey finished chips, chevron); paint(pins) reconciles; fold and toggles are module state; the island hides when there are no pins; max-width transition animates the fold.
3. render.ts wires the island and the pin layer's show; page.ts appends the island CSS.
4. docs/viewers/web/index.md: the island replaces the card paragraph.
5. Browser: pill, expand, toggles hide pins, chip click selects, collapse.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built src/viewers/web/organisms/work-island.ts and moved the pin layer's card out; pins.ts exposes show(agents, completed) via hide classes. Browser evidence at 1280x800 against the live board: collapsed pill (mark, dot, divider, chevron) 97 px wide centred in the map pane 12 px above the footer, no #agents card; chevron opens the island: 'Live work' label, Agents=true and Completed=true toggles, 15 chips in progress first (TASK-40, TASK-117) then the Done divider and 13 grey finished chips; Agents off hid the 2 in-progress pins (display none), Completed off hid the 13 finished ones, both back on restored them; clicking the first chip selected ?component=scanner-plugin; with the island open and Agents off, a live world update (generation 2 over /events) left the island open, Agents off and the in-progress pins hidden. bun run check green (92 node + 134 bun).

Simplicity review applied: fold and toggle state moved into createWorkIsland, no show() call on paint (the hide classes live on the persistent pin layer), BADGE is a constant shared by pins and chips, the label is a flex row (the pulse had wrapped above the text), one icon() helper, chip and toggle builders hoisted, rebuild() named apart from paint(), pins.show passed directly. Kept the MARKS map for vendor marks. Check after the review green (92 node + 134 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Live agents card is replaced by the Live work island at the map's bottom centre above the footer: a pill with the Backlog mark, a dot while a task is in progress and a chevron, unfolding with an animation into the Live work label, Agents and Completed toggles that hide the in-progress or finished pins, and a scrollable strip of ringed chips (in progress first, then Done) that select their element on click; fold and toggles survive live updates. Verified in the browser through DOM scripting against the live board, including a live world update with the island open and Agents off.
<!-- SECTION:FINAL_SUMMARY:END -->
