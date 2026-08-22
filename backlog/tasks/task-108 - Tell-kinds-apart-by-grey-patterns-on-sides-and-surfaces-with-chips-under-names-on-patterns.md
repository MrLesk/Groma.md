---
id: TASK-108
title: >-
  Tell kinds apart by grey patterns on sides and surfaces, with chips under
  names on patterns
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 19:58'
updated_date: '2026-08-22 20:20'
labels: []
dependencies: []
references:
  - iso-map
  - web-viewer
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The map tells kinds apart by tinted roofs and hatches only tower sides. Give every kind one grey pattern shared by all of its elements and by nothing else: component buildings carry a light pattern on their side faces and a plain roof, people and external buildings the same with their own patterns, container slabs a very light surface treatment, the system island plain paper; and lay a translucent paper chip under every name that lies on a pattern (people and external island bands, container bands, zone names) so it reads at any zoom. White and grey only; the accent stays reserved for selection and lit flows. Building types per kind are a later task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every element of one kind uses the same pattern and shade, and no other kind uses it: components, people and externals on their side faces, containers on the slab surface, systems plain; no fill depends on a single element
- [x] #2 Building roofs are plain; side patterns are laid in the face planes through the plane matrices, so they skew with the faces
- [x] #3 A translucent paper chip lies under every name that lies on a pattern and under no name on a plain surface; chips are laid in the surface plane and sized to the text
- [x] #4 Light and dark palettes both define the pattern and chip colours, selection still changes strokes only, bun run check passes, and the browser DOM shows the patterns and chips as described
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
1. src/viewers/web/iso/style.ts: one pattern per kind, each tile drawn in the plane it lies on: dots, crosses and storey lines for the left and right face planes; dots, crosses, a faint grain and the zone hatch for the ground. Roofs plain for every kind. CSS maps kinds to patterns and styles the chip.
2. src/viewers/web/iso/paint-buildings.ts: a pattern overlay on every building side face (was towers only); src/viewers/web/iso/paint-ground.ts: a grain overlay on slab tops, chips for people and external island names, slab names and zone names, none for system islands.
3. src/viewers/web/iso/text.ts: surfaceText lays a translucent paper chip under its lines when asked, sized from the text metrics and the letter spacing.
4. docs/viewers/web/index.md; bun run check; browser DOM check of fills per kind, plain roofs and chip placement.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: style.ts builds one pattern tile per kind and plane through tile(id, plane, size, body) and planeMatrix (dots, crosses, storey lines for the left and right face planes; dots, crosses, grain and the zone hatch on the ground), maps kinds to patterns in CSS and styles the chip (paper at 0.75 opacity); every roof is plain deck. paint-buildings.ts lays a side overlay on every building's side faces (towers no longer special), paint-ground.ts lays a grain overlay on slab tops and asks for chips under people and external island names, slab names and zone names. text.ts surfaceText lays the chip from the text metrics and the letter spacing. Browser DOM check on the live map: component sides fill url(#lines-left/right), person sides url(#dots-left/right), external sides url(#cross-left/right), 88 side overlays for 44 buildings, every roof rgb(255,255,255), slab top plain with a url(#grain) overlay, islands url(#dots) and url(#cross), system island plain paper, zones url(#hatch-ground); 13 chips: 2 on the people and external islands, 0 on the system island, 6 on slabs, 5 on zones, 0 on buildings. bun run check green (92 node + 126 bun tests).

Cold simplicity review applied: the side overlay shares the pattern class with surfaces (one concept: a pattern overlay on a face), the island letter spacing is set on the text node from the same spacing value that sizes the chip (the CSS rule is gone), the details pane's chip rules are scoped to #details so the map's chip class stands alone, stale words dropped (hatched tower, the theme comment), the building class no longer carries the shape kind nothing styled, one storey-line body, a comment for the 0.9 em baseline and 0.2 em descent. Re-verified in the browser after the review on /?component=scan: component sides url(#lines-left/right), person sides url(#dots-left/right), external sides url(#cross-left/right), 88 pattern overlays on 44 buildings, every roof rgb(255,255,255), slabs url(#grain), islands url(#dots) and url(#cross), system island paper, zones url(#hatch-ground); island names carry letter-spacing 0.14em on the node (computed 1.68px), roof names 0em; 13 chips (2 island, 6 slab, 5 zone, 0 system island, 0 building) at paper 0.75; no unscoped .chip rule reaches the map. bun run check green (92 node + 126 bun tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Kinds are told apart by one grey pattern each, laid in the plane it lies on and never on a roof: storey lines on component sides, dots on person sides and the people island, crosses on external sides and the external island, a faint grain on container slabs, plain paper for systems; a translucent paper chip sits under every name that lies on a pattern (island bands of people and externals, slab bands, zones) and under no other. Patterns are tiles built from the plane matrices in style.ts, overlays in the painters, the chip in surfaceText. Verified by a browser DOM check of every fill, the chip count and placement, in both the task's first pass and after the review; bun run check green.
<!-- SECTION:FINAL_SUMMARY:END -->
