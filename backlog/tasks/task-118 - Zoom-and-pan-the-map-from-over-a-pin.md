---
id: TASK-118
title: Zoom and pan the map from over a pin
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:17'
updated_date: '2026-08-23 10:19'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/render.ts
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pins are HTML overlays above the map's SVG and the wheel listener sits on the SVG, so a pinch or scroll while hovering a pin reaches the browser and zooms the page instead of the map. The map pane should take the wheel wherever the pointer is over it, except over the Live work island, whose chip strip scrolls natively.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pinch or scroll with the pointer over a pin zooms or pans the map and never the page
- [x] #2 A scroll with the pointer over the Live work island scrolls its chip strip and leaves the map camera alone
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
1. src/viewers/web/render.ts: listen for wheel on the map pane (#map) instead of its SVG, so pins and the pin layer are covered; an event whose target lies inside the Live work island is left to the browser so the chip strip scrolls.
2. Verify in the browser by dispatching wheel events on a pin (camera changes) and on the island (camera unchanged).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The wheel listener moved from the map's SVG to the map pane; events from inside #work are left to the browser. Browser evidence: a wheel of (20, 30) dispatched on a pin's head was prevented and panned the camera from (304.47, 195) to (284.47, 165); a ctrl+wheel on the head was prevented and scaled 0.1558 to 0.1722; a wheel on the island's chip strip was not prevented and left the camera unchanged. bun run check green (92 node + 134 bun).

Review: simplest change; two optional nits taken (comment says cursor, the zoom anchor reads the pane's rectangle). Check green after them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map pane, not its SVG, takes wheel events, so a scroll or pinch over a pin pans or zooms the map instead of the page; events from the Live work island are left to the browser so its chip strip scrolls. Verified by dispatching wheel events on a pin and on the island in the browser.
<!-- SECTION:FINAL_SUMMARY:END -->
