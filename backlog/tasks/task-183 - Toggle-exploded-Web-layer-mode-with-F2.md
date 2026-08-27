---
id: TASK-183
title: Toggle exploded Web layer mode with F2
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 07:42'
updated_date: '2026-08-27 18:19'
labels: []
dependencies: []
references:
  - render
  - iso-map
  - page
  - iso-projection
  - orbit
  - pointer
  - separation
modified_files:
  - src/viewers/web/layers/separation.ts
  - src/viewers/web/layers/paint.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/camera.ts
  - test-bun/web-layer-mode.test.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
  - src/viewers/web/layers/orbit.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/pointer.ts
  - test-bun/iso-map.test.ts
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect presses F2 in groma web, the nested blueprint animates into an exploded view with separate system, container, and component layers. The entrance motion demonstrates that the layer view can be orbited. In layer mode, dragging rotates around the vertical axis with limited pitch, Shift-drag pans, and the existing map interactions continue to use the displayed geometry. F2 returns to the fixed nested blueprint. The viewer mode coexists with every visual theme.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 F2 animates between the fixed nested Web map and the exploded layer view without reloading the page
- [x] #2 The exploded view presents system, container, and component layers as three clearly separated, spatially aligned blueprint layers with a clear depth order
- [x] #3 In layer mode, dragging provides 360-degree horizontal orbit with limited pitch, Shift-drag pans, and the entrance animation briefly demonstrates the orbit control
- [x] #4 Selection, flows, task markers, wheel or trackpad pan, zoom, and Fit use the displayed geometry, and returning to normal mode restores the normal projection
- [x] #5 Changing layer mode preserves the active visual theme and adds no theme-specific behavior
- [x] #6 Web help and viewer documentation explain F2 and its controls, focused tests cover projection, layer geometry, orbit state, and lifecycle, and browser QA verifies both modes without console errors
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
1. Generalize the existing isometric projector into one orientation-aware orthographic projection. Derive points, visible box faces, paint order, surface transforms, routes, bounds, patterns, and grid alignment from the same yaw and pitch while preserving the current fixed projection as the nested pose.
2. Extend the Web layers domain with one pose authority for layer separation and orbit motion. Keep 360-degree yaw, clamp pitch to a readable range, interpolate the F2 entrance and exit poses, and derive every painted scene from the current sheet, project profile, and pose.
3. Keep render.ts as the entry-point coordinator: F2 starts the motion, layer-mode drag orbits, Shift-drag pans, and every pose repaint reapplies pins, selection, flows, tasks, camera fit, and theme-neutral map styling. Extract task-scoped interaction logic so render.ts stays under 500 lines.
4. Update the F2 help and Web viewer documentation. Add focused concurrent tests for the default projection, rotated face/order invariants, yaw wrapping, pitch limits, transition endpoints, layer separation, source immutability, and live scene replacement.
5. Run focused checks and bun run check, then browser QA the entrance, full horizontal orbit, pitch limits, selection, flows, pins, pan, zoom, Fit, all themes, return animation, responsive layout, and console health. Finish with the required cold simplicity and full-context architecture reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a pure, theme-neutral layer projection. It derives lifted system, container, and component geometry from the projected scene without changing the architecture world or theme state.

Added theme-neutral blueprint planes, depth risers, and route-lift styling using only shared palette variables.

Route painting now keeps relationships readable across separated layers by drawing vertical joins as part of the same selectable route.

The isometric map now consumes one layered scene for both normal and exploded modes, keeping hit testing, selection, and pin anchors on the displayed geometry.

Layer presentation is included in the existing map stylesheet and remains palette-driven, so all themes receive the same geometry and visual hierarchy.

The layers domain now owns its small view-state transition and reapplies the active mode after live world updates, preventing renderer branches from resetting it.

Shared-file coordination: render.ts now imports createLayerView, routes F2 through the existing global shortcut block, paints the active layered scene, refreshes pin anchors, and preserves the mode across live world updates. Theme state and theme handling are untouched.

To keep render.ts below the project file-length limit, moved its existing key-target classification beside the camera key rules that consume it; behavior is unchanged.

