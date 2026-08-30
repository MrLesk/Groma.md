---
id: TASK-209
title: Keep Web panning at 120 FPS with complete map detail
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-29 22:46'
updated_date: '2026-08-30 09:54'
labels: []
dependencies: []
references:
  - iso-map
  - work-overlay
  - iso-camera
modified_files:
  - src/viewers/web/iso/style.ts
  - test-bun/web-svg-performance.test.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/iso/camera.ts
priority: high
type: bug
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect pans the production Web architecture map at fitted, close, or distant zoom, Groma keeps the complete authored map visible and presents movement at the display's 120 Hz frame budget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sustained panning at fitted, close, and distant zoom presents at 120 Hz in the target browser, confirmed by browser trace evidence and the human architect
- [x] #2 All current labels, patterns, drafting details, building faces, route hit areas, routes, and arrows remain rendered during panning at every zoom
- [x] #3 Every DOM identity and geometry coordinate remains present and unchanged during pure panning
- [x] #4 Panning does not rerun placement, routing, projection, full SVG construction, or scale-only presentation work
- [x] #5 F1, F2, F3, selection, pins, themes, zoom, orbit, and camera reset remain behaviorally correct
- [ ] #6 Focused tests, rendered browser QA, browser performance traces, and bun run check pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep one fixed map interaction surface with the patterned grid on its own static SVG.
2. Paint the complete architecture once into one SVG scene inside an inner zoom layer.
3. Translate only a screen-sized retained pan layer per frame; change the inner scale layer only when zoom changes.
4. Keep Backlog pins on their own retained overlay so plugin movement does not repaint the architecture.
5. Verify traces at fitted, close, and distant zoom, full-detail invariants, controls, checks, required reviews, and human approval.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial regression comparison used the same 82-element, 66-relationship architecture. The known-fast map and current map have effectively identical moving DOM size (1,428 versus 1,427 camera descendants and 463 route nodes). Current rendering keeps 128 text nodes in paint versus 27 in the known-fast version and routes 453 versus 333 points. Text and geometry must remain, so optimization belongs at the camera composition boundary. Chrome is not connected through the Browser plugin; in-app Browser remains available for rendered interaction checks.

Implemented one composition-boundary change: the existing SVG camera group now declares will-change: transform, retaining the complete camera raster during scripted pan without changing geometry or suppressing labels. Added a regression guard beside the existing patterned-field composition test. Focused verification passes: 5 Bun tests and TypeScript. In-app Browser QA on the live 82-element / 66-relationship map held 120 FPS through sustained fitted, close, and distant pan paths; all 128 rendered texts, 66 routes, 453 route points, selection, pins, topography, F1/F3, and all three themes remained functional with no console errors. The full repository check is presently blocked outside this task: both scanner-watch tests fail with EMFILE (too many open files), and existing unrelated lint warnings remain; TASK-209 focused checks pass.

Final validation correction: the two watcher tests that first timed out passed in isolation, then a clean full rerun with the Web watcher stopped passed completely: 81 Node tests and 169 Bun tests. The local server was restarted on port 4848 after the check and the map-only review state confirms 128 rendered texts, 66 routes, and no console errors.

Pure-pan runtime proof: across a 61-point drag, the camera subtree stayed byte-identical (175,067 characters, hash -1600517886); generation remained 1; map total, architecture, placement, routing, projection, SVG-paint, building/surface/route/route-point metrics were unchanged. Only the camera translation and separate pin-layer translation changed; zoom, camera scale, stroke weight, and arrow scale stayed identical. This objectively confirms pure pan did not rebuild, reroute, reproject, repaint the SVG DOM, or run scale-only presentation changes.

Cold simplicity review passed with no deletion or consolidation recommendation. Specification and quality re-reviews passed after the final runtime and full-check evidence. The required full-context review agreed this is the simplest solid architecture for junior safety: one existing camera boundary, no new rendering model, state, module, dependency, or geometry path. Awaiting the human architect's visual approval before marking Done, committing, and pushing.

Final current-build pan sample on the restarted server: ten sustained drag sequences at fitted scale 0.144552, close scale 0.441138, and distant scale 0.072276 each reported 120 FPS on every per-frame sampler poll (30/30 total). Restored fitted map-only state afterward with F3 hidden: 1,427 camera descendants, 128 rendered texts, 66 routes, retained camera transform, and zero console warnings or errors.

Human fallback boundary: if the target browser still cannot present 120 FPS after composition optimization, text or non-semantic geometry may be hidden only while active panning and must return immediately when movement ends. This is an allowed fallback, not the default acceptance: current browser evidence still reports 120 FPS with full detail, so no detail-hiding behavior is added without contradictory visual evidence.

Contradictory human evidence supersedes the in-app sampler: the human architect observes the current 4848 build dropping to 12 FPS. Verified that 4848 serves the exact fresh current render bundle (matching SHA-256 da3744b8218e12dd4f0675143d0729f4091fd935675bb44c4e633943be3c943b), so this is not a stale-version issue. The 120 FPS debug counter is insufficient evidence of visibly presented frames. AC #1 and completion evidence are reopened; the will-change-only change must not be committed as a successful fix.

The human architect reports that the regression is strongest when zoomed out. The authorized fallback is therefore scoped to active panning below fitted scale, not to idle rendering or closer zoom levels.

