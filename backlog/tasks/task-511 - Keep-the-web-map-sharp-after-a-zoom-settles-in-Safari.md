---
id: TASK-511
title: Keep the web map sharp after a zoom settles in Safari
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:40'
updated_date: '2026-09-24 07:56'
labels: []
dependencies: []
references:
  - map
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
type: bug
ordinal: 592000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On the README live map on an iPhone, Alex selected Coding agent and checked its flow. The camera zoomed out to the flow, but the map kept the soft look it has while moving and never became sharp; only a later Next that zoomed again fixed it. Alex suspects groma web and desktop too.

Reproduced in Mobile Safari on the iOS 27 simulator with a local export (2026-09-24): after the settle, the SVG holds the committed camera and the cached camera layer is back at an identity transform, yet Safari keeps drawing that layer below full resolution. Edge energy of the settled flow view was 15.4 against 22.0 for the same camera drawn afresh; a settled zoom-in was 18.0 against 21.0. Nudging or removing the layer transform does not help; releasing the layer and promoting it again does. Chrome settles sharp. Since TASK-497 the layer stays promoted at rest, which removed a 124-146 ms Safari stall on the first pan after a zoom; before that change, each zoom commit released it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In Mobile Safari, after selecting Coding agent and checking its flow, the settled map is as sharp as the same camera drawn afresh
- [x] #2 In Mobile Safari, a settled zoom-in (selecting Coding agent from the fitted map) is as sharp as the same camera drawn afresh
- [x] #3 The first pan after a settled zoom finds the camera layer already cached, so the TASK-497 pan start stays free of a full-map redraw
- [x] #4 Turning on a flow commits its zoom once, at the final camera, even when Safari delays the transition past the settle time
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
1. iso/map.ts owns the cached camera layer and its promotion: it sets will-change: transform when it creates the layer, replacing the rule in iso/style.ts, so promotion and rebuild live in one file.
2. One animation frame after the settle commits a zoom into the SVG, the layer is rebuilt: will-change: auto, a forced layout, will-change: transform. Safari rebuilds it sharp without drawing a frame uncached. Pans keep the cached layer without a rebuild; direct commits after a repaint never scaled it.
3. The settle timer hands over to an animation frame, which runs after the camera's own. A long frame (turning on a flow stalls Safari) can hold a camera transition past SETTLE_MS; settling in between committed a halfway camera that the next frame replaced.
4. No new automated test. The rule is the web guide's "restores crisp SVG rendering after movement settles"; the wrong result is Safari drawing a composited layer below full resolution, which the DOM-free Bun and Node suites cannot observe, and a test could only restate the style toggle. The guide already states the restored behavior, so it is unchanged.
5. Verify with the Mobile Safari simulator harness: flow, zoom-in and system sharpness against the same camera drawn afresh, lit routes against a draw with no promoted layer, one commit per flow zoom, the first pan after a settled zoom, frames after the commit; Chrome settle; bun run check on HEAD plus this change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause: since TASK-497 the camera layer (iso/map.ts, will-change: transform in iso/style.ts) stays promoted at rest. Mobile Safari (iOS 27.0 simulator, iPhone 17 Pro, local export of the working tree, page scale 0.41 because the page has no viewport meta) keeps drawing that layer below full resolution once the compositor has scaled it, although the settle commits the camera into the SVG and resets the layer transform to identity (checked from the camera style and world transforms after settle). Edge energy, the Laplacian standard deviation of the map crop: after checking Coding agent's flow 15.4 settled against 22.0 for the same camera with the layer released and promoted again; after the Coding agent zoom-in 18.0 against 21.0; after a system zoom-out 13.1 against 16.8. Nudging the layer scale, or removing its transform for two frames, left 15.4; releasing will-change for one frame, or inside one task with a forced layout, restored 22.0. The flow toggle also stalls Safari for 300-800 ms, so the settle timer fired mid-transition and committed a halfway camera; deferring settle past that frame removed the halfway commit but not the blur. Chrome settles sharp.
Change: the settle's zoom commit also releases the layer for one frame (inline will-change: auto, removed two animation frames later).
Evidence, fixed build in the Mobile Safari simulator: flow 21.95 against 21.96, zoom-in 20.96 against 20.96, system 16.83 against 16.83. A wheel pan 1.5 s after the settled flow zoom finds computed will-change: transform, and its worst frame in the first 150 ms is 17 ms in both the old and the fixed build, with no frame over 40 ms. Chrome (DevTools browser): release and restore 7 ms apart at settle, no frame over 40 ms in either build. bun run check on HEAD plus this change: Biome (4 existing warnings, none in map.ts), types, 16 Node tests, 723 Bun pass, 45 skipped, 0 fail. No new automated test, as planned.

