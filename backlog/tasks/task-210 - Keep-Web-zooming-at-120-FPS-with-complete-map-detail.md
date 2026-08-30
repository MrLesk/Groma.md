---
id: TASK-210
title: Keep Web zooming at 120 FPS with complete map detail
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 09:55'
updated_date: '2026-08-30 21:06'
labels: []
dependencies: []
references:
  - iso-map
  - work-overlay
modified_files:
  - src/viewers/web/iso/style.ts
  - test-bun/web-svg-performance.test.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/project.ts
  - test-bun/iso-map.test.ts
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect pinches, scroll-zooms, uses zoom controls, or resets the production Web map camera, Groma keeps the complete authored map visible and presents zoom movement at the display 120 Hz frame budget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sustained zooming at distant, fitted, and close scales presents at 120 Hz in the target browser, confirmed by compositor trace evidence and the human architect
- [x] #2 All current labels, patterns, drafting details, building faces, route hit areas, routes, and arrows remain rendered throughout zooming
- [x] #3 Zooming changes only camera presentation and does not rerun placement, routing, projection, or full SVG construction
- [x] #4 Pinch anchoring, mouse or command wheel zoom, zoom controls, fit reset, selection, pins, F1, F2, F3, and themes remain behaviorally correct
- [x] #5 Focused tests, rendered browser QA, browser performance traces, and bun run check pass
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
1. Use one camera representation at rest: the SVG world group owns the complete translate and scale, with no transformed HTML ancestor. 2. During wheel, pinch, or pointer movement, apply only the affine difference from the committed SVG camera to one temporary HTML motion layer. 3. Always commit the latest complete camera to SVG and remove the HTML transform and promotion after input stops, including rapid reversals, limits, and interruptions. 4. Keep arrowheads as fixed map geometry with no zoom compensation, so they scale naturally and continuously with the rest of the map. 5. Keep the field and pins independent. 6. Stress idle cleanup and rapid reversals, verify no arrow snap, run performance traces and focused checks, then ask for visual approval.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline 180-frame fitted-to-minimum-to-fitted pinch trace presented 180 frames with zero drops but spent 375.35 ms in RasterTask. Retaining the existing zoom composition layer reduced RasterTask to 59.88 ms, an 84.0% reduction, without changing map detail or gesture semantics.

The first broad retained-layer trace still dropped 35 of 320 frames because each scale frame invalidated inherited presentation CSS. Freezing those values reduced the run to four drops, proving the cause. The final compositor-first build updates transforms continuously and applies scale-sensitive SVG presentation once after 80 ms idle. Visible pins use composited individual translate instead of left/top layout writes.

Final HUD-on trace crossed minimum, fitted, and 1.9 times fitted zoom: 320 frames in 2,665.4 ms, 120.06 Hz, 320 DrawFrame, zero DroppedFrame. The scene HTML and ordered data ids stayed byte-identical; 128 texts, 290 faces, 197 patterns, 66 routes, and 7 pins remained. Pin heads stayed exactly 40 by 57.5 px at minimum, close, and fit. Browser QA passed Fit, plus/minus, pinch anchoring within 0.33 px, command-wheel zoom, F1, F2 and exact return, F3, all themes, map selection and clear, task-pin selection, clean console, and a nonblank error-free screenshot. Focused tests, TypeScript, and diff checks pass.

Cold simplicity review passed with two accepted deletions: removed redundant scale presentation state and returned the 80 ms settle constant to the sole map consumer, removing iso/scale.ts from the final diff. The reviewer found no blocking complexity or junior-comprehension issue.

Specification review found no implementation defect. Completion remains gated by human architect confirmation and a green full repository check. The latest full and isolated runs failed only in the unrelated scan watcher tests with the environment error too many open files; all TASK-210 focused checks pass. Quality review found no blocking code issue. It confirmed the separate compositor layers, resettable presentation timer, fixed-size composited pins, and unchanged selection and themes. It recorded one non-blocking follow-up: a future fake-timer behavior test could guard timer semantics more directly than the current source-level SVG performance guard.

