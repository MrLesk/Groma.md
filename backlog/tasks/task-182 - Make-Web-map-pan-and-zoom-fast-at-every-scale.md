---
id: TASK-182
title: Make Web map pan and zoom fast at every scale
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 20:14'
updated_date: '2026-08-26 20:47'
labels: []
dependencies: []
references:
  - iso-map
  - render
  - work-overlay
modified_files:
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/render.ts
  - src/viewers/web/work/pins.ts
  - test-bun/iso-scale.test.ts
  - src/viewers/web/iso/paint-routes.ts
  - docs/viewers/web/index.md
priority: high
type: enhancement
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect pans or zooms the Web architecture map, the current production sheet stays responsive at every supported scale, including map-only mode at minimum zoom. Performance work must preserve the authored geometry, selection, routes, camera rules, and visible design meaning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fixed Chrome CPU-throttled pan benchmark at minimum zoom records no dropped frames and reduces combined map Paint, RasterTask, and GPU time by at least 50% from the recorded baseline
- [x] #2 Unreadable subpixel facade detail does not rasterize at distant scales, while building geometry, file-floor meaning, selection, and route interaction remain present
- [x] #3 Pure panning does not rewrite zoom-only route or scale state, and camera movement does not rebuild the world
- [x] #4 F1 map-only mode, F3 FPS, zoom, pan, selection, routes, pins, and the current production map remain visually and behaviorally correct
- [x] #5 Focused tests, bun run check, and Browser QA pass without relevant console warnings or errors
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
1. Record a repeatable Chrome CPU-throttled minimum-zoom trace on the stable production map, including dropped frames and Paint, RasterTask, GPU, script, style, and layout costs.
2. Put distant-scale detail policy in the existing iso scale domain: remove facade pattern rasterization when the tile would be subpixel while keeping every face and floor.
3. Split camera work by what actually changed so pure pans only move the camera/grid/pins; update stroke/name/arrow scale only when zoom changes, and remove redundant DOM writes.
4. Profile after each slice. If full SVG repaint remains the limiting cost, establish a real compositing boundary or reduce the route paint surface without changing route interaction.
5. Add focused invariants, run bun run check, then validate F1/F3 and the complete interaction flow in Browser and throttled Chrome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial in-app Browser diagnosis on the production map found 1,272 SVG elements, 163 patterned polygons (155 building facades), and 60 route groups. In a controlled 120-move trace, hiding patterns reduced raster work about 39%; hiding routes reduced map paint about 36% and GPU work about 53%; hiding the grid had a smaller effect. JavaScript was not the primary cost. Chrome CPU-throttled baselines will be the authority for implementation comparisons.

Implemented the first performance slice. Distant building facade patterns now stop painting until their smallest mark reaches one screen pixel. Map moves cache scale state, so pure pans only update the camera and grid transforms; route arrow transforms, grid stroke widths, visibility state, and zoom copy change only with scale. Wheel and pointer movement coalesce to one camera paint per animation frame, and pins pan through one layer transform instead of per-pin left/top writes. Neutral route lines are batched into one painted path per origin while each route keeps its own hit path, tooltip, arrow, id, and state overlay. Focused projection/scale/camera/FPS tests and typecheck pass. Exact Chrome remains unavailable because the ChatGPT Chrome extension is not connected, so the required throttled trace is still pending.

Second slice batches neutral route strokes into one painted path per origin while keeping atomic hit targets and state overlays. Distant minimum zoom also omits only the minor grid path, leaving the major grid. Route arrows now consume one inherited camera scale value instead of one transform write per route, and unreadable building labels leave the paint tree instead of staying as transparent text. The production server serves the revised bundle. bun run check passes with 81 Node tests and 172 Bun tests; only the repository's existing 42 non-failing complexity warnings remain.

Cold simplicity review passed after one targeted re-review. Collapsed the extra camera paint wrapper so render.ts is 498 lines, renamed and documented route batching around base paths and interactive overlays, removed redundant scale invalidation after world paint, shared facade-mark and grid-pitch constants across scale/paint code, simplified the route overlay selector, and clarified the scale test name. Focused tests and typecheck pass; the re-review found no regressions or remaining simplicity findings.

Post-simplicity full verification: the first bun run check hit the timing-sensitive scan-watch assertion once; its exact test then passed, and a complete rerun passed with 81 Node tests and 172 Bun tests. Existing 42 non-failing complexity warnings remain unchanged.

Validation is paused at the external Chrome gate. Diagnostics confirm Google Chrome 151 is installed, the ChatGPT extension is installed and enabled, and the native-host manifest is correct; Chrome is closed. Launch permission has been requested repeatedly but not received, so the required CPU-throttled before/after trace and final browser interaction QA cannot run yet. The task remains In Progress and uncommitted.

Chrome 151 final benchmark used fresh geometry-matched pages at 1280x720, map-only minimum zoom, 1.5x CPU throttling, and the same native 61-point out-and-back pan. Baseline: 2 dropped frames; Paint 15.01 ms, RasterTask 46.51 ms, GPU playback 46.12 ms, 107.64 ms combined. Optimized: 0 dropped frames; Paint 2.99 ms, RasterTask 24.34 ms, GPU playback 23.95 ms, 51.28 ms combined, a 52.4% reduction. Chrome QA then passed at normal CPU: clean load and console, F3 stayed visible through F1 HUD toggling, zoom and pan worked, pure pan changed only the camera transform while zoom state, route/scale flags, authored geometry hash, and SVG count stayed fixed; building, relationship, and TASK-182 pin selection all populated details. At minimum zoom the live map kept 60 interactive route groups and one batched neutral base path while painting zero facade patterns and omitting only the minor grid.

The required full-context architecture review found no blocking issue or useful in-scope simplification. It recommends keeping the domain ownership as-is: render.ts schedules input, iso/map.ts and iso/scale.ts own camera/scale presentation, iso/paint-routes.ts owns route batching, and work/pins.ts owns overlay movement. The reviewer judged the explicit pan/zoom/world boundaries safer for junior developers than adding a camera abstraction. Final bun run check passed: 81 Node tests and 172 Bun tests; only the repository's existing 42 non-failing complexity warnings remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made minimum-zoom map movement fast by skipping subpixel facade and minor-grid paint, separating pure-pan DOM work from scale work, coalescing camera input, moving pins as one layer, and batching neutral route strokes while preserving atomic interaction. Chrome 151 at 1280x720 and 1.5x CPU throttling recorded 0 dropped frames and reduced combined Paint/RasterTask/GPU time from 107.64 ms to 51.28 ms (52.4%). Full F1/F3, zoom, pan, selection, route, pin, geometry, console, focused-test, and bun run check validation passed.
<!-- SECTION:FINAL_SUMMARY:END -->
