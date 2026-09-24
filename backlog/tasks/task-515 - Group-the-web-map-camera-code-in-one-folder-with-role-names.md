---
id: TASK-515
title: Group the web map camera code in one folder with role names
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 10:18'
updated_date: '2026-09-24 10:52'
labels: []
dependencies: []
references:
  - camera
  - render
  - map
  - map-sharing
  - search-control
  - grid
  - web-work-pins
  - shell
modified_files:
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/iso/camera/camera.ts
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/iso/camera/motion.ts
  - src/viewers/web/iso/pointer.ts
  - src/viewers/web/iso/camera/pointer.ts
  - src/viewers/web/iso/camera-layer.ts
  - src/viewers/web/iso/camera/layer.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/sharing/cover.ts
  - src/viewers/web/search/session.ts
  - src/viewers/web/iso/grid.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/iso/glow.ts
  - src/viewers/web/chrome/shortcuts.ts
  - test-bun/web-selection-camera.test.ts
  - test-bun/web-map-presentation.test.ts
  - test-bun/web-task-camera.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/web-camera-motion.test.ts
  - test-bun/web-map-pointer.test.ts
  - groma/systems/groma-md/containers/export/components/camera.md
  - groma/relationships.md
type: task
ordinal: 596000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the end-of-task review of TASK-514, approved by Alex on 2026-09-24 ("Do all 5"). iso/ holds 18 files from five components, so camera.ts, motion.ts, pointer.ts and camera-layer.ts, which together are Camera control, are not visibly one domain, and motion.ts is easy to confuse with chrome/motion.ts and createMapMotion. Some names invite the wrong change: jump reads as any instant programmatic move, which would skip approach and bring back the Safari zoom-out freeze TASK-513 fixed; the layer painter's draw clashes with map.ts's own scene draw and moving() reads as a state; map.ts calls the layer element camera, so its own Camera values had to be called current; and the transform origin that showCached relies on lives in style.ts, another component's file. Behavior stays as TASK-514 left it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 camera.ts, motion.ts, pointer.ts and the camera layer (as layer.ts) live in src/viewers/web/iso/camera/, and every import and test uses the new paths
- [x] #2 Direct gestures and the recentring after a repaint move the camera through a gesture-only method named track, and navigation keeps using navigate
- [x] #3 The camera layer painter hooks are drawCamera, moveStarted and settled, and map.ts refers to the layer element directly
- [x] #4 The camera layer sets its own transform origin
- [x] #5 Camera control still owns the four files in the architecture, and no relationship row points at a moved path
- [x] #6 In Mobile Safari the TASK-514 results hold: checking Coding agent's flow and pressing Fit hold no frame over 200 ms, settled views are as sharp as a fresh draw, zoom-ins stay sharp and the first pan after a settled zoom is unchanged
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
1. motion.ts: rename jump to track, documented as the gesture-only move (direct gestures and the recentring after a repaint); render.ts calls track at its three gesture sites.
2. camera layer: painter hooks become drawCamera, moveStarted and settled; the layer's own draw becomes drawCamera too, so one name means one act; the layer sets transform-origin 0 0 itself and style.ts drops its #map .camera origin rule.
3. map.ts: drop the camera alias and use layer.element, so camera means a Camera value again (drawCamera destructures { camera, zoomRatio }); rename the index() arrow parameter that shadows layer.
4. git mv camera.ts, motion.ts, pointer.ts and camera-layer.ts (as layer.ts) into src/viewers/web/iso/camera/; fix their own relative imports and every importer in src and test-bun; render.ts stays at or under 500 lines.
5. Architecture: let the scan follow the moved files, then curate with the groma CLI so Camera control owns exactly the four new paths and the derived relationship rows name the new paths and hooks.
6. Verify: bun run check in a worktree at the check tree; Mobile Safari simulator flow, Fit, system, zoom-in sharpness and first-pan runs against the TASK-514 numbers; Chrome sanity.

Tests: zero new tests. The change renames and moves code without changing behavior. Existing coverage keeps running from the new paths: web-camera-motion (motion), web-map-pointer (pointer), iso-map, web-selection-camera, web-task-camera and web-map-presentation (camera math). The camera layer's Safari behavior has no automated coverage and is checked in the simulator as in TASK-511 to TASK-514.

