---
id: TASK-77
title: 'Route connections over surfaces, never under boxes'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 15:42'
updated_date: '2026-08-17 15:49'
labels: []
dependencies: []
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback on the web map: routes are drawn flat at the lower endpoint ground level (z = min of endpoint bases in scene.ts), so a route whose far endpoint sits inside a parent travels underneath that parent plate (person-to-component routes dive under the Groma plate). Relationships are authored between the lowest elements, so a route should ride on the surfaces its endpoints stand on: climb a plate edge with a vertical step at each boundary it crosses, like a trace over a circuit board, and never pass under a box. Applies to route bars, ghost dashed routes, relationship labels, and the animated person-command flow, in both Iso and Plan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every route rides on the surface beneath each point of its path: a segment inside a parent plate footprint runs at that plate top, with a vertical step where the route crosses the boundary, and no route passes under any box
- [x] #2 Route endpoints meet their elements at the element standing surface; ghost routes, relationship labels, and the animated flow overlay follow the same stepped path
- [x] #3 The scene invariant is covered by a fixture test: a route crossing into a nested parent starts at the outer surface, ends at the inner surface, and steps vertically at the boundary
- [x] #4 bun test passes
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
1. In src/viewers/web/scene.ts, compute a stepped 3D path per route: the surface at a point is LAYER_RISE times the number of parent (children-bearing) elements whose bounds contain it; split each route segment at parent boundary crossings, give each piece the surface z of its midpoint, and insert vertical connector points where the z changes. Emit path and a labelZ on the route scene item, keeping z for painter ordering.
2. Generalize addBar in molecules/route.ts to any 3D direction (quaternion instead of y-rotation) and render route bars, ghost dashed lines, and the label from the stepped path; the flow overlay in render.ts already consumes route points and follows automatically.
3. Use the stepped path in fitScene and pass it through organisms/city.ts.
4. Replace the route-z fixture test with stepped-path assertions (starts at outer surface, ends at inner surface, vertical step at the boundary, no midpoint under a plate) and update the fit test.
5. Verify in the browser in Iso and Plan, with and without an active person command; bunx tsc; bun test; cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Routes now ride the surfaces they cross. scene.ts computes a stepped 3D path per route: surfaceAt(plates, x, y) is LAYER_RISE times the number of children-bearing elements containing the point; each 2D segment is split at plate-edge crossings and each piece takes the surface of its midpoint, with vertical connector points where the surface changes. Route bars render along any 3D direction via a quaternion; ghost dashed lines, the arrow, the label (surface-derived labelZ), and the flow overlay all follow the stepped path automatically. Verified in the browser: person routes run on the ground, climb the Groma plate edge, and travel on plate tops to Cli and onward; the animated person-command flow climbs with them; nothing tunnels under a box in Iso or Plan. Fixture test pins start surface, end surface, the vertical step exactly at the crossing boundary (x=110), and that no horizontal piece runs under a containing plate. Cold simplicity review applied: single surfaceAt helper, RoutePoint reused in addRoute's signature, elevatedRoute un-exported, crossing guards hoisted. Note for the design question raised during the task: ELK cannot own this - it routes in 2D and a route ending inside a parent must enter that parent's footprint; elevation exists only in the web projection, so the fix lives in scene.ts. bunx tsc clean; bun test 143 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routes never pass under boxes: the web scene computes a stepped path per route that rides each plate surface it crosses, climbing with a vertical step at every boundary; bars, ghosts, labels, arrows, and the animated flow follow it. Covered by a fixture test asserting the start and end surfaces, the boundary step, and the no-under-plate invariant. Verified with browser screenshots in Iso at multiple zooms with and without an active command, bunx tsc, and bun test (143 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
