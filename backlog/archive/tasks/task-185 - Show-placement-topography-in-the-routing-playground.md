---
id: TASK-185
title: Show placement topography in the routing playground
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-27 15:11'
updated_date: '2026-08-27 16:00'
labels: []
dependencies: []
modified_files:
  - layout-comparison/src/topography.ts
  - layout-comparison/test/topography.test.ts
  - layout-comparison/src/render.ts
type: feature
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer inspecting the isolated :4141 routing playground can turn on a contour-map debug layer that exposes the scalar terrain used to reason about building repulsion and route valleys. Each complete visible building envelope is a peak at its ceiling height; the field decreases continuously toward ground and overlapping slopes merge without changing placement or routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The :4141 playground has an optional Topography control and the layer is off by default
- [x] #2 Enabled topography shows readable filled height bands and contour lines around every visible building on the same isometric ground plane
- [x] #3 Each building envelope is a peak at its ceiling height, sampled field height never increases while moving away from all peaks, and overlapping slopes merge deterministically
- [x] #4 Toggling topography changes only the debug painting and does not recalculate or alter buildings, groups, placement, ports, or routes
- [x] #5 Focused fixtures prove peak height, monotonic descent, merged fields, deterministic contours, and unchanged scene geometry without reading the live groma tree
- [x] #6 The feature remains inside layout-comparison and does not become a production Web or TUI dependency
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Developer visually approves the topography overlay against the live Groma map
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Represent each visible roof plate as a peak using its real footprint and cumulative ceiling height. Define one continuous maximum field that descends one height unit per 24-unit map cell and clamps at ground.

2. Sample the field on that same grid. Paint each sampled cell as one connected quadrilateral facet, shade it from its height gradient, and extract deterministic one-height-unit contours with marching squares. Bucket facets and their contour segments by map depth.

3. Interleave the precomputed terrain buckets with unchanged building groups in one far-to-near SVG painter order. Keep routes, surfaces, groups, scene JSON, camera, and Raw/Refined switching unchanged. The Topography control only reveals or hides terrain buckets.

4. Cover peak height, monotonic descent, maximum-field merging, stepped floors, deterministic contours, ordered painter buckets, and input immutability. Run focused checks, the repository check, and close browser QA against the live :4141 map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added the isolated topography domain boundary. It derives cumulative roof peaks, computes a maximum distance field that descends one height unit per two map cells, samples the existing map grid, and generates one precomputed isometric terrain mesh with marching-squares contours.

Added minimum fixture coverage for strict roof-to-ground descent, maximum-field merging, cumulative stepped roofs, deterministic isolines, finite geometry, and input immutability.

The stepped-roof fixture now records the intended maximum-field behavior: the upper roof’s continuous slope remains above a lower exposed roof where it has greater influence, rather than creating an artificial flat terrace.

Integrated the precomputed terrain into the existing SVG between architecture surfaces and buildings. A separate Topography button only toggles the debug group’s hidden class and aria state; route mode, camera, scene geometry, and server calculations are untouched.

Browser QA reproduced the Topography button outside the normal narrow in-app panel because the diagnostic header is wider than that viewport. The narrow header now hides only its title and metrics, leaving Raw/Refined and Topography controls visible; the desktop header is unchanged.

Verification after the responsive fix: all 34 layout-comparison tests pass (129 assertions), layout-comparison TypeScript compilation passes, and the full `bun run check` passes with the repository's existing cognitive-complexity warnings only. Browser QA at 1440x900 and 390x844 found no console errors. The layer is off after reload, renders 8 filled bands and 24 contour levels for the current live scene, and toggling it leaves all 60 active route path geometries byte-for-byte unchanged.

The first browser review showed that geometrically raised contour lines could still read as flat ink because there was no visible relation to z=0. Each contour now also paints a light ground projection and a translucent vertical face beneath its exact raised line; these are debug cues only and do not change the scalar field.

To make elevation readable rather than merely mathematically correct, sparse deterministic drop guides now connect raised contour midpoints to their ground projections. The ground traces are dashed and the vertical faces remain translucent, so the exact raised line stays visually dominant.

Final raised-contour verification: all 34 comparison tests and TypeScript compilation pass; the full `bun run check` passes with 177 Bun tests and 81 Node tests, with only existing cognitive-complexity warnings. Browser QA found 24 raised contours, 24 ground projections, 24 wall layers, and 24 riser layers with no console errors. Toggling still leaves all 60 active route geometries unchanged. The required cold simplicity review and its one targeted re-review both passed with no blocking simplification.