Implemented the authorized distant-pan fallback at the SVG map boundary. Both wheel and pointer pans below fitted scale set one data-pan-light state; the map clears it 100 ms after the last pan event. During that state CSS hides labels, patterns, side faces, drafting decoration, layer risers, route hit areas, and invisible route overlays, and disables the retained-camera hint. Browser verification at scale 0.0322 confirmed all categories hide during pan and restore after 140 ms; the camera kept 1,427 descendants and sampled roof and route coordinates stayed byte-identical. Focused performance tests and TypeScript pass. The full check reached the existing watcher resource failure: 79/81 Node tests passed; cli-scan watch emitted no output and scan-watch failed EMFILE (too many open files). The user-visible 120 Hz criterion remains open for the human architect.

The persistent goal requires complete text and geometry. Trace comparison over 90 distant pan frames showed the reduced-detail fallback did not improve cadence: both runs took about 735 ms, while disabling the retained camera increased RasterTask count from 8 to 87 and reduced DrawFrame events from 90 to 72. The fallback is therefore counterproductive and will be removed; the next experiment keeps full detail and the retained transform layer.

Final trace-supported design: the map is one fixed interaction surface containing a static grid SVG and a retained HTML camera. The complete SVG scene sits inside an inner zoom layer; pure pan changes only the outer translate, while zoom alone changes the inner scale. The Backlog pin overlay is retained independently. On the same 82-element / 66-route map, the original distant camera produced 240 Paint events (83.77 ms) over 120 frames; the split camera produced zero Paint events over 120 frames in 992.6 ms. Fitted and close traces also presented 120 frames in about 990 ms, with their separately moving grid paint totaling only 13.24 ms and 10.50 ms. Real pointer-drag tracing showed no architecture paint. Browser invariants held across pan: 1,464 scene descendants, 128 texts, 197 patterns, 290 faces, 66 routes, 66 hit areas, all ids, sampled roof/route coordinates, and six pins stayed identical. Selection, empty-map clear, F1, F2 and its exact return pose, F3, three-theme cycle, zoom, Fit, pins, and details passed with no errors in a clean tab. Focused performance tests and TypeScript pass. Full check is still externally blocked by watcher resource exhaustion: Node passed 79/81 and Bun passed 157/169; failures are EMFILE watch timeouts and concurrent port-0 server starts, not TASK-209 behavior.

Minimum-zoom current-build compositor proof: at scale 0.0252, Chrome's main-world requestAnimationFrame loop dispatched 180 real Web wheel events across 1,501.4 ms. The trace recorded 180 DrawFrame and 180 Display::DrawAndSwap events (119.89 Hz), zero DroppedFrame, zero Paint, zero Layout, and no frame gap above 12 ms; mean gap was 8.334 ms and maximum gap 10.69 ms. All 128 text nodes and 67 current routes remained in the scene. This supersedes the earlier F3-counter evidence and directly tests the user's reported worst case.

Repository gate rerun outside the sandbox: typecheck and lint completed, all 81 Node tests passed in the first full run, and 168/169 Bun tests passed; the lone Backlog filesystem-watch timeout then passed in isolation in 12.9 ms. A second full run hit the reciprocal scanner-watch race, which passed in isolation in 1,295.7 ms. Every test has passed on the current worktree, but no single full invocation is green because unrelated filesystem watcher tests are intermittent under the shared multi-agent workload. TASK-209's 23 focused tests remain green. Port 4848 was restored outside the sandbox and serves the split DIV camera/zoom build with 128 texts and 67 routes.

Current split-camera cold simplicity review passed with no findings. The reviewer traced input to the retained outer camera, scale-only inner zoom, unchanged complete SVG scene, static grid SVG, and independently retained pins. It found each layer required by the accepted composition boundary, no task code or test that could be deleted or collapsed, and the fieldSurface/camera/zoom/scene names clear to an unfamiliar developer.

Quality review found one split-camera regression: blank space could target the new camera or zoom DIV, which isSheet did not classify as empty map. Fixed isSheet to recognize both composition layers. Browser reproduction after restart selected Coding agent, clicked a point whose event target was exactly .camera, and confirmed the URL cleared, selected nodes fell to zero, body gained details-hidden, and the inspector aria-hidden became true. TypeScript, 30 focused map/selection/shell/performance tests, and diff check pass.

Post-fix full gate attempt outside the sandbox: lint and TypeScript completed; all 81 Node tests passed; 168/169 Bun tests passed. The sole live-reload watcher timed out under full-suite concurrency, then passed in isolation in 268.75 ms. The current 4848 server was restored and confirms the split camera/zoom DOM with 128 texts and 67 routes.

Required full-conversation architecture review passed. It would keep the current fieldSurface/camera/zoom/scene split: each layer has one measured role, domains remain camera math / map composition / visual rules / plugin overlay / composition guard, and the early return makes per-pan versus scale-only work clear to junior developers. It noted IsoMap.svg now names an HTMLElement root, but judged renaming non-blocking and broader shared-file churn with no supported-result benefit. Remaining blockers are human visual approval and the literal single-invocation full check.

Final post-review full-check attempt reproduced the same unrelated boundary: lint and TypeScript completed, Node passed 81/81, Bun passed 168/169, and only the test named groma web applies an architecture Markdown change without a refresh timed out under concurrent full-suite execution; that exact test passes isolated in 268.75 ms. No panning-task file participates in the failing watch path. Port 4848 is restored with the current split-camera build.

Human visual approval received on the final split-camera build: the minimum-zoom panning now looks good. This closes the human half of AC #1 alongside the 119.89 Hz zero-drop compositor trace.

Human approval is complete. The latest clean full-check attempt passed lint, TypeScript, all 81 Node tests, and 167 of 169 Bun tests; only the two unrelated filesystem live-watch tests timed out under full-suite concurrency. The approved pan boundary is committed before zoom work so the two performance changes remain independently reviewable. TASK-209 remains open until the literal one-invocation gate is green.
<!-- SECTION:NOTES:END -->
