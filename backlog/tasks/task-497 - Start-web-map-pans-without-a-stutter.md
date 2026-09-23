---
id: TASK-497
title: Start web map pans without a stutter
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 18:32'
updated_date: '2026-09-23 20:07'
labels: []
dependencies: []
references:
  - map
  - camera
  - render
modified_files:
  - src/viewers/web/iso/style.ts
  - src/viewers/web/layers/paint.ts
  - src/viewers/web/iso/glow.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/pointer.ts
  - test-bun/web-map-pointer.test.ts
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
priority: high
type: bug
ordinal: 578000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex sees a short stutter when a pan starts after the map has come to rest. It shows at zoomed-out levels and disappears when zoomed in close. A Chrome trace on 2026-09-23 showed every pan start, and every settle 250 ms later, restyling about 1,000 map elements: the hover rules for buildings, slabs, system islands, routes and the project pencil depend on the `data-map-moving` flag on the map host, so flipping it invalidates all of them. Steady pan frames restyle nothing. Safari repaints restyled SVG (TASK-305), so the cost grows with how much of the map is on screen. Hover highlights must still pause while the camera moves: that pause is the TASK-305 fix for Safari trackpad inertia.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Chrome trace of drag, 700 ms pause, drag shows no map-wide style recalculation when the second pan starts or when the map settles
- [x] #2 Hover highlights do not change while the camera moves, including trackpad inertia, and move to the element under a resting pointer after the map settles
- [x] #3 Selected, context, focused, touched, lit and endpoint treatments, clicks during and after motion, and the project pencil's hover and keyboard focus look and behave as before
- [x] #4 Alex confirms in Safari that pans start without the stutter at the zoom levels where it appeared
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
1. Hover looks key off a hovered class that iso/map.ts puts on the one building, slab, system island, route or project pencil under a resting mouse (iso/style.ts, layers/paint.ts), instead of CSS :hover gated by a data-map-moving flag on the map host, whose every flip restyled about 1,000 map elements.
2. Motion is a moving value in iso/map.ts. While the map moves, and while a mouse button is held, hover keeps its element; the settle moves it to whatever is under the last pointer position. In Safari, changing the hover look of a large island or slab redraws everything above it, so nothing may change it at a pan start.
3. The selection glow waits while the map moves and hides by opacity (iso/glow.ts hide), never by removal or display: removing it changes the layers over the map and makes Safari redraw the whole map at every pan start and settle.
4. The camera layer stays cached for good (will-change in iso/style.ts) and a zoom commit resets its transform to identity instead of removing it; the per-gesture prepareCamera promotion in iso/map.ts, iso/motion.ts and render.ts is deleted. Removing and re-adding the transform made Safari redraw the whole map on the first pan after every zoom.
5. Mouse drags: a hidden drag cover over the map (iso/map.ts dragging, shown by iso/pointer.ts once a drag moves the map) carries the grabbing cursor, replacing the :active [data-id] cursor rule that restyled every map element at each press and release.
6. Verify with Chrome traces (restyle counts at pan start and settle), native Safari 27 through safaridriver (worst frame in the first 150 ms of a wheel pan with the mouse resting on island ground, after a pan and after a pinch zoom, with and without a selected component), a Safari sharpness screenshot after a zoom, and the real-mouse behaviour script; update the web guide; bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause (Chrome 2026-09-23, 1512x860 at DPR 2, Groma's map, static export of the working tree): every pan start and every settle toggled data-map-moving on the map host; the hover rules were written as #map:where(:not([data-map-moving])) X:hover, so the toggle invalidated 1,007 map elements and cost 3.5-4.3 ms of style recalculation each time, while steady pan frames restyled nothing. The running live server bundled yesterday's code and showed the same cost (1,034 elements). Safari numbers could not be taken: safaridriver sessions time out even with remote automation on.
Change: hover is a hovered class that iso/map.ts puts on the one building, slab, system island, route or project pencil under a resting mouse; a camera change or repaint clears it, and the settle finds it again from the last pointer position. iso/map.ts holds motion in a moving value instead of the host attribute; updateGlows shows no glow while moving, so glow.ts drops its CSS hide rule. Hover rules in iso/style.ts and layers/paint.ts key off .hovered with unchanged specificity and order.
Evidence after the change (same trace method, 4 drag/700 ms pause cycles): pan start restyles 0 elements (15 when a hovered building gives up its look), settle restyles 0-15 elements in at most 0.22 ms; before, 1,007 elements and 3.5-4.3 ms at each start and settle. Real-mouse checks in headless Chrome all pass: hover look under a resting mouse, none while dragging or wheel panning, back on whatever rests under the mouse after settle; a selected building keeps emphasis 1.4 (not hover 1.18); clicks after and during a camera animation select; the selection glow shows at rest, hides while panning and returns after settle; the project pencil's hover and keyboard focus looks match the pre-change build; a route's line shows only while hovered.
bun run check passes: Biome (no warnings in changed files), types, 16 Node tests, 705 Bun tests passed, 43 skipped, 0 failed. No new automated test, as planned: the defect is a style-invalidation cost the DOM-free suites cannot observe.

Alex, 2026-09-23 after restarting groma web with the change: the pan-start stutter remains in Safari, and mouse drags in Safari feel much worse than trackpad pans. Real-mouse Chrome traces then showed a second map-wide restyle that synthetic events cannot trigger: the grab cursor rule #map > .map-surface:active [data-id] made every press and release restyle 2,276 elements (3.2-3.7 ms). Change: iso/map.ts adds a hidden drag cover over the map and exposes dragging(active); iso/pointer.ts shows it once a drag moves the map and hides it when the last pointer lifts; style.ts keeps the grabbing cursor on the pressed sheet and the cover only. Press and release now restyle 300 elements (page chrome, 0.5-0.6 ms). The cover shows the grabbing cursor during drags and is hidden after release; unfinished editing gestures stop the event before the pan code, so they never see it. A click during a Fit animation selects whatever is under the pointer at the press, with or without the cover. bun run check passes again (16 Node, 705 Bun, 0 failed). The Safari cause is still unmeasured: safaridriver sessions from this agent time out.

Safari 27 measurements (automated Safari launched by safaridriver after Alex quit Safari; Safari rejects automation sessions for an instance it did not launch: 'Safari was not launched for automation'). Protocol: 1512x869 window at DPR 2, Groma's map at fit, the mouse resting on open system-island ground (the hover look on the island), then a 24-step wheel pan; the worst frame in the first 150 ms, 4 rounds each. Findings: (a) with a component selected, every pan start stalled 124-224 ms because the glow was removed at the start and rebuilt at settle; glow switched off: 34-36 ms. (b) The first pan after a zoom stalled 124-146 ms because the commit removed the camera transform and will-change; keeping both: 32-36 ms. (c) A hover change on a large island or slab at the moment a pan starts stalled 105-156 ms (seen when the pointer moved and pressed in the same instant); hover switched off: 13-18 ms. Grid hidden and pins hidden: no change. Final code, same protocol: selected 30/18/18/20 ms after a pan and 18/18/23/17 ms after a zoom; nothing selected 17-23 ms; before: 124-142 ms after a pan with a selection and 124-146 ms after a zoom. A Safari screenshot at 1200% after a zoom settles is as sharp as the old code (identical edge energy 0.82). Chrome real-mouse script re-run with the new semantics: 12 checks pass (hover keeps its element during drags and wheel pans and moves on settle; selected emphasis; glow opacity 0 while moving and back after settle; clicks during and after motion). bun run check passes: 16 Node, 706 Bun, 0 failed. AC2 reworded from 'stay off while the camera moves' to 'do not change while the camera moves', which the Safari findings require; the web guide says the same.

Alex confirmed on 2026-09-23 after restarting groma web in his Safari: 'ok it's fixed'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pans on the web map now start without a stutter in Safari. Three things made Safari redraw the whole visible map in the first frame of a pan, worst when zoomed out: removing the selection glow at every pan start and rebuilding it at settle, dropping the camera layer's transform and cache after every zoom, and changing the hover look of a large island or slab at a pan start. The glow now hides by opacity, the camera layer stays cached with an identity transform at rest (the per-gesture prepareCamera promotion is deleted), and hover is a hovered class that keeps its element while the map moves and moves to what is under the pointer when it settles. Two map-wide restyles found in Chrome went too: the data-map-moving flag behind the hover rules (1,007 elements at every pan start and settle) and the :active grab-cursor rule (2,276 elements at every press and release), replaced by a drag cover that shows the grabbing cursor. Verified with native Safari 27 through safaridriver (first frames of a pan 17-23 ms after a pan or a zoom, with or without a selection, down from 105-224 ms; unchanged sharpness after zoom), Chrome traces, a real-mouse behaviour script, bun run check (16 Node, 706 Bun, 0 failed), and Alex's confirmation in Safari.
<!-- SECTION:FINAL_SUMMARY:END -->
