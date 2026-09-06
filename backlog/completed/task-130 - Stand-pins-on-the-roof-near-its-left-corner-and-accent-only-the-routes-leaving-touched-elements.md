---
id: TASK-130
title: >-
  Stand pins on the roof near its left corner, and accent only the routes
  leaving touched elements
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 13:13'
updated_date: '2026-08-23 13:30'
labels: []
dependencies: []
references:
  - iso-map
  - render
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex's review of the corner pins: the foot must sit on the roof (a slab's top or an island's surface) close to its left corner but a little inside it, not at the base of the building; and the accented routes must be only those leaving an element an active task touches (an incoming route from an untouched element, such as Scan to Scanner plugin while only Scanner plugin is touched, stays plain), dotted when the target is untouched and solid when the target is touched too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pin's foot sits on its element's roof, slab top or island surface, 18 world pixels east of the surface's westmost point, and the pins of one element fan leftwards from there
- [x] #2 A route is accented only when its source is a touched element: solid when its target is touched too, dotted otherwise; a route into a touched element from an untouched one is unchanged
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
1. src/viewers/web/iso/map.ts: anchorOf takes the westmost point of the top face (or slab top or island polygon) and moves it 18 world px east, which on the sheet runs along the surface towards its centre; mark() classes a route touched when its source is in the set and half when its target is not.
2. src/viewers/web/organisms/pins.ts and style.ts: comments follow.
3. docs/viewers/web/index.md: the stem, fan, route and line-style sentences.
4. Browser: pin foot equals the roof's westmost point plus 18 px times the camera scale; with a task touching one element, only its outgoing routes are accented, all dotted, and its incoming route is plain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (Chrome, my own server on port 4748 since 4747 was held by another agent's groma web; camera scale 0.59): the TASK-40 pin's foot sits exactly 18 world px east of the Scanner plugin roof's westmost point and inside the roof polygon; with TASK-40 active only the two routes leaving Scanner plugin are accented, both dotted (their targets untouched), and the incoming Scan → Scanner plugin route stays plain; an oracle from /world.json (source in the touched set, target in or out) matched every route class. bun run check green (136 bun).

Review applied: FOOT_INSET carries only the quantity and onSurface explains the geometry (both edges at a west corner run rightwards, so a straight screen-right move heads into the surface).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A pin's foot stands on its element's surface (a building's roof, a slab's top, a system island) 18 world pixels east of that surface's westmost point, which on the sheet heads into the surface, so pins sit near the left corner and clear of the roof name; the pins of one element fan leftwards from there. Routes are accented only when they leave an element an active task touches, dotted when the target is untouched, so an incoming route from an untouched element stays plain. Verified in Chrome against the projected faces and an oracle from /world.json, and by bun run check (92 node, 137 bun).
<!-- SECTION:FINAL_SUMMARY:END -->