7. From this task's end-of-task review, both renames or deletions inside files this task already changes: map.ts names the layer cameraLayer, because layer there also means the SVG groups (layers) and the Layers view; camera.ts drops resized, which nothing has called since TASK-154. Re-run bun run check and compare the exported bundle with the verified one.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved camera.ts, motion.ts, pointer.ts and camera-layer.ts (now layer.ts) into src/viewers/web/iso/camera/ with plain mv, leaving the shared index untouched; camera.ts now takes boundsOf and ProjectedScene from ../project.ts in one import.
motion.ts: jump is now track, documented as the gesture-only move; render.ts calls it for pointer zoom, pointer pan and the recentring in repaintScene.
layer.ts: painter hooks drawCamera, moveStarted and settled; its own draw step is drawCamera too; it sets transform-origin on its element, and style.ts dropped its #map .camera origin rule.
map.ts: no camera alias; layer.element throughout; drawCamera destructures { camera, zoomRatio } and move(camera, zoomRatio) passes { camera, zoomRatio }; the flatMap parameter in index() is now group, so it no longer shadows layer.
Architecture: the watcher's scan created four records for the moved files (camera-camera and layer under cli, motion and pointer under the system). groma edit <id> --parent export for each, then groma edit camera --combine camera-camera motion pointer layer, folded them back into Camera control; camera.md lists the four new paths in the old order (the CLI now writes group above code). The derived rows in groma/relationships.md name layer.ts with drawCamera, moveStarted, settled, and pointer.ts at its new path. groma lint reports nothing in these files.
docs/agent-instructions/structure.md keeps its illustrative first-scan example naming iso/camera.ts: it shows what a scan may report, not current paths.
The exported render.js differs from the TASK-514 export only by these renames, the module path comments and the transform origin moving from the stylesheet to the element style.
bun run check in a worktree at the check tree: Biome, types and the Node suite pass; Bun 723 pass, 45 skip, 0 fail (same counts as TASK-514).

Mobile Safari (iOS 27 simulator, headless harness), TASK-514 export (b514) against this task's export (c515), interleaved; worst frame after the event in ms, sharpness settled/fresh draw:
- Coding agent's flow: b514 0, 48, 149; c515 49, 48, 79; sharpness 21.11-21.13 against 21.10-21.11 on both builds.
- Fit: b514 82, 92, 155; c515 80, 0, 99; 18.21/18.21 on both.
- First pan after the settled flow zoom: worst frame in the first 150 ms 17 in all six runs, no frame over 40 ms, will-change transform.
- Zoom-in (actor selection): 20.97/20.97 on both; system selection 16.75/16.75 on both (b514 0, 109; c515 64, 62).
The spread follows machine load (three test workers from other sessions ran at about 175% CPU each throughout), not the build.
Chrome: the layer's inline transform-origin computes to 0px 0px; checking the flow draws the destination first (scale 10.03 mid-transition) and settles at identity with data-tracing and both pattern attributes set; a wheel pan moves the cached picture and keeps the SVG camera; no console errors besides a favicon 404 from the scratch server.

End-of-task complexity review (cold agent with a written brief): keep the approach, no defect found. Applied its two in-scope cleanups: map.ts names the layer cameraLayer (layer there also meant the SVG groups and the Layers view; 16 identifiers), and camera.ts drops resized, which nothing has called since TASK-154. bun run check again at the new check tree: Biome, types and the Node suite pass; Bun 723 pass, 45 skip, 0 fail. The re-exported render.js differs from the simulator-verified build only by those 16 renamed lines (resized was never bundled), so the Mobile Safari results carry over. Suggestions left for Alex: group the rest of Map drawing into folders the same way, one Bun test for the camera layer's draw rules, and moving the key rules from camera.ts into chrome/shortcuts.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Camera control now lives in one folder, src/viewers/web/iso/camera/ (camera.ts, motion.ts, pointer.ts, layer.ts), with names that say what each piece does: the animator's instant move is track, used only by gestures and the recentring after a repaint, so programmatic navigation keeps going through navigate and its approach; the layer painter hooks are drawCamera, moveStarted and settled; map.ts calls the layer cameraLayer and uses its element directly; the layer sets its own transform origin. The unused resized helper is gone. Architecture: Camera control owns the four new paths, and the derived relationship rows name them. Behavior is unchanged: bun run check passes (Bun 723 pass, 0 fail), the exported bundle differs from TASK-514 only by these renames and the moved transform origin, and interleaved Mobile Safari simulator runs against the TASK-514 build matched on flow and Fit (no frame over 200 ms, settled views as sharp as a fresh draw), zoom-in and system sharpness, and the first pan after a settled zoom (17 ms worst frame in every run).
<!-- SECTION:FINAL_SUMMARY:END -->
