---
id: TASK-131
title: >-
  Arrive at the side of the target that faces the source, as routes already
  leave from it
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 13:20'
updated_date: '2026-08-23 13:30'
labels: []
dependencies: []
references:
  - sheet
modified_files:
  - src/sheet/route.ts
  - test-bun/sheet-route.test.ts
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web doc promises that a route leaves from the side of the source that faces the target and arrives at the side of the target that faces the source. The router applies that preference only to departures (SIDE_PENALTY on a start through a non-facing side); every side of the target is an equal goal, so an arrival often picks a back side's centred port over the facing side's off-centre one and hooks around the building, which on screen leaves a detached stub of accent arrow above the roof (Alex: a stray arrow on Scanner plugin to Typescript files). Arrivals through a non-facing side get the same penalty as departures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A route whose target lies straight north, east, south or west of its source arrives through the target's side that faces the source whenever that side has a free port; Scanner plugin to Typescript files in this repository's own world enters the south side of Typescript files
- [x] #2 The existing route invariants hold: arrivals point into the side they enter, ends sit on a side or just behind a back side, lanes stay clear of foreign buildings, parallel routes spread around the middle
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
1. src/sheet/route.ts: the goal of a port on a side of the target that does not face the source costs SIDE_PENALTY more, the way a start through a non-facing side does; the facing test mirrors the one for starts.
2. test-bun/sheet-route.test.ts: a hand-built world with a target straight north of its source asserts the arrival port lies on the target's south side; the existing suites stay green.
3. Browser: Scanner plugin to Typescript files ends on the south side and the accent route shows no hook.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured on this repository's own world (55 routes), before and after: arrivals through the side facing the source 44/55 to 49/55, departures unchanged at 54/55, total route length 1017.5 to 1013 cells, bends 92 to 98. Scanner plugin to Typescript files entered the west back side with a hook (the stray arrowhead Alex reported) and now enters the south front side pointing north into it. No route became invisible: sampling every route against the buildings drawn over them, the hidden fraction stays 9% overall with no fully hidden route. bun run check green (92 node, 137 bun); the one earlier node failure (watchScan) did not reproduce and was a timing flake.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A route now pays the same side penalty for arriving through a side of the target that does not face the source as it already paid for leaving through one, so it keeps the arrival promise the router's own documentation makes. On this repository's world, facing arrivals rise from 44 to 49 of 55 and the route that produced a detached arrowhead over Typescript files now enters that building's front side. A new route test locks the behaviour with a target whose facing side has only off-centre ports, and the existing invariant suites stay green.
<!-- SECTION:FINAL_SUMMARY:END -->