Full-context architecture review found no blocker and would keep the same approach. Domain ownership is clear: camera and settled presentation in iso/map.ts, composition in iso/style.ts, work-overlay pin movement in work/pins.ts, and performance guards in the existing test. It found two optional clarity improvements only: rename presentScale to presentSettledScale and correct the IsoMap.move comment so future developers do not add scale-dependent SVG writes to the continuous compositor path. Human visual confirmation and a green full repository check remain the completion gates.

Human visual review rejected the first retained-layer result: settled building text and edges remained blurred, and arrowheads changed size across scale. The corrected design keeps layer promotion temporary and makes arrowhead appearance constant. The attached screenshots are the approved defect evidence.

The temporary-promotion attempt fixed settled sharpness but failed the performance trace because promotion on the first zoom frame was too late. The corrected plan retains before movement and performs one controlled demote-and-retain refresh only after the gesture settles.

Final correction keeps the zoom surface retained before movement, applies settled scale presentation after 80 ms idle, releases retention for one painted frame so SVG text and edges redraw sharply, then retains the freshly rasterized surface for the next gesture. Arrowheads now use one fixed settled screen size independent of zoom weight. Browser measurements held the same route head at about 15 by 7.5 px at 80, 100, 125, 931, and 2767 percent. A maximum-detail screenshot showed crisp Mode roof text and edges. Two repeated 320-frame traces completed in 2,657 and 2,654 ms, about 120.4 and 120.6 Hz, with 320 DrawFrame events and two boundary DroppedFrame events each. Focused 24 tests, TypeScript, diff checks, DOM identity, and console health pass.

Post-correction simplicity, specification, and quality reviews found no blocking implementation or architecture issue. The simplicity reviewer confirmed every production concept directly serves either continuous 120 Hz composition or settled vector sharpness and removed one helper-name-only test assertion. Specification and quality re-reviews confirmed the 80 ms timer lifecycle, one-painted-frame refresh, fixed arrow screen size, composited pins, and unchanged interaction scope. Human visual confirmation and the unrelated EMFILE full-check environment failure remain the only completion gates.

Human review caught that the retained-and-refreshed version became clear for one frame and then blurred when retention returned. The second animation frame was therefore the regression. The final correction will remain unretained at idle and prepare composition from the map surface zoom event before the camera frame, without touching shared render.ts.

Final idle-sharp browser evidence: the previous re-retain frame was removed. The map host now captures zoom intent before the camera frame, including input over sibling overlays and task pins, retains only during the gesture, and removes retention after 80 ms idle. A 320-frame trace completed in 2,653.5 ms, about 120.6 Hz, with 319 DrawFrame and zero DroppedFrame events. A second consecutive gesture completed in 2,653.7 ms. Settled will-change remained auto and the arrow stayed about 15 by 7.5 px. At 2034 percent zoom, two lossless PNG captures taken two seconds apart were byte-identical at 68,104 base64 bytes; transform, building bounds, and readout were also identical. The clear-then-blurry transition is no longer present. Focused 24 tests, TypeScript, diff checks, page identity, console health, overlay-started zoom, and rendered close-zoom QA pass.

Final cold simplicity, specification, and quality reviews found no blocking implementation or architecture issue. They confirmed the host capture ordering, overlay and pin coverage, fallback timer, continuous-versus-settled lifecycle, idle removal of will-change, constant settled arrow size, composited pin placement, and junior-developer clarity. Human visual approval and the known unrelated EMFILE full-check environment failure remain the only completion gates.

Human review correctly found that removing will-change did not remove the idle CSS scale, so the browser could still keep a rasterized map. The corrected rendering model now keeps pan as a retained outer translation, stores the settled absolute zoom on one SVG world group, and uses the HTML zoom layer only for the live ratio from the last committed scale. Settling atomically commits that ratio into SVG and removes the CSS transform. Browser QA also found and fixed a zoom-limit edge case: clamped wheel events now still schedule the latest camera commit, so a temporary transform cannot survive at idle.

