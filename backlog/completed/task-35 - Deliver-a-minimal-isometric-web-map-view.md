---
id: TASK-35
title: Deliver a minimal isometric web map view
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:34'
updated_date: '2026-08-16 12:49'
labels: []
dependencies: []
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A new `groma web` command serves a browser page that renders the current repository's architecture world as an isometric city map. This is the first web viewer slice: map only, no header, footer, or side panes. Its purpose is to get the visual encoding of C4 layers, sibling grouping, and element kinds right so the web direction can be judged and iterated on a real rendering. The whole world is one isometrically transformed plane; map text skews with the plane by design.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running `groma web` starts a local server, prints its URL, and the page shows the current repository's architecture world as an isometric map
- [x] #2 C4 containment reads as stacked layers: elements with children render as flat plates and their children sit on top of them; leaf elements render as extruded prisms
- [x] #3 Each C4 kind (person, system, container, component) is visually distinguishable on the map
- [x] #4 Sibling groups render as visible neighborhood zones with the group name on the ground plane
- [x] #5 Relationships follow their computed routes and remain visible (not hidden under plates)
- [x] #6 The first view fits the whole map; scrolling zooms and dragging pans the camera without changing the world layout
- [x] #7 Tests cover the scene-building invariants: layering by containment depth, painter ordering, camera fit, and world immutability
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
1. Add a `web` command to src/cli.ts that starts src/viewers/web/server.ts (Bun.serve, reloads the view model on each request so refresh picks up edits).
2. Build src/viewers/web/scene.ts: pure ArchitectureWorld -> IsoScene. Containment depth sets elevation (one LAYER_RISE per layer); elements with children become slabs (plates), leaves become prisms with per-kind heights; groups become zones on their parent's surface; routes sit at the lower endpoint's surface. One painter ordering: layer asc, then slab/zone/route/prism phase, then near-corner (x+y) asc.
3. Build src/viewers/web/page.ts: scene -> single HTML page with inline SVG. Faces are hand-projected polygons; flat content (zones, routes, labels) lives in per-elevation groups under one affine iso matrix so map text skews with the plane. Kind hatch patterns on side faces, paper tops, dashed stroke for planned/missing, hover highlight + native title tooltip. Small inline viewBox pan/zoom script; initial viewBox from the scene fit box.
4. Tests in test-bun/web-scene.test.ts (bun:test, test.concurrent, inline world fixtures): depth->elevation, painter ordering invariants, route/zone elevation, fit box contains all corners, world immutability.
5. Visual check in the browser at default and large sizes; iterate on heights/hatches until layers, grouping, and kinds read clearly.
6. Cold simplicity review on the diff, apply accepted simplifications, rerun checks, then finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `bun run check` passes (typecheck, architecture validation, 56 node tests, 28 bun tests incl. 7 new web-scene tests). Live browser check against this repo: server prints "groma web at http://localhost:4747"; screenshots confirm the fitted first view, stacked plates with prisms on top, dashed ghost prisms for planned/missing, dotted person blocks with head glyph, dashed group zone with name, skewed route labels; wheel zoom, drag pan, and green hover highlight exercised interactively.

Corrections during implementation: initial painter phases drew slabs before routes on the same surface, letting routes paint over blocks standing on them; fixed so flat decor (zones, routes) draws before same-surface blocks, caught by the painter-order test. Cold simplicity review returned 6 findings (drop layerOf from the sort in favor of stored elevations, remove unused server stop/port, unexport prismHeights, rename SceneItem discriminant to kind, reuse the right-face projection, single-mechanism immutability test); all applied and checks rerun.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a `groma web` command serving a single self-contained HTML page that renders the ArchitectureWorld as an isometric city: containment depth stacks plates (slabs) with children standing on top, leaves are extruded prisms with per-kind heights and hatches, groups are dashed neighborhood zones, routes run flat on their surface, and all map text skews with the plane while pan/zoom only moves the viewBox camera. New files src/viewers/web/{scene,page,server}.ts plus a cli branch; scene building is pure and covered by 7 concurrent bun tests. Verified with `bun run check` (all green) and interactive browser screenshots of this repository's world (fit view, zoom, pan, hover).
<!-- SECTION:FINAL_SUMMARY:END -->
