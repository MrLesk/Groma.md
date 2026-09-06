---
id: TASK-109
title: 'Pan the map by scrolling, zoom by pinch or cmd+scroll'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 21:40'
updated_date: '2026-08-22 21:47'
labels: []
dependencies: []
references:
  - iso-camera
  - render
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a trackpad, two-finger scrolling over the web map zooms today, so moving around needs a drag. Like other infinite canvases, two fingers should pan the map and a pinch should zoom; with a mouse, cmd or ctrl with the wheel zooms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A wheel event without cmd or ctrl pans the map by the scroll delta on both axes and never zooms
- [x] #2 A trackpad pinch (ctrl+wheel) and cmd+wheel zoom about the cursor as before
- [x] #3 Dragging, the - + 0 keys and the footer buttons behave as before
- [x] #4 The web viewer doc describes scrolling as panning
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
1. Add a pure wheelAction(event) to src/viewers/web/iso/camera.ts: ctrl or cmd with the wheel gives a zoom factor (pinch rate for ctrl, wheel rate for cmd), anything else pans by the negated scroll deltas.
2. The wheel listener in src/viewers/web/render.ts pans, or zooms about the cursor, from that action.
3. Cover wheelAction in test-bun/iso-map.test.ts in place of the wheelFactor assertions.
4. Update the camera paragraph in docs/viewers/web/index.md.
5. Verify in the browser by dispatching wheel events on the map and reading the camera transform.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented wheelAction in iso/camera.ts and wired the wheel listener in render.ts. bun run check green (92 node + 127 bun tests). Browser check on http://localhost:4747 by dispatching wheel events on the map: a plain wheel of (40, 60) moved the camera translate from (250.78, 195) to (210.78, 135) with the scale unchanged; ctrl+wheel -10 scaled 0.1549 to 0.1712 (exp 0.1); cmd+wheel -100 scaled to 0.1989 (exp 0.15), readout 128%.

Simplicity review: inlined wheelFactor and the exported WheelAction type into wheelAction; footer hint now reads 'drag or scroll pan · pinch zoom · + − 0'. Re-verified after a server restart: plain wheel (-25, 10) moved translate (250.78, 195) to (275.78, 185) at the same scale; ctrl+wheel 10 scaled 0.1549 to 0.1402; cmd+wheel -100 scaled 0.1402 to 0.1628. bun run check green (92 node + 127 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A wheel event on the map now pans by its scroll delta; ctrl (trackpad pinch) or cmd with the wheel zooms about the cursor, through the pure wheelAction in iso/camera.ts. Verified by the wheelAction unit test and by dispatching wheel events in the browser and reading the camera transform; drag, keys and footer buttons untouched; doc and footer hint updated.
<!-- SECTION:FINAL_SUMMARY:END -->