Corrected browser evidence: idle at fit, 1102 percent, and the clamped maximum has no inline or computed CSS zoom transform; the SVG world owns the final absolute scale, will-change is auto, and the measured route arrow remains 15 by 7.5 pixels. A 320-frame compositor trace took 2670.5 ms, recorded 322 DrawFrame events and zero DroppedFrame events; a second consecutive 320-frame gesture took 2661.6 ms and also returned to an untransformed idle state. The zoom button commits directly with no temporary CSS transform. Browser page identity, nonblank DOM, error-overlay check, and console health pass with 128 texts, 302 faces, 67 routes, and 6 pins present. Focused 24 tests, TypeScript, and diff checks pass. The full bun run check still reaches the same two unrelated scan-watch failures: one empty watch-process output and one EMFILE too many open files error; TASK-210 checks remain green.

The arrow requirement was misread during review: constant screen-pixel arrows were not requested. Removed all arrow zoom compensation. Arrowheads are again fixed SVG map geometry, so they scale naturally and continuously with the map and never snap at settlement. Four rapid reversal stress patterns covered distant, intermediate, and maximum zoom. Arrow width changed naturally from about 0.38 to 60 pixels with camera scale, while the moving-to-idle difference stayed between 0 and 0.00007 pixels. Every stress settle ended with the HTML camera transform absent, computed transform none, and will-change auto. The unified camera holds complete idle translate and scale on the SVG world group; no HTML zoom layer remains. A sustained unclamped 320-frame zoom ran in 2668.5 ms with 326 DrawFrame and one boundary DroppedFrame event. A 320-frame pan ran in 2673.1 ms with 326 DrawFrame and one boundary DroppedFrame event, then returned to an untransformed idle camera. Browser page, DOM, overlay, console, and content-count checks pass. Focused 24 tests, TypeScript, and diff checks pass.

Increased the single fixed SVG arrowhead geometry by 50 percent, from 8 by 7 world units to 12 by 10.5 world units. It remains ordinary map geometry with no zoom-dependent compensation. Relationship geometry tests, the SVG performance guard, TypeScript, and diff checks pass. The refreshed browser confirms the larger path and an idle HTML camera with computed transform none and will-change auto.

Human review exposed a separate endpoint defect after the larger fixed SVG arrowhead made it visible: stepped buildings were routed against their largest obstacle envelope, so an arrow could stop on an invisible full-size roof before reaching the narrower rendered upper tier. Projection now extends only the short source or target endpoint leg to the first visible rectangular building face; placement, obstacle clearance, routed bends, and arrow direction remain unchanged. In the current Groma world this adjusts 12 endpoints by at most one 13.42 px projected segment. The Iso map route now ends at -2452.32,2004 on its upper roof edge instead of -2440.32,1998 in empty space. A focused stepped-tower invariant, 21 focused tests, TypeScript, diff checks, real-browser close-zoom rendering, idle camera state, and content counts pass. The full check still fails only in the same two unrelated scan watcher tests: empty watch output and EMFILE too many open files.

Evidence correction from the final complexity review: the fixed SVG arrowhead height increased by 50 percent, from 8 by 7 world units to 8 by 10.5 world units. Its width remains 8. The earlier note incorrectly described both dimensions as enlarged. The current rendered geometry is the reviewed implementation; no code change is implied.

Alex visually approved the final zoom result during wrap-up. The repository-wide bun run check passes completely (lint with existing warnings only, TypeScript, 91 Node tests, and 195 Bun tests). The required final complexity review traced the single temporary HTML camera layer through its 80 ms settled SVG commit and cleanup, approved the Iso/Work domain boundaries and junior safety, and found no remaining implementation blocker after the arrowhead-dimension note was corrected.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Kept complete Web map detail during 120 Hz zoom by applying continuous input to one temporary composited HTML camera layer, then committing the settled camera to the single SVG world group for sharp vector rendering. Kept the viewport grid outside the moving scene and Work pins on their own fixed-screen overlay. Preserved SVG arrow geometry, corrected stepped-building endpoints to the first visible face, verified camera cleanup and geometry invariants with focused tests and traces, received human visual approval, and passed the full repository check and final complexity review.
<!-- SECTION:FINAL_SUMMARY:END -->
