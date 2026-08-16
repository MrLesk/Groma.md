---
id: TASK-39
title: Draw the web city with Three.js
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 14:21'
updated_date: '2026-08-16 14:31'
labels: []
dependencies:
  - TASK-37
references:
  - src/viewers/web/
  - docs/viewers/web/index.md
  - src/viewers/web/scene.ts
priority: high
type: feature
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect runs `groma web`, the page still shows this repository's architecture world as the same 2D/3D city, now drawn with Three.js instead of hand-projected SVG. The visual language does not change: plates, prisms, groups, routes, ghosts, and the fixed 2D and 3D views. The purpose is to judge Three.js as the map substrate so later Groma features do not keep extending a custom projector.

The viewer plugin still only projects the world core already computed. No React. No new chrome. No select or inspect in this slice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `groma web` starts the local server and the page shows this repository's architecture world in the 3D city view by default
- [x] #2 The 2D button shows the top-down plan and the 3D button returns to the city; switching re-fits without reloading
- [x] #3 Containment still reads as stacked plates with children on top and leaf elements as prisms; kinds, groups, routes, and planned ghosts stay visually distinct
- [x] #4 The first view fits the whole map; wheel zoom and drag pan move the camera without changing world layout
- [x] #5 Three.js is used only inside the web viewer plugin; Groma core and the TUI stay unchanged
- [x] #6 Existing scene tests keep passing; the live page is checked in the browser against this repository
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
1. Add the `three` package. Keep `scene.ts` as the elevation/slab/prism model.
2. Replace the SVG shell in `page.ts` with a full-page map host; keep the paper/ink CSS and the 2D/3D buttons.
3. Rewrite `render.ts` to build the city once as Three.js boxes, outlines, zones, routes, and top-face labels. An orthographic camera uses the existing 2D and 3D projections. Wheel zoom and drag pan move the camera. Switching views only repositions and refits the camera.
4. Do not add lights, shadows, React, select/inspect, or new chrome.
5. Describe the live map in `docs/viewers/web/index.md`.
6. Check this repository in the browser at both views, then run `bun run check`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `bun run check` green (typecheck, architecture validation, 60 node tests, 30 bun tests including 9 web-scene tests). Live browser at http://localhost:4747: page opens in 3D; 2D is the top-down plan; 3D returns and re-fits; wheel zoom and drag pan move the camera; hover outlines Core in green and sets the native title; dashed Scan reconciler and WORLD BUILDING zone read; console clean.

Cold simplicity review: recommended dropping hover (as inspect) and deleting the unused SVG projector (`project`/`orderScene`/`fitScene`) plus the tests that only lock it. Hover stays because it was part of the previous city, not select/inspect. The projector and its tests stay because AC #6 keeps the existing scene suite. Zoom-to-cursor stays to match the previous camera. Pinned `three` and `@types/three` to exact versions like the other dependencies.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the hand-projected SVG map with a Three.js city. groma web still shows this repository as the same 2D/3D map: plates, prisms, groups, routes, and dashed ghosts, with camera-only pan/zoom and view switching. scene.ts is unchanged. Verified with bun run check and interactive browser checks of both views plus zoom, pan, and hover.
<!-- SECTION:FINAL_SUMMARY:END -->
