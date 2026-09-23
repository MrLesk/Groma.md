---
id: TASK-498
title: Let the web map glide after a drag
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 18:32'
updated_date: '2026-09-23 21:10'
labels: []
dependencies: []
references:
  - camera
  - render
modified_files:
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/iso/pointer.ts
  - src/viewers/web/render.ts
  - test-bun/web-map-pointer.test.ts
  - test-bun/web-camera-motion.test.ts
  - docs/viewers/web/index.md
priority: low
type: feature
ordinal: 579000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two-finger trackpad pans keep moving after the fingers lift because macOS sends momentum scroll events, but a mouse or pointer drag on the web map stops dead on release. Alex asked on 2026-09-23 for the same inertia after a drag (a nice addition, not essential). The glide is camera motion, so every other navigation must still be able to take over from wherever the map is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Releasing a map drag while the pointer is still moving keeps the map moving in the same direction and slows it to a stop, with a feel close to trackpad momentum
- [x] #2 No glide follows a drag whose pointer paused before release, a pinch, a Layers orbit drag, or any drag under reduced motion
- [x] #3 A press on the map, the wheel or trackpad, a pinch, zoom buttons and keys, Fit, and selection, search or flow navigation stop a glide at once and continue from the displayed camera
- [x] #4 A press on the map also stops an animated camera transition, as clicking an element already does
- [x] #5 The web viewer guide describes the glide and what stops it
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
1. iso/motion.ts: createCameraMotion gains glide(velocity, now), a third motion beside move and frame. The camera keeps going at the release velocity (screen px per ms) and slows exponentially with a 500 ms time constant, close to macOS trackpad momentum, until its speed falls under 0.02 px/ms; the offset is integrated exactly, so frame rate does not change the distance. move and frame replace a glide, so every other navigation continues from the displayed camera. The animator gains glide(velocity), which does nothing under reduced motion.
2. iso/pointer.ts: the gesture records the positions of a one-pointer pan drag; on release it asks for a glide at the speed over the last 100 ms (a pause longer than that gives no glide). Orbit drags, taps and any gesture that had two pointers never glide. The first press of a gesture calls a new hold action.
3. render.ts: glide maps to camera.glide; hold maps to camera.move(camera.current, false), so a press catches a glide or an animated move. The map-origin line in select() that stopped the camera becomes redundant and is deleted.
4. Tests (authority: TASK-498 AC1; Alex asked for tests of core business logic only). web-camera-motion.test.ts: a glide moves in the release direction, covers less ground each interval, stops, and never moves for a release slower than the stop speed (wrong results caught: a glide that never stops, reverses or creeps; existing tests cover only transitions and framing). The pointer test stub gains no-op hold and glide actions.
5. docs/viewers/web/index.md: one sentence on the glide and what stops it.
6. Verify in headless Chrome with real mouse drags (glide distance, stop, catch by press, no glide after a pause), bun run check, then Alex tries it in Safari.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned: createCameraMotion.glide with a 500 ms time constant and a 0.02 px/ms stop speed, integrated exactly; move and frame replace a glide; the animator's glide does nothing under reduced motion. pointer.ts records one-pointer pan positions with event times, glides at the speed since the oldest position within 100 ms of release, never glides after two pointers or an orbit drag, and calls hold on the first press of a gesture. render.ts maps hold to camera.move(camera.current, false) and glide to camera.glide; the map-origin camera stop in select() is deleted because the press now holds the camera; editProject became a one-line handler to keep render.ts at 499 lines. Tests: web-camera-motion.test.ts (direction, slowing, stopping, no movement below the stop speed, navigation replaces a glide) and web-map-pointer.test.ts (release glides at the drag speed; pause, tap, orbit and pinch do not; the press holds). Headless Chrome with frame-paced pointer events on a static export: a flick moved 218 -> 382 px in 150 ms and stopped at 787 px; no glide after a 250 ms pause; a press held the camera; the wheel took over; reduced motion gave no glide. Playwright's own mouse moves were delivered 50-190 ms apart on the loaded machine, which the map correctly treats as a pause, so frame-paced events were used for the check.

Alex tried the glide and replied 'looks good' (2026-09-23). Clean checkout of HEAD plus only this task's files: biome lint, the scrollbar lint, typecheck and 16 Node tests pass; all 23 web and iso Bun test files pass (113 tests; export, sharing and revision tests need the repository's 20 s timeout under load). The full Bun suite had Swift, Vue and Java scanner tests time out at 20-60 s in both the clean checkout and the shared tree while the machine's load average was 52-76; none of those files import the changed web modules.

Alex asked for tests of core business logic only (2026-09-23): the pointer gesture glide test and the 'navigation replaces a glide' test were removed, and the pointer test returns to its earlier pinch and tap expectations with no-op hold and glide stubs. The glide physics test remains; the web and iso Bun tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A mouse or pointer drag on the web map released while still moving now glides on in the same direction and slows to a stop, like trackpad momentum. The camera motion gained a glide beside its animated move and framing: the speed decays with a 500 ms time constant and the distance is integrated exactly, and any move or frame replaces it, so wheel, pinch, zoom, Fit and panel navigation continue from the displayed camera. The drag gesture measures the release speed over its last 100 ms; a pause before release, a pinch or a Layers orbit does not glide, reduced motion turns it off, and the first press of every gesture holds the camera, catching a glide or an animated move (the old map-click camera stop in render.ts became redundant and was deleted). Verified with a unit test for the glide physics, real-browser checks in headless Chrome, the web guide update, and Alex's check.
<!-- SECTION:FINAL_SUMMARY:END -->