End-of-task review (general-purpose agent with a written brief; the fork type was unavailable): keep the fix in iso/map.ts with the two-frame release. It asked for two more measurements, both taken in the Mobile Safari simulator. (1) Lit flow routes live in a second promoted layer that the release does not touch: against a draw with no promoted layer at all (camera and route surface released), the fixed build settles at 21.98 against 22.08 for the whole crop and 36.6 against 37.0 for the route crop; the old build 15.4 and 29.5. (2) Frames over 40 ms after the flow click, three runs each at load average about 8: old 987-1822 ms in total, fixed 781-1582 ms, fixed with settle deferred to the next frame 1199-1342 ms. The flow toggle itself costs one 0.5-1.2 s frame in every build; settle-time differences are within that noise. Open review suggestions, awaiting Alex: make iso/map.ts the only owner of the layer promotion (inline will-change at creation, explicit restore) instead of the CSS rule in iso/style.ts, and say in the comment why the release spans two frames.

Correction history. The first fix released will-change for two animation frames: sharp, but the review's timing runs showed Safari then drawing the whole map uncached, a 300-560 ms settle frame after the flow zoom-out in 2 of 3 rounds; a one-frame release behaved the same. Releasing and promoting again inside one task, around a forced layout, rebuilt the layer with no frame over 40 ms but left the zoom-in soft (17.98 against 20.96); that same rebuild one frame after the commit fixed both. With the halfway commit, any release also landed before the transition's last frame, so the settle now waits for an animation frame. After the review, Alex approved moving the promotion into iso/map.ts and asked that flow mode become smooth, which gets its own task.
Final evidence, Mobile Safari (iOS 27 simulator, local export): flow 22.0/21.98, 21.95/22.0 and 22.01/22.01 in three rounds, one commit each; zoom-in 20.96/20.96; system 16.83/16.83; lit routes 22.0 against 22.07 (whole crop) and 36.65 against 36.89 (route crop) for a draw with no promoted layer; a pan after the settled flow zoom finds computed will-change: transform, worst frame in the first 150 ms 17 ms as before. Frames over 40 ms from the final commit on: no rebuild 72-155 ms, next-frame rebuild 0-155 ms. Chrome (DevTools browser): one commit per zoom, no frame over 40 ms. bun run check on HEAD plus iso/map.ts and iso/style.ts: Biome (4 existing warnings, none in these files), types, 16 Node tests, 723 Bun pass, 45 skipped, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map is sharp again in Safari once a zoom settles. Since TASK-497 kept the camera layer promoted at rest, Safari went on drawing it below full resolution after the compositor had scaled it, so the README map on an iPhone stayed soft after zooming out to Coding agent's flow. iso/map.ts now owns the layer's promotion and, one frame after a settled zoom commits into the SVG, rebuilds the layer by changing its will-change around a forced layout, without drawing a frame uncached. The settle also waits for an animation frame, so a transition that Safari delays past the settle time commits once, at its final camera. Verified in Mobile Safari on the iOS 27 simulator (flow, zoom-in and system views as sharp as a fresh draw, lit routes as sharp as a draw with no cached layer, first pan and settle frames unchanged), in Chrome, and with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
