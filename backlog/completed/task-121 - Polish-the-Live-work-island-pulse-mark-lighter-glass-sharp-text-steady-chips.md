---
id: TASK-121
title: >-
  Polish the Live work island: pulse mark, lighter glass, sharp text, steady
  chips
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:46'
updated_date: '2026-08-23 11:05'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/organisms/work-island.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/style.ts
  - src/viewers/web/organisms/pins.ts
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex's second look at the Live work island: the folded pill should carry the pulse mark (the one the open island's label uses) instead of the hammer; the glass should be a little more transparent; the island's text renders blurry, which comes from centring it with translateX(-50%) of a fractional fit-content width, so the composited, backdrop-filtered layer lands between device pixels and gets resampled; and when the chip strip overflows, its scrollbar takes 4 px under the chips and pushes them up, so the strip must reserve that room whether or not the bar shows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The folded pill shows the pulse mark with its in-progress dot, and the hammer mark is gone
- [x] #2 The island's paper is 55% opaque over the backdrop blur
- [x] #3 The island is centred without a transform, so its layer sits on whole device pixels and its text is sharp
- [x] #4 Chips keep the same vertical position and stay centred on the label whether or not the strip's scrollbar shows
- [x] #5 The pointer over a pin's badge is the hand pointer, as over its task id, not the map's grab hand
- [x] #6 Hovering a building, slab, island or route on the map shows the same hand pointer
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
1. src/viewers/web/organisms/work-island.ts: PULSE_MARK in the folded pill, BACKLOG_MARK deleted; background 55% paper; centred with left 0, right 0, margin auto and width fit-content instead of translateX(-50%); the strip fixed at 48 px with the chips anchored at its top (padding-top 5 px) and the 4 px scrollbar beneath them.
2. docs/viewers/web/index.md: the pill mark sentence.
3. Browser: computed transform none, pulse path in the folded mark, background alpha 0.55, chip centre equal to the label centre with 18 chips (scrollbar) and with 2 (none).

4. src/viewers/web/iso/style.ts: the grab cursor on the map's own svg only (#map > svg), so a pin badge's ring keeps the head's pointer; pins.ts drops the #map prefix its face-svg size needed against that rule.

5. #work sized border-box, so max-width calc(100% - 24px) keeps the 12 px side margins instead of letting the padding push the island 3 px past each map edge; the folded cap moves to 100 px to hold the pill's 97 px.

6. src/viewers/web/iso/style.ts: cursor pointer on the map's [data-id] groups (buildings, slabs, islands, routes), grabbing over them too while the sheet is dragged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (Chrome, 1600x900 and 1280x800): folded mark path M2 12h4l3-8 4 16 3-8h6 with its dot and no hammer path anywhere in the page; computed background color(srgb 1 1 1 / 0.55); computed transform none, the island centred by margins (folded 101 px with equal side gaps, open 976 px in a 1000 px map with 12 px a side); strip 48 px with the chips 5 px from its top and the chip centre equal to the label centre both with the 4 px scrollbar (22 chips) and without overflow (4 chips); cursor pointer over the pin ring, face and task id and over buildings, slabs, system islands and routes, grab on the map svg itself. Corrections on the way: the island was content-box, so its max-width plus padding overran the map by 3 px a side (border-box now, folded cap 100 px); one open-width check ran in a hidden tab where transitions do not tick, so later checks finish the transitions explicitly. Residual: the perceived sharpness on a Retina screen is for Alex to confirm; what was removed is the fractional translate on the composited layer. bun run check green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The folded pill carries the pulse mark; the island is 55% paper over the blur, centred by auto margins instead of a fractional translate so its text is not resampled, and sized border-box so it keeps its 12 px margins; the chip strip holds a fixed 48 px with the chips anchored at its top, so the 4 px scrollbar no longer pushes them; the map's grab cursor applies to its own svg only, with the hand pointer over pins and over buildings, slabs, islands and routes. Verified by DOM script in Chrome (mark path, computed background, transform none, island rects, chip and label centres with and without the scrollbar, computed cursors) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
