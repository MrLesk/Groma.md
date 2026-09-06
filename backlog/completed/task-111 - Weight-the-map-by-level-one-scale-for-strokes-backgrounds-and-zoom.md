---
id: TASK-111
title: 'Weight the map by level: one scale for strokes, backgrounds and zoom'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 21:52'
updated_date: '2026-08-22 22:03'
labels: []
dependencies: []
references:
  - iso-map
  - render
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At fit the zoomed-out web map is a wireframe: island, slab, building and route edges are all the same one-pixel grey and the system island and container slabs are plain white, so nothing tells a boundary from a thing or a connection. Alex's second Excalidraw drawing (2026-08-22) shows the intended reading: stroke weight falls with depth (system heaviest, container, component, relationship thinnest) and background rises with depth (system light, container denser, component solid, person white). Build it as a design system, not per-element tuning: levels island, slab, building, route derive their stroke, background tint and name style from one scale with a fixed ratio, like heading levels; kind patterns stay the second axis on top. One zoom multiplier scales every stroke so boundaries get bolder when zooming in, and building names hide below the zoom where they cannot be read while island and slab names stay.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At fit, system islands, slabs, buildings and routes have visibly different stroke weights in that descending order, and system islands and slabs have a non-white background lighter than building sides
- [x] #2 Every stroke, background and name style comes from one level table with a fixed ratio between levels; no selector sets a width or tint by hand
- [x] #3 Zooming in scales every stroke by one shared multiplier; at fit the multiplier is 1
- [x] #4 Building names are hidden below readable zoom and appear when zooming in; island and slab names stay
- [x] #5 Both themes derive the tints from paper and ink, and the kind patterns, chips, selection and lit-flow accents still read
- [x] #6 The web viewer doc describes the levels
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
1. src/viewers/web/iso/scale.ts (pure): levels island, slab, building, route from the outside in; strokeAt(depth) = 1px at buildings times 1.4 per level up, tintAt(depth) = 4% ink at islands times 1.8 per level down; a thing's sides lie one level deeper than its top (left face half a level more); emphasis(steps) climbs the stroke ladder for hover, selection and lit routes; weightAt(zoom/fit) = sqrt clamped to 0.75..2; namesVisible(k) once the roof font is 6 screen px.
2. src/viewers/web/iso/style.ts: every level group sets --stroke, --top, --right, --left from the scale; one rule gives every stroke calc(--stroke * --emphasis * --weight); fills come from the tokens; people keep paper faces as the one kind fill; building labels take opacity --names.
3. src/viewers/web/atoms/theme.ts: drop deck, face and island colours (tints now mix paper and ink with color-mix).
4. src/viewers/web/iso/map.ts move(camera, zoomRatio) sets --weight and --names on the camera group and scales arrowheads by weight; render.ts passes camera.k / fitted.k.
5. test-bun/iso-scale.test.ts: ladder monotonic, building stroke 1, weight 1 at fit and clamped, names hidden at fit-like zoom.
6. docs/viewers/web/index.md: the levels paragraph.
7. Browser screenshots at fit, 2x and 4x in light and dark for Alex to judge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built scale.ts (levels island/slab/building/route; stroke 1px at buildings times 1.4 per level up; tint 4% ink at islands times 1.8 per level down; sides one level deeper, left half a level more; emphasis climbs the ladder; weight sqrt of zoom/fit clamped 0.75..2; names at 6 px roof font). style.ts derives every token; theme.ts lost deck/face/island colours. Simplicity review findings applied: arrowhead comment, merged zone rule with its reason, duplicate route.selected emphasis dropped, tokens renamed --name-opacity/--top-fill/--right-fill/--left-fill, doc wording, fade removed.
Verified in the browser at 1280x800 (light): at fit weight 1, stroke widths island 1.96 (2.744 selected), slab 1.4, building 1, route 0.71 px; fills island 3.5% ink, slab 6%, roof 11%, right side 20%, left 27%, person paper; building labels opacity 0. At 381% weight 1.95, route 1.39 px, arrowhead scale weight/k, labels opacity 1. Dark theme: island 0.10, slab 0.13, roof 0.18, left 0.33 luminance from its own paper and ink. bun run check green (92 node + 129 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map's strokes, backgrounds and name visibility now come from one level scale (island, slab, building, route) with fixed ratios, one zoom weight on the camera group and states that climb the same ladder; verified by the iso-scale unit tests and computed styles in the browser at fit, 2x, 4x, light and dark.
<!-- SECTION:FINAL_SUMMARY:END -->
