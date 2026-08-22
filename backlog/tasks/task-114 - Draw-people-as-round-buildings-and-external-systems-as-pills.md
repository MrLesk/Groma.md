---
id: TASK-114
title: Draw people as round buildings and external systems as pills
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 22:33'
updated_date: '2026-08-22 22:50'
labels: []
dependencies: []
references:
  - sheet
  - iso-projection
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every building is a box today, so people and external systems are told apart from components only by their patterns. Alex wants building types per kind, starting with two: a person is a round building (a cylinder whose roof is a circle on the ground holding the name) and an external system is a pill (a stadium-shaped roof, long enough for the name on one line). Footprints stay whole cells so routing is unchanged; the kind patterns stay on the sides; roofs stay plain.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every person stands as a cylinder: a circular roof inscribed in a square footprint with the name inside the circle, the curved side carrying the people pattern
- [x] #2 Every external system stands as a pill: a stadium roof inscribed in its footprint with the name on one line inside it, the sides carrying the external pattern
- [x] #3 Routes still leave and arrive at the middle of the footprint's sides, selection outlines the new shapes, and components keep their boxes
- [x] #4 The web viewer doc describes the two shapes
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
1. src/sheet/types.ts: Shape kinds gain round and pill. src/sheet/measure.ts: footprintOf sizes a round building as the square whose inscribed circle holds the name's text box, and a pill as one line of text plus a semicircle of radius d/2 at each end (d = 2).
2. src/sheet/place.ts: building() picks the shape by kind: person round, external pill, component by its files.
3. src/viewers/web/iso/project.ts: buildingTiers samples the roof outline (circle or stadium) in the ground plane, projects it at the base and the top, emits the roof polygon and one front band (the outline arc between the screen-x extremes that passes the front-most point, at the base, then back along the top) as a left face; roofText centres the lines inside the roof.
4. src/viewers/web/iso/paint-buildings.ts needs no change: faces are polygons; the people and external patterns lie on the band.
5. test-bun/iso-map.test.ts: round and pill roofs are closed outlines inside their footprints with the name centred; footprint sizes in sheet-scene.test.ts.
6. docs/viewers/web/index.md: the two shapes. 7. Browser: people island and the Git island at 4x.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shapes round and pill added to Shape; place.ts picks round for people and pill for external systems (name on one line), components keep shapeOf(files). footprintOf: a round building's square side covers the diagonal of the name's block (Ann the architect -> 6x6, Ab -> 2x2), a pill is the block's width plus a semicircle end on each side with d = 2 (Git -> 4x2). project.ts samples the roof outline (32 segments for a circle, 16 per semicircle), emits the roof polygon and one front band (the outline between the screen-x extremes through the front-most point, base then top reversed) as the left face so tint and pattern apply, and centres the name's block on curved roofs. Browser proof (a magnified standalone render of the coding agent, human architect and Git buildings): circular roofs with centred one- and two-line names and the people dots on the band, a stadium roof with Git on one line and crosses on the band; DOM: person top polygon 32 points and one band with one pattern overlay, Git top 34 points; checks green (92 node + 131 bun).

Simplicity review applied: one roofOutline for both shapes (a circle is a stadium whose caps share a centre), one band walk with its direction stated, roofBlock(lines) shared by footprintOf, roofText and the projection test, the pill's cap comment, the roof inset computed inside roofText, and a curved(shape) predicate. Checks green after the review (92 node + 131 bun); the fixture and live outputs are unchanged by the refactor (same band and roof point counts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
People now stand as round buildings (a cylinder with the name centred in its circular roof) and external systems as pills (a stadium roof with the name on one line), sized so the name fits, drawn from a sampled outline with one front band that carries the kind's pattern; footprints stay whole cells so routing and selection are unchanged. Verified by the measurement and projection tests, the full check and a magnified browser render of the coding agent, human architect and Git buildings.
<!-- SECTION:FINAL_SUMMARY:END -->
