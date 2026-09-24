---
id: TASK-514
title: Give the web map camera layer and pattern attributes one owner each
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 09:40'
updated_date: '2026-09-24 10:03'
labels: []
dependencies: []
references:
  - camera
  - render
  - map
  - map-sharing
modified_files:
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/sharing/cover.ts
  - src/viewers/web/iso/camera-layer.ts
  - src/viewers/web/iso/map.ts
  - groma/relationships.md
  - groma/systems/groma-md/containers/cli/components/camera-layer.md
  - groma/systems/groma-md/containers/export/components/camera-layer.md
  - groma/systems/groma-md/containers/export/components/camera.md
type: task
ordinal: 595000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the end-of-task reviews of TASK-512 and TASK-513, approved by Alex on 2026-09-24 ("Do all 4"). The cached camera layer, which moves the picture the SVG last drew and now carries three tasks' Safari rules (TASK-511 rebuild after scaling, TASK-512 pattern gates, TASK-513 destination-first zoom-outs), lives as loose state inside the 428-line createMap closure next to hover, highlights and anchors, so new code can scale the layer without scheduling its rebuild. The camera animator's move(to, animate = true) also decides whether navigation announces its destination, so a gesture that forgets false would announce. The pattern attributes are named in three files and computed in two, and render.ts computes the zoom ratio twice. Behavior stays as TASK-513 left it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigation and direct gestures move the camera through named methods, navigate and jump; no call passes a flag, and only navigation announces its destination
- [x] #2 The live map and the cover take their pattern attributes from one function
- [x] #3 The cached camera layer (its promotion, transform, commits, rebuild and settle timing) lives in iso/camera-layer.ts, and iso/map.ts no longer holds that state
- [x] #4 render.ts computes the zoom ratio in one place
- [x] #5 In Mobile Safari the TASK-513 results hold: checking Coding agent's flow and pressing Fit hold no frame over 200 ms, settled views are as sharp as a fresh draw, zoom-ins stay sharp and the first pan after a settled zoom is unchanged
- [x] #6 The new file belongs to the Camera control component in the architecture
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
1. iso/motion.ts: createCameraAnimator exposes navigate(to), which announces the destination through approach and animates unless reduced motion is on, and jump(to), which moves at once without announcing; hold becomes jump(current). render.ts: the seven navigation calls use navigate, the pointer zoom and pan and the repaint recentring use jump.
2. render.ts: one zoomRatio(camera) helper, used by applyCamera and the approach callback.
3. iso/style.ts: patternAttributes(k) returns the camera attributes that stop facade and surface patterns below readable size; iso/map.ts and sharing/cover.ts set exactly those, and neither imports the visibility predicates.
4. iso/camera-layer.ts: createCameraLayer(painter) owns the camera element and its promotion, the shown and drawn cameras, repainted and scaled, showCached, the commit, the rebuild and the settle timer (SETTLE_MS moves with it). map.ts supplies the painter: draw(view) writes the SVG for a camera (surface titles, glows, world transforms, stroke weight, pattern attributes), moving() hides glows, settled() restores hover and glows; map.move, approach and paint delegate to the layer.
5. The architecture record the scan watcher creates for iso/camera-layer.ts is combined into the camera component (Camera control), and its overview mentions the cached layer.
6. No new automated test: the change preserves behavior; the Bun and Node suites and the Mobile Safari simulator harness (flow, Fit, zoom-in, first pan, flow switch) plus Chrome prove it; bun run check on HEAD plus this change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification, Mobile Safari (iOS 27 simulator, local export) against the TASK-513 build, load average up to 91: checking Coding agent's flow worst frame 81 and 74 ms (TASK-513 build 0 and 69 ms); Fit under 40 ms (69 ms); system zoom-out 41 ms; every settled view as sharp as its fresh draw (flow 22.42/22.37, Fit 18.17/18.17, system 16.88/16.88); zoom-in 20.96/20.96; a wheel pan after the settled flow zoom finds computed will-change: transform, worst frame in its first 150 ms 17 ms; flow switch at the flow view no frame over 40 ms; pattern states unchanged (fitted map none and transparent zones, Coding agent focus inline and hatch, flow view none and transparent). Chrome (DevTools browser): one commit per zoom, no frame over 40 ms. Typecheck and Biome clean on the changed files; bun run check on HEAD a5b9b5df plus the eight files: Biome (4 existing warnings, none in these files), types, 16 Node tests, 723 Bun pass, 45 skipped, 0 fail.
Architecture: the running scan watcher created camera-layer.md under the cli container; groma edit camera-layer --parent export, then groma edit camera --combine camera-layer (replaced: camera-layer -> camera), then a camera overview that mentions the cached picture. The watcher also derived camera-layer.ts to map.ts "Invokes supplied callbacks: draw, moving, settled".
End-of-task review (general-purpose agent with a written brief; the fork type is unavailable): keep the design, nothing to delete. Open suggestions for Alex: rename jump (it reads as an instant programmatic move, which would skip approach) to a gesture-only name such as track; rename the painter's draw to drawCamera and moving() to moveStarted(); write layer.element instead of the camera alias in map.ts; move transform-origin: 0 0 into createCameraLayer beside will-change; later, move camera.ts, motion.ts, pointer.ts and camera-layer.ts into iso/camera/. render.ts is at the 500-line limit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map's camera code now has one owner per rule, with behavior unchanged. iso/camera-layer.ts owns the cached camera layer: its promotion and transform, the shown and drawn cameras, destination-first zoom-outs, the Safari rebuild and the settle timer, and asks map.ts only to draw the SVG for a camera and to hide or restore hover and glows. The camera animator offers navigate, which announces its destination, and jump for gestures, instead of a flag with a default; style.ts supplies the pattern attributes that both the map and the cover set; render.ts computes the zoom ratio once. Camera control owns the new file in the architecture. Verified in Mobile Safari on the iOS 27 simulator against the previous build (flow, Fit, system, zoom-in, first pan and flow switch unchanged), in Chrome, and with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