The developer rejected the ground curtains after seeing nested cylinders. Removed every per-contour ground trace, vertical wall, and drop guide. Contours again sit only on the single continuous filled terrain skin, so each line bounds the area between adjacent heights instead of independently extending to z=0.

Cylinder correction verification: the live SVG now contains 8 filled terrain bands, 24 raised contours, and zero contour walls, ground copies, or risers. Browser QA at the actual 319x734 in-app viewport shows one joined terrain skin after zoom, Topography remains interactive, all 60 routes remain present, and there are no console warnings/errors. All 34 comparison tests, comparison TypeScript, and the full repository check pass.

After the developer approved the depth-cue diagnosis, replaced the monolithic transparent mesh with diagonal depth buckets. Each sampled cell is split into two connected slope facets, quantized by combined height and light-facing normal; contour segments join the same depth bucket as their surface. This prepares terrain and buildings to share one painter order without touching layout or route geometry.

Integrated terrain slices and existing building groups into one depth-sorted landscape stream. Hidden terrain slices preserve the normal map exactly; the Topography button only toggles those precomputed slices. Facets now use opaque paper/accent mixes with slope-and-height shading rather than one transparent multiply layer.

Extended the existing deterministic terrain fixture to assert that emitted painter slices are ordered from far to near.

First depth-mesh browser pass exposed weak slope contrast and broken contour joins. Lighting now emphasizes facet direction rather than mostly the upward normal, and every contour segment uses the depth of its owning terrain cell so it paints after that complete facet bucket.

Second browser pass showed almost every facet in four middle shades. Directional lighting now normalizes by the horizontal normal, so even a deliberately gentle slope uses the full light-to-shadow range while flat roofs retain a neutral shade.

Even with full directional shading, close QA showed the original two-cell run produced only six vertical screen pixels per isometric cell. Tightened the debug field to one height unit per map cell. Peaks still equal building ceilings; the smaller horizontal run makes the slope legible without z exaggeration.

The focused stepped-roof expectation still encoded the previous two-cell slope and failed after the intentional run change. Updated it to the new one-cell diagonal descent; no production behavior changed in this correction.

Steeper-mesh QA showed half-height contours obscuring the facet lighting. Reduced isolines to one per building height unit; the continuous sampled surface and scalar field are unchanged.

Final close QA found checkerboard seams from shading the two triangles of one sampled cell separately. Collapsed each cell to one projected quadrilateral and one shade derived from its east/west and north/south height gradients. This removes diagonal seams and halves facet subpaths.

Current shaded-mesh verification: all 34 comparison tests (130 assertions) and comparison TypeScript pass. Warm :4141 response is 1.3 ms and 645,196 bytes. Browser QA shows 199 depth slices, 1,354 grouped facet paths, 193 grouped contour paths, no console warnings/errors, default-off behavior, and all 60 route path geometries unchanged after toggling. The repository-wide check is temporarily blocked by unrelated concurrent Web layer-mode type errors in src/viewers/web/iso/map.ts, src/viewers/web/render.ts, and test-bun/web-layer-mode.test.ts; no TASK-185 file contributes an error.

The required full-context final architecture review approved the domain boundary but blocked finalization on dead state left by the final whole-unit contour decision. Removed unused TerrainGrid width/height fields and collapsed unreachable minor/major contour buffers into one contour path.

Moved the sole contour appearance onto the base contour style, preserving the approved whole-unit line weight while deleting the now-unreachable major override.

The final full-context architecture review approved the single topography domain and shared painter-order integration after dead contour state was deleted. Post-cleanup verification: 34 comparison tests pass with 130 assertions, comparison TypeScript passes, browser reload starts Topography off, enabling it leaves all 60 route geometries unchanged, and browser warnings/errors remain zero. The developer explicitly approved the final shaded mesh as perfect. Delivery status remains In Progress only because the untracked TASK-159/TASK-167 playground base prevents a safe standalone TASK-185 commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an optional shaded topography debug surface to the isolated :4141 routing playground. Building roof plates form deterministic ceiling-height peaks; a one-cell maximum distance field becomes depth-sorted quadrilateral facets and whole-height contours interleaved with unchanged buildings. Verified with 34 focused tests, comparison TypeScript, browser visual approval, zero browser issues, and byte-identical geometry for all 60 routes when toggled. Commit is pending a safe boundary for the still-untracked playground base.
<!-- SECTION:FINAL_SUMMARY:END -->
