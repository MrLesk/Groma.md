---
id: TASK-79
title: Light the TUI action path in the accent color
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 18:22'
updated_date: '2026-08-17 18:30'
labels: []
dependencies: []
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback: after picking a person command in the TUI details pane, the lit path is invisible or too subtle. Today the path is only "not dimmed": lit routes draw in plain foreground ink while everything else gets the terminal DIM attribute, which many terminals render almost identically. Mirror the web treatment in terminal vocabulary: draw lit routes, their arrows and labels, and the elements the path touches in the selection accent so the traced journey is unmistakable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While a person command is active, its lit routes, their arrowheads, and their forced labels draw in the selection accent and stand out from the dimmed rest
- [x] #2 The cards and boundaries the lit routes attach to carry the accent as well
- [x] #3 Clearing the command restores the normal drawing; bun test passes
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
1. molecules/route.ts: lit variants for drawRoute (accent color, bold), drawRouteArrow (accent), and drawRouteLabel (accent, bold instead of dim when forced).
2. molecules/card.ts and boundary.ts: a lit flag that draws the border ring in the selection accent, overriding dim.
3. organisms/world.ts: collect the displayed endpoints of lit relationships and pass lit flags through routes, arrows, cards, and boundaries.
4. Verify with agent-tty: select a person, focus details, cycle a command, screenshot; clear and confirm restoration; bunx tsc; bun test; cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: the lit path was only ever not-dimmed plain foreground while the rest got the terminal DIM attribute, which many terminals render nearly identically. Now drawRoute, drawRouteArrow, and drawRouteLabel take a lit flag drawing in theme.selected (terminal accent green) with bold, and drawWorld collects the displayed endpoints of lit relationships so drawCard and drawBoundary draw their border ring in the accent, lit overriding dim. Verified with agent-tty color screenshots at 140x40: selecting Human architect, Enter to focus details, Down to activate the first command lights the person card, its routes, labels, arrowheads, and the target ring in green with everything else dimmed; x restores normal colors. Cold simplicity review applied: single-sourced lit-overrides-dim rule in card.ts, explicit lit in the arrow loop, drawRouteLabel forced renamed to lit. bunx tsc clean; bun test 144 pass (one earlier flaky viewer-lifecycle timeout, green on rerun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI action path now draws in the selection accent: lit routes, arrowheads, and labels render green and bold, the displayed endpoints of the path carry a green border ring, and the rest keeps the dim treatment; clearing with x restores normal drawing. Verified with agent-tty color screenshots before and after activation and after clearing, bunx tsc, and bun test (144 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
