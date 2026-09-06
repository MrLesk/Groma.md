---
id: TASK-97.1
title: Replace the main Web map with interactive SVG
status: Done
assignee:
  - '@luna'
created_date: '2026-08-19 06:32'
updated_date: '2026-08-19 18:14'
labels: []
dependencies:
  - TASK-97.2
references:
  - web-viewer
  - render
  - page
parent_task_id: TASK-97
priority: high
type: feature
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the production Three.js map inside the existing Groma Web page with an interactive SVG renderer driven only by the shared Web scene contract. Preserve the current user workflow and watch updates; do not redesign the surrounding product in this slice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The main Web page renders its map as SVG and never instantiates WebGLRenderer
- [x] #2 Map and hierarchy selection stay synchronized and details always show the current selection
- [x] #3 Enter/out navigation, fit, zoom, pan, plan/isometric projection, and current flow highlighting/playback remain functional
- [x] #4 World updates rebuild the SVG scene without duplicating semantic or routing rules in the browser controller
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
Observable flow: When an architect opens `groma web` at `/`, Groma keeps the existing header, hierarchy, details, and footer chrome while showing the selected Context, Containers, or Components semantic city as an interactive SVG; map/tree selection, details, camera controls, and active flow state remain visible after updates, matching the approved `01-system-context.png`, `02-containers.png`, and `03-core-components.png` examples. Visual styling/font changes remain TASK-97.3 scope.

1. Replace the Three.js boot, city construction, raycaster picking, and map paint in `src/viewers/web/render.ts` with one browser controller state: world/generation, semantic level/focus, selected representation, active action/playback, theme, and SVG camera. Rebuild the scene only by calling `semanticView(world, { level, focusId })`; consume its items, routes, selectionTargets, and focusScope without a second disclosure or endpoint algorithm.
2. Add `src/viewers/web/svg-scene.ts` for pure semantic-city-to-SVG geometry, projection, route/label paint, fit bounds, and camera transforms. Keep the browser event/SSE/controller orchestration in `render.ts`; both files must remain at or below 500 lines. Do not move semantic visibility or route synthesis into either file.
3. Preserve the existing hierarchy/details/flows DOM and callbacks. SVG targets and tree rows write the same selected representation; details always derives from that selection. Render route overlays and selection/hover/path state from semantic route IDs and existing action-path/playback helpers.
4. Add the authorized semantic navigation state: Enter on an enterable internal system/container advances Context → Containers → Components using the existing level transition authority; Backspace/out returns one level and restores the entered boundary selection. Rebuild semanticView and keep details/tree synchronization on every transition, without changing TUI code.
5. Port the existing camera contract to SVG: first-view fit, cursor-anchored wheel/+/− zoom, drag pan, modified/right-drag orbit, fixed Plan and Iso projections, fit after mode changes, resize, and camera-only movement that leaves semantic geometry unchanged.
6. Keep `src/viewers/web/server.ts` watcher/SSE behavior and `renderPage()` structure intact except for the minimum map/SVG host hooks. On a newer world event, rebuild the SVG scene and overlays while retaining the valid current selection/scope and existing flow/theme behavior.
7. Add focused business-logic tests for SVG scene projection/fit, semantic level entry/out, target-to-selection synchronization, route/path overlay state, and immutable world geometry. Add a browser or DOM-controller smoke check proving the main page mounts SVG (never WebGLRenderer), and extend live-view coverage to prove a newer SSE world rebuilds the in-page scene. Keep existing semantic-view, action-path, flow-playback, details, and server-watch tests as regression coverage; run focused Bun tests and `bunx tsc --noEmit`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audit/corrections: retained the shared semanticView contract and SVG-only browser controller. Rebuilt flow overlays on semantic/world changes so stale SVG dots cannot survive SSE updates; restored Backspace to the entered focus boundary even when the current selection is a campus item; projected route-label bounds once and centered their SVG text; projection/orbit rebuilds reuse the current semantic view without rerunning disclosure/routing; world updates retain existing valid selections and scopes. Added SVG-only bundle/page smoke coverage and focused semantic scene assertions.

Verification: bun test --timeout 20000 test-bun/web-svg-scene.test.ts test-bun/web-live.test.ts (6 pass); focused Web/semantic/action/details/flow suite (38 pass); bunx tsc --noEmit, git diff --check, and browser bundle grep passed. Local browser smoke at an ephemeral localhost server confirmed SVG mount with zero canvas/WebGLRenderer, map/tree/details selection sync, Context → Containers → Components Enter and boundary-preserving Backspace, Plan/Iso/zoom/fit, modified-drag orbit, active flow playback, and an SSE Markdown update rebuilding the in-page SVG scene without console warnings. Full test-bun: 100 pass, 1 known pre-existing dirty-tree failure at test-bun/tui-campus.test.ts:77.

