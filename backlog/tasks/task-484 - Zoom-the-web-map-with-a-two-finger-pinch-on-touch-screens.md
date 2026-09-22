---
id: TASK-484
title: Zoom the web map with a two-finger pinch on touch screens
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 20:26'
updated_date: '2026-09-22 21:31'
labels: []
dependencies:
  - TASK-477
references:
  - camera
  - web-page
  - render
modified_files:
  - test-bun/web-map-pointer.test.ts
  - src/viewers/web/iso/pointer.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
  - src/viewers/web/render.ts
  - groma/relationships.md
type: bug
ordinal: 565000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opening the published map from the README on an iPhone, a two-finger pinch pans the map instead of zooming. The map follows a single pointer, so the second finger replaces the first and the gesture becomes a one-finger pan. This affects every touch screen; a trackpad pinch is unaffected because browsers deliver it as a Ctrl+wheel event. While investigating, the mouse wheel was confirmed to pan by design (browsers report a mouse wheel and a trackpad two-finger scroll as the same wheel event), and Alex decided to keep that: Cmd/Ctrl + scroll zooms. The Help popup never mentions that gesture, so mouse users cannot find how to zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a touch screen, spreading or closing two fingers on the map zooms about the point between them and follows the fingers; moving both fingers together pans
- [x] #2 A two-finger gesture never selects or deselects anything; after lifting one finger, the other continues as a one-finger drag (pan, or orbit in Layers)
- [x] #3 Trackpad two-finger scroll and the mouse wheel still pan; trackpad pinch and Cmd/Ctrl + scroll still zoom
- [x] #4 The Help popup's Map shortcuts name every way to zoom, including Cmd/Ctrl + scroll, and Help still fits without scrolling at 1280x720
- [x] #5 The web viewer guide documents touch-screen pinch and panning
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
1. iso/pointer.ts (Camera control, `camera`) owns every map gesture and hands the camera three actions: pan, zoom and orbit. `pointers` keeps the last point of each pressed pointer; `press` is a lone press that has not dragged, and a second pointer cancels it. While two pointers are pressed, each move pans by the movement of their midpoint, then zooms about the new midpoint by the change in spread. One pointer drags: orbit in Layers unless Shift is held, otherwise pan. The wheel sends wheelAction's step to pan or zoom. `inPane` converts window points into map-pane coordinates for both zoom anchors.
2. render.ts: the `wheel(action, point)` action TASK-477 introduced becomes `zoom(factor, point)`, because its pan branch repeated `pan`.
3. page.ts helpControl: Map rows "Zoom: Pinch or Cmd/Ctrl + scroll" and "Zoom in or out: + −".
4. docs/viewers/web/index.md: one touch-screen sentence under What you can do.
5. Test authority: the reproduced failure (iPhone Safari and synthetic touch pointers: spreading two fingers pans and zoom stays 100%) and the documented contract that a pinch zooms as far as the fingers move. Wrong results detected: two spreading touch pointers pan instead of zooming; a two-finger tap selects or deselects. Coverage gap: bindMapPointer had no test. Smallest test: one test driving bindMapPointer with fake pointer events.
6. groma/relationships.md: the derived pointer.ts to render.ts row as a scan of the TASK-484 snapshot writes it.
7. Verify with bun run check on the TASK-484 snapshot, iOS Simulator Safari, and desktop Chrome.
8. Commit after TASK-477 (committed as e5269cee), staging only TASK-484 hunks in shared files.
This changes viewer input only; it adds no OKF knowledge or C4 concept.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in iso/pointer.ts below the TASK-477 wheel listener: `pointers` keeps the last point of each pressed pointer and `press` is a lone press that has not dragged. A second pointer cancels the press. While two pointers are pressed, each move pans by the movement of their midpoint, then zooms about the new midpoint by the change in spread, through the existing `pan` and `wheel` actions. One pointer drags as before, including the finger left after a pinch. Orbit versus pan is now read on each move (Layers without Shift orbits), which removed the stored gesture and the dragging flag. Wheel handling is unchanged. Help Map rows: "Zoom: Pinch or Cmd/Ctrl + scroll" and "Zoom in or out: + −". Guide: one touch sentence under What you can do.

Verification: the regression test failed before the fix (the old code panned 40 px and never zoomed) and passes after. bun run check passed: Biome, typecheck, 16 Node tests, 665 Bun pass, 38 skip, 0 fail. iOS Simulator (iPhone 17 Pro, iOS 27 Mobile Safari): on the published README map a pinch panned and zoom stayed 100%. On a local export with the fix, pinching out took 100% to 445% (fingers 22 to 98 pt), pinching in took 445% to 136% (98 to 30 pt), centred between the fingers; two fingers moving together panned 60 pt at 100%; one-finger drag panned; a single tap selected a relationship; two-finger gestures selected nothing. Desktop Chrome on the local export: plain wheel panned (0, -100 px, zoom 100%), Cmd+wheel zoomed to 116%, a trackpad pinch (Ctrl+wheel) to 128%, a synthetic touch pinch 128% to 257%; a mouse drag moved a building exactly (50, -10); a click selected container export. Help at 1280x720 ends at 635 px with no Map row overflowing.

Implementer reviews: every acceptance criterion has evidence above; changes stay in the camera gesture binding, the Help rows and one guide sentence; the test drives the binding with minimal fakes and asserts camera actions, so wording changes cannot break it. Pending until TASK-477 is committed: the bindMapPointer summary comment is a TASK-477 line, so its mention of one-finger drag and two-finger pinch waits for that commit, and TASK-484 commits after TASK-477.

Full-context review: the fork agent type is unavailable here, so a general-purpose agent reviewed from a written brief of the whole conversation. It kept the design and recommended: 1) replace wheel(action, point) with zoom(factor, point); 2) one pane-coordinate helper; 3) correct the gesture comments; 4) an explicit drag if/else and the name `still`. Alex approved all four after committing TASK-477 (e5269cee) and TASK-481 (aefa3c8d); all four are applied.

Re-verification after the review changes: 26 focused tests pass. The TASK-484-only snapshot (HEAD plus only TASK-484 hunks) passed bun run check in a temporary worktree: 16 Node, 670 Bun pass, 38 skip, 0 fail. A scan of that snapshot changed only the derived row pointer.ts to render.ts, now "editProject, orbit, orbiting, pan, select, zoom", which was applied to the shared tree. Desktop Chrome on an export: plain wheel panned (0, -100 px), Cmd+wheel 116%, Ctrl+wheel 128%, touch pinch 128% to 257%, mouse drag moved a building (50, -10), identical to before the review changes. iOS Simulator: two fingers moving together panned 60 pt at 100% and selected nothing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A two-finger pinch now zooms the web map on touch screens. iso/pointer.ts tracks each pressed pointer, zooms about the point between two fingers and pans with it, never treats a two-finger touch as a tap, lets the finger left after a pinch keep dragging, and hands the camera pan, zoom and orbit. The wheel is unchanged by decision: it pans, and Cmd/Ctrl + scroll zooms; Help now names that gesture. Verified by a regression test that failed before the fix, bun run check on the TASK-484-only snapshot, pinch in, pinch out and two-finger pan in iOS Simulator Safari, and wheel, pinch, drag and click checks in desktop Chrome.
<!-- SECTION:FINAL_SUMMARY:END -->
