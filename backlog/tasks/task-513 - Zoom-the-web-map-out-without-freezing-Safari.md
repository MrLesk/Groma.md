---
id: TASK-513
title: Zoom the web map out without freezing Safari
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 09:16'
updated_date: '2026-09-24 09:37'
labels: []
dependencies: []
references:
  - camera
  - render
  - map
modified_files:
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/map.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 594000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex wants flow mode on the web map to be smooth. In Mobile Safari (iOS 27 simulator, 2026-09-24), animated zoom-outs froze the map: pressing Fit from the Coding agent focus held a 598-927 ms frame, and checking Coding agent's flow from its details 960-1314 ms. The map zooms by scaling its cached camera layer; shrinking a picture drawn at close-up scale makes Safari paint the whole map at that close-up resolution. Alex approved on 2026-09-24 that zoom-outs draw their destination first and then move the cached picture into place, as zoom-ins already do: soft while moving, sharp once settled; pinch and wheel gestures keep today's behavior. A prototype in which navigation announces its destination to the map held 126-152 ms for the flow and 46 ms for Fit, and settled sharp. Deciding per frame instead failed: when turning on a flow stalls the first frame, the camera is already at its destination by the time the map sees it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In Mobile Safari, checking Coding agent's flow from its details holds no frame longer than 200 ms from the click until the map settles
- [x] #2 In Mobile Safari, pressing Fit from the Coding agent focus holds no frame longer than 200 ms
- [x] #3 After a zoom-out settles, the map is as sharp as the same camera drawn afresh
- [x] #4 Zoom-ins still settle as sharp as the same camera drawn afresh, and the first pan after a settled zoom still finds the camera layer cached
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
1. Navigation announces where it is heading: createCameraAnimator in iso/motion.ts takes an approach callback and calls it with the destination whenever a move is animated navigation (animate true, before reduced motion is applied). Direct gestures and hold pass animate false and never announce, because a pinch-out would otherwise commit the SVG on every frame. render.ts wires it to map.approach(to, to.k / fitted.k).
2. iso/map.ts gains approach(destination, zoomRatio): when the destination zooms out below the committed scale, it commits the destination into the SVG at once and shows the displayed camera from it, enlarged (showCached, shared with move). The picture then moves into place like a zoom-in. Deciding when navigation starts, not per frame, keeps it working when a stalled first frame lands the camera at its destination.
3. The settle rebuild (TASK-511) follows what needs it: the compositor scaled the cached layer since its last rebuild (scaled). A destination-first zoom-out never commits at settle, yet its enlarged layer must be rebuilt; pans and ratio-only commits no longer rebuild.
4. The web guide's camera-layer sentences say that zoom-outs draw their destination first and look soft while moving.
5. No new automated test: the wrong result is a Safari freeze or a soft settled picture, which the DOM-free suites cannot observe; the announcement rule is a one-line branch whose mistake a comment names.
6. Verify in the Mobile Safari simulator harness: the Coding agent flow and Fit in repeated rounds (frames and sharpness against a fresh draw), the zoom-in and first-pan checks, the flow-mode switch; Chrome; bun run check on HEAD plus this change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification, Mobile Safari (iOS 27 simulator, local export) against the TASK-512 build. Checking Coding agent's flow from its details: worst frame 43-79 ms in three rounds (was 453-865), 76 ms after the cleanups; one commit, at the click. Fit from the Coding agent focus: no frame over 40 ms in two rounds (was 420-862), 54 ms after the cleanups. Settled views as sharp as the same camera drawn afresh: flow 22.48/22.43, 22.48/22.43, 22.42/22.41 and 22.47/22.40; Fit 18.21/18.21; system 16.83/16.83. Zoom-in (Coding agent from the fitted map) 20.96/20.96. A wheel pan 1.5 s after the settled flow zoom finds computed will-change: transform; worst frame in its first 150 ms 17 ms. Flow-mode switch at the flow view: no frame over 40 ms. Chrome (DevTools browser): the flow zoom-out commits once at the click, no frame over 40 ms. Typecheck and bun run check on HEAD e036d60e plus the four files: Biome (4 existing warnings, none in these files), types, 16 Node tests, 723 Bun pass, 45 skipped, 0 fail.
Design history: a per-frame prototype (commit the animator target mid-transition) fixed Fit but not flows, because the flow toggle stalls the first frame until the camera is already at its destination; announcing the destination when navigation starts works in both.
Cold simplicity review (no conversation): simplest implementation; applied its cleanups (approach requires latest, showCached parameter renamed, SETTLE_MS and rebuild comments, one guide sentence folded, plan text). End-of-task review (general-purpose agent with a written brief; the fork type is unavailable): keep the design; open suggestions for Alex: replace move(to, animate) with named navigate(to) and jump(to) so the announcement cannot ride on a default, move the cached camera layer into its own iso/camera-layer.ts as a behavior-preserving task, and one zoomRatio(camera) helper in render.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Zooming the web map out no longer freezes Safari. The map zooms by moving a cached picture of itself, and shrinking a close-up picture made Safari paint the whole map at close-up resolution (0.4-1.3 s on Fit and on the zoom to a flow). Navigation now announces its destination when it starts: createCameraAnimator calls approach for animated navigation, never for gestures, and map.approach draws a zoom-out destination into the SVG at once and shows the current view from it, enlarged, so the picture moves into place like a zoom-in, soft while it moves. The settle rebuild now follows whether the compositor scaled the layer. Verified in Mobile Safari on the iOS 27 simulator (flow 43-79 ms, Fit under 40 ms, every settled view as sharp as a fresh draw, zoom-ins and the first pan unchanged), in Chrome, and with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