Simplicity review disposition: accepted all three findings. Removed the unused SvgScene.projection field and return value; used each semantic item name directly for SVG aria labels and deleted only the redundant world-name lookup while retaining the world input required by elementOnPath; deleted the duplicate route-ID assertion. No behavior or scope changes beyond the accepted simplifications.

Simplicity recheck: bun test --timeout 20000 test-bun/web-svg-scene.test.ts passed (4); bunx tsc --noEmit and git diff --check passed. Files remain below 500 lines.

Specification review (2026-08-19; blocking invariants; no source changes):

1. selectedId must always correspond to a current semantic selection target. Selecting a deeper hierarchy/details item must move to the semantic scope that visibly represents it; an SSE update retains it only if it remains a target in the existing scope, otherwise it falls back within that scope. Reproduced at localhost:4747: at Context, expanding Groma → View host → Backlog plugin and selecting Backlog plugin left details/tree on observed:backlog-plugin while the SVG had no corresponding representation or selected target. An in-memory generation-2 SSE update changing selected View host from container to component rebuilt the scene but retained observed:view-host in details/tree even though it was absent from the current Context target set.

2. Hierarchy-focused Enter must perform the semantic transition, and Backspace must work outside text-entry controls. Map-focused Context → Containers → Components → Backspace passed; focusing the Groma hierarchy row and pressing Enter stayed at Context because the document key handler returns for button targets.

3. Orbit must reproject without fitting or resetting pan/zoom and without restarting current flow progress; Plan/Iso buttons may fit. Modified-drag orbit was reproduced after pan: the SVG viewBox changed from the panned camera to a recomputed fitted view. The controller path setProjection → rebuildScene(true, false) calls fitCamera and flow.clear during orbit, so active flow playback progress is restarted.

These invariants block acceptance review under AC #2, #3, and #4 and plan items 3, 4, and 6.

Correction pass (2026-08-19): centralized Web semantic selection in pure selectionScope/synchronizeSemanticScope helpers. Hierarchy/details picks now enter the minimum visible scope (Context for system/person/external, Containers for a container, Components for a component); rebuilt worlds retain a selectedId only when it is in semanticView.selectionTargets, then prefer the current focus target or first target. Added semanticKeyAction routing so hierarchy Enter performs semantic enter, unrelated control Enter remains native, and Backspace is handled everywhere except text-entry controls. SvgFlow now signatures projected route geometry and refreshes lanes in place while preserving travelled progress; orbit reprojects without fitting or clearing active playback, while Plan/Iso still fit. Added focused coverage for deep picks, component parent-change synchronization, key routing, and flow lifecycle. Verification: bun test --timeout 20000 test-bun/web-svg-scene.test.ts (7 pass); broader Web/semantic/action/details/flow/navigation/tree suite (54 pass); bunx tsc --noEmit and git diff --check pass. Remaining blocker: test-bun/web-live.test.ts cannot start its requested port 0 in this environment; standalone Bun.serve({ port: 0 }) reproduces EADDRINUSE under Bun 1.3.14, so no server changes were made.

Finalization re-review (2026-08-19): targeted bun test --timeout 20000 test-bun/web-svg-scene.test.ts passed 7/7; the combined Web/semantic/navigation/details/flow suite passed 54/54 across 8 files; bunx tsc --noEmit and git diff --check passed.

Browser smoke on an ephemeral localhost server objectively confirmed SVG mount with zero canvas/WebGLRenderer, map/tree/details synchronization, hierarchy Enter and Backspace boundary navigation, Plan/Iso/fit/zoom, modified-drag orbit, active flow playback, and an SSE Markdown update rebuilding the in-page SVG scene. Focused tests cover deep selection scope synchronization, valid-target retention, and orbit preserving the viewBox/pan/zoom and travelled-flow progress.

Environment note: test-bun/web-live.test.ts fails before assertions because Bun 1.3.14 cannot bind Bun.serve({ port: 0 }); a standalone Bun.serve({ port: 0 }) reproduces EADDRINUSE. This is environment-only and required no source change. AC4 remains supported by pure semantic synchronization evidence and the prior local SSE smoke recorded above.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @luna
created: 2026-08-19 06:57
---
Luna preflight: current Web has no semantic level state or Enter/Backspace behavior; TASK-97.1 acceptance adds this supported behavior. Keep existing tree/details/flow reducers and SSE path. Replace Three picking with SVG selection targets and keep camera/interaction in the browser controller. No browser test currently mounts the main controller, so this slice needs focused SVG state tests.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the production Web map with the shared semantic SVG controller while preserving hierarchy/details selection, Enter/out navigation, camera/projection controls, flow highlighting/playback, and SSE scene rebuilds. Verified with 7 focused SVG tests, 54 combined Web/semantic/navigation/details/flow tests, clean bunx tsc --noEmit and git diff --check, and browser SVG/no-canvas smoke; Bun port-0 web-live failure is an environment-only EADDRINUSE limitation.
<!-- SECTION:FINAL_SUMMARY:END -->
