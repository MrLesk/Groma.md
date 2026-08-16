---
id: TASK-36
title: Add 2D/3D projection controls to the web map
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 13:01'
updated_date: '2026-08-16 13:10'
labels: []
dependencies: []
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The isometric default is hard to read. The web map gets a small screen-space control panel (the first unskewed chrome): a 2D/3D toggle, a rotation slider, and a tilt slider with degree readouts. 2D is the top-down plan (tilt 90, prism heights vanish); 3D is the tilted city view. The purpose is to explore projections live and pick the product default. Projection math moves to the client so the sliders re-render instantly without a server round trip; the world and scene stay server-computed and unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map page shows a 2D/3D toggle plus rotation and tilt sliders with degree readouts; changing them re-renders the map without reloading
- [x] #2 2D shows a flat top-down plan (no prism sides); 3D restores the tilted view; kinds stay distinguishable in both
- [x] #3 Painter ordering stays correct under rotation: blocks in front occlude what is behind at any angle
- [x] #4 Changing projection re-fits the camera to the whole map; pan and zoom still work afterwards
- [x] #5 The default view opens milder than classic isometric
- [x] #6 Scene ordering, projection, and fit tests cover rotation and top-down invariants
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
1. Generalize src/viewers/web/scene.ts around a Projection {rotation, elevation} (radians): project() rotates then tilts (elevation 90deg = top-down, z vanishes), buildScene() returns unordered items, orderScene(items, projection) applies the painter comparator with rotation-aware nearness, fitScene(items, projection) replaces the fixed fit. Export defaultProjection (rotation 45deg, elevation 60deg - milder than classic iso).
2. Move all SVG geometry to a client module src/viewers/web/render.ts that imports scene.ts (single source of truth): reads the embedded world JSON, draws all four side faces back-to-front so any rotation is correct, keeps flat labels/zones/routes in matrix groups derived from the projection, redraws on control input via requestAnimationFrame, re-fits on projection change, keeps viewBox pan/zoom. Per-kind top-face stroke widths so kinds read in 2D where sides vanish.
3. Shrink page.ts to a shell: styles, control panel markup (2D/3D toggle, rotation and tilt sliders with degree readouts), escaped world JSON, script src=/render.js.
4. server.ts: Bun.build render.ts for the browser once at startup and serve it at /render.js; / keeps reloading the view model per request.
5. Add DOM to tsconfig lib for the client module.
6. Update and extend test-bun/web-scene.test.ts: existing invariants through orderScene/fitScene, plus top-down z-invariance and a rotation that reverses back-to-front order.
7. Visual check across 2D, default 3D, and rotated views; then cold simplicity review, apply, rerun checks, finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `bun run check` green (typecheck with DOM lib, 56 node tests, 30 bun tests incl. 9 web-scene tests). Browser checks against this repo: control panel renders with degree readouts; 2D at rotation 0 shows a clean axis-aligned C4 plan with no wall strokes; 3D restores tilt; rotation and tilt sliders re-render live without reload; projection changes re-fit the camera and wheel zoom still works afterwards; console clean. Rotation-aware ordering covered by the half-turn reversal test; top-down z-invariance covered by a projection test.

Cold simplicity review returned 6 findings, all applied: label matrix now derived from project() columns instead of parallel trig; back walls filtered out instead of painted over (also removes doubled edge strokes at rotation 0); dead refit parameter, identity wall helper, duplicated mode-state reads, and a dead .side CSS rule deleted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved projection to the client and added the first screen-space chrome: a fixed panel with a 2D/3D toggle plus rotation and tilt sliders (degree readouts). scene.ts is now parameterized by Projection {rotation, elevation} with buildScene/orderScene/fitScene; render.ts (bundled by Bun at server start, served at /render.js) redraws the SVG per control input via requestAnimationFrame, drawing only viewer-facing walls and deriving flat-label matrices from project() itself; 2D is elevation 90deg where heights vanish. Default is milder than classic iso (rotation 45deg, elevation 60deg). Verified with `bun run check` and interactive browser checks (2D plan, rotated views, refit, zoom, clean console).
<!-- SECTION:FINAL_SUMMARY:END -->