render.ts now delegates keyboard target classification to camera.ts and remains under 500 lines after the F2 behavior.

Added focused concurrent business-logic tests for mode lifecycle, three-level geometry separation, source-scene immutability, live scene replacement, and cross-layer relationship joins.

Focused test correction: assert the authored island kind, since an island's embedded element intentionally carries identity rather than kind.

Exploded bounds now union the lifted architecture with the normal scene bounds and layer labels, so fitting the map keeps base drafting decorations visible.

The layer geometry test now verifies the fit bounds contain both base-scene extents and every lifted plane and label.

Shared-file coordination: TASK-184 integrated the exact  Help entry in page.ts alongside its separate Blueprint-theme changes. TASK-183 did not alter the file after integration.

Correction: the integrated Help entry reads F2 toggles layers. TASK-183 made no separate page.ts edit.

Shared-file coordination: TASK-184 integrated the F2 documentation under What you can do, between F1 and F3. It documents the three aligned layers, return to nested view, and preserved selection, flows, pins, pan, zoom, and Fit. TASK-183 left the integrated file unchanged.

Browser finding and correction: the fixed 180-world-pixel cap produced only 11 screen pixels between layers on the real Groma map. Layer separation now scales from the projected blueprint span so fitted views remain visibly exploded.

The map camera now exposes its current scale as a local SVG CSS value, allowing layer labels to remain readable without affecting any map geometry or theme.

Layer labels now keep an 11-screen-pixel size with a palette-driven paper outline, making each plane identifiable at Fit and through zoom in every theme.

Browser correction: moved plane labels from the busy north corner to the free west edge of each aligned sheet.

Separated plane-label painting from plane painting so sheets remain behind architecture while their names can stay legible above it.

The SVG map now has one non-interactive layer-label group after architecture bodies; map hit testing and selection groups are unchanged.

After TASK-184 finalized the shared renderer, removed one blank line and inlined the one-use keyboard target local. render.ts is back below 500 lines with no behavior change.

Cold simplicity review passed with no blocking findings. Applied its two optional deletions: reuse unchanged base-plane islands and reuse the element layer map for zone parent classification, removing one clone pass, duplicate bound points, and a duplicate slab set.

Architecture traceability: added the exact mode element id for the new layers domain, alongside render, iso-map, and page.

Scope expansion approved in chat: use the smaller exploded-stack orbit rather than literal underside inspection. The supported view has 360-degree yaw and limited pitch; no bottom faces, below-ground camera, WebGL renderer, or saved orbit state.

Added the layers-domain pose authority: it owns activation, the F2 transition, 360-degree yaw wrapping, readable pitch limits, and orbit drag. It has no DOM or theme dependency.

The isometric projector now takes one explicit yaw and pitch. The default pose reproduces the original projection, while visible box faces and painter order derive from view direction. Exported the existing bounds helper so layer mode can delete its duplicate.

Removed the former nested/exploded state from mode.ts. Layer mode is now a pure scene-at-separation operation, while orbit.ts is the only mode and motion authority. This prevents live-update and animation state from diverging and deletes the duplicate bounds implementation.

Layer sheets and labels now fade in with the separation amount, so the opening frames do not flash three labels on the same nested plane.

Map pattern definitions now derive from the active projection instead of a fixed isometric matrix, so surface grain, hatching, and facade marks stay attached to their planes during orbit.

Surface text now receives the scene projection explicitly, so labels remain on the same authored ground plane through orbit.

Ground painting now uses the scene view for compass letters, project-plate text and pencil, and every island, slab, and zone label. Painted text and projected polygons therefore share one orientation.

Building painting now separates visual left/right shading from the wall axis used by its pattern. This keeps face depth readable while facade marks remain attached to the correct wall through a full yaw orbit.

Route arrowheads now use the same ground-plane transform as their reprojected polylines.

The compass ring is now projected from ground points instead of stored as a fixed axis-aligned ellipse, so it remains a circle on the blueprint plane at every yaw.

Ground painting now draws the projected compass ring polygon; no separate fixed ellipse geometry remains.

The endless map grid is now one square cell-domain pattern transformed by the same ground-plane matrix and 2D camera as the architecture. Each repaint also replaces pattern definitions for the current pose, so no fixed 45-degree drafting layer remains behind an orbited map.

Focused projection tests exposed floating-point drift at the default pose. The default branch now keeps the original exact 2:1 integer formula; only non-default orbit poses use trigonometric projection.

Extracted the map pointer gesture table beside the isometric map: click selects, nested drag pans, F2 drag orbits, and Shift-drag pans. render.ts supplies actions but no longer owns low-level pointer lifecycle, keeping the entry point below the file limit.

The layers domain now also owns browser frame scheduling around its pure motion state. render.ts only asks it to toggle or orbit and supplies one repaint callback; reduced-motion handling and cancellation cannot be implemented differently by another caller.

render.ts now derives one displayed scene from sheet, project profile, and the layers-domain pose. Mode transitions refit the map continuously; manual orbit preserves the current screen centre and zoom, repaints pins, and reapplies only map selection, flow, and task state rather than rebuilding the side panes every frame.

Updated projection tests for the projected compass ring and added a rotated-view invariant: opposite yaw exposes opposite wall geometry and reverses painter depth while preserving left/right/top visual faces.

Layer-mode tests now use the single pose authority: animated and reduced-motion toggle endpoints, partial separation, 360-degree yaw wrapping, pitch clamps, shortest-path seam interpolation, layer geometry immutability, and cross-layer route joins.

Help keeps the existing F2 line and adds the mode-specific drag and Shift-drag controls in one concise line.

Web viewer documentation now explains the animated orbit cue, 360-degree horizontal orbit with limited tilt, Shift-drag pan, preserved controls, and fixed nested return.

Cold simplicity cleanup: renamed the pure layer geometry module from mode.ts to separation.ts. Orbit remains the only activation and motion authority, while separation now names exactly the scene operation the module owns.

Applied the remaining cold-review simplifications: removed the unused data-orbit DOM attribute, initialized the first scene through the shared projection helper, and reused DEFAULT_PROJECTION and PLANE instead of repeating their values.

Verification correction: updated the remaining type-only layer painter import after the mode.ts to separation.ts rename.

Post-cleanup verification: the focused layer/projection tests pass; the one isolated five-second timeout passed in 704ms when run alone; bun run check passes with 81 Node tests and 180 Bun tests. Only the repository's existing Biome complexity warnings remain.

Post-cleanup browser verification: after a fresh reload, F2 produces exactly three projected planes and three labels with the rotated grid matrix, and F2 returns to zero planes. Earlier full browser QA already verified orbit, pitch clamp, Shift-pan, selection, flows, pins, zoom, Fit, all themes, responsive map-only mode, transition frames, and no console warnings or errors.

Full-context architecture review: no recommend-now change, unmet acceptance criterion, Definition of Done gap, or supported-flow failure. The reviewer would keep the orientation-aware shared projection, pure separation derivation, one orbit authority, and one pointer gesture table. Optional non-blocking cleanup: inline the one-use toggleLayers wrapper; clarify that LayerMotion.active is the target/control mode during transitions; later consider a discriminated Face union so wall faces require a plane. Generated observed records for orbit, separation, pointer, and obsolete mode are repository hygiene outside this supported-flow gate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented an animated F2 exploded layer mode for the Web viewer. System, container, and component layers share one orientation-aware projection; drag orbits through 360-degree yaw with limited pitch, Shift-drag pans, and existing selection, flows, work pins, wheel/trackpad pan, zoom, Fit, live updates, and themes use the displayed geometry. F2 restores the fixed nested projection.

Verified with focused projection and layer tests, bun run check (81 Node tests and 180 Bun tests), and browser QA covering entrance/return motion, full orbit, pitch limits, Shift-pan, selection, flows, pins, camera controls, all themes, responsive map-only mode, and console health. Cold simplicity and full-context architecture reviews found no required change.
<!-- SECTION:FINAL_SUMMARY:END -->
