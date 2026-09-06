---
id: TASK-102
title: Replace the web map with an isometric SVG blueprint
status: Done
assignee:
  - claude
created_date: '2026-08-21 22:52'
updated_date: '2026-08-21 23:43'
labels: []
dependencies: []
references:
  - web-viewer
  - render
  - page
  - sheet
  - sheet-router
  - iso-projection
  - iso-map
  - iso-camera
priority: high
type: feature
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma web shows the merged world as an isometric technical blueprint: a grid field, flat islands on whole cells for people, external systems, each internal system and each group, low container slabs, buildings for components, people and external systems with height and shape driven by observed code, names lying isometrically on roofs and surfaces, and one quarter-cell lattice route per authored relationship that lights up for a picked flow. Core composes the sheet; the browser only projects, paints, zooms, pans and selects. Replaces the Three.js city and the semantic-zoom SVG map; no plan view, orbit, playback or fit switch. The observed architecture Markdown is refreshed by hand so the map represents Groma well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every island, slab and building footprint is a whole-cell rectangle on the sheet and siblings never overlap
- [x] #2 Every authored relationship is one lattice route that touches both endpoints, enters buildings and slabs on a front side and crosses no foreign building
- [x] #3 The web map draws the sheet as crisp SVG: flat islands, low slabs, buildings with code-driven height and shape, isometric names on roofs and surfaces
- [x] #4 Wheel zoom about the cursor, drag pan and the footer zoom buttons work; selection, hover, lit flows and Dark/Light stay in sync with the panes
- [x] #5 World updates over SSE rebuild the map without a refresh and keep a surviving selection
- [x] #6 three and @types/three are removed and render.js contains no layout, routing or semantic-city code
- [x] #7 docs/viewers and groma/observed describe the sheet boundary and the refreshed architecture; bun run check passes
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
1. Worktree at fb7a39a, green baseline. 2. Core sheet modules (types, grid, measure, pack, place, route, scene) with fixture tests. 3. Server ships { generation, world, sheet }; campus routes removed. 4. iso painter, camera, text and theme variables with tests. 5. render.ts rewired without semantic scope or playback; Plan/Iso/Fit and playback controls removed. 6. Delete Three.js, old SVG scene, campus and flow files; drop three from package.json. 7. Docs and groma/observed refresh. 8. bun run check, browser verification, simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core sheet (src/sheet) composes islands, slabs, buildings with name-sized footprints and code-driven floors, zones, and A* lattice routes; iso painter (src/viewers/web/iso) projects it 2:1 with names lying on roofs and front bands; render.ts rewired without semantic scope or playback; server ships { generation, world, sheet } with idleTimeout 0 (the default 10 s cut the SSE stream every ten seconds on the base code). Deleted Three.js, old SVG scene, campus, flow files and their tests; three removed from package.json. Docs and groma/observed refreshed by hand (create, edit, plain-world moved under cli; sheet, sheet-router, semantic-view, semantic-city, architecture-watch added to core; iso-projection, iso-map, iso-camera added to web-viewer; scene removed). bun run check: 92 node + 110 bun tests pass. Follow-ups noted, not done: scripts/validate-architecture.ts rejects technology frontmatter and container code that the model accepts and the base tree already used; docs/scanners/typescript/{expected,observation}.txt still list the deleted scene.ts (scanner work deferred); an invalid Markdown edit while groma web runs stops the server (pre-existing, no guard).

Cold simplicity review (no blocking findings) applied: dropped the unused projected ids set, the duplicated route request shape (routeAll now takes the world relationships directly), the redundant re-select after paint, the placeholder pass in the zone fold, unused grid helpers and router constants moved next to the router, single-use exports made private, unread route attributes, tautological test lines, and the compareElements re-export (TUI navigation imports src/element-order.ts directly); the packed numeric heap key became a plain comparator heap (live world: 86x78 cells, 43 routes, about 200 ms per sheet). Kept SheetItem.id and Zone.members as part of the scene meaning. bun run check after the changes: 92 node + 110 bun tests pass. Task references now name the live element ids: web-viewer, render, page, sheet, sheet-router, iso-projection, iso-map, iso-camera.

Browser verification (Browser pane against the worktree server on :4748, plus the specification review on :4750): fit view renders 3 islands, 6 slabs, 38 buildings, 43 routes, 5 zones with names lying on roofs and front bands; + key x5 → 305% readout, x8 → 596%, text crisp at every zoom; wheel zoom keeps the world point under the cursor (drift 0.01 px); drag pans by the pointer delta with zoom and selection unchanged; clicking Accept marks the building (accent roof and text), its 4 endpoint routes and the details pane; picking Runs a scan lights 6 routes with the moving dash, dims the rest (9 on-path items), footer captions it, x clears; Dark swaps map and chrome and keeps the accent; editing groma/observed/systems/git/system.md while the server runs pushes generation 2 (then 4) over SSE, the page repaints in place, the selection (Accept) and the camera survive; the SSE stream stays open past Bun default 10 s idle timeout. OpenClaw fixture on :4749: operator island, six empty 4x4 slabs in a 3x2 shelf, three external buildings, 13 routes. Specification review: AC 1-7 proven, no blocking code finding; follow-ups unchanged.

Cold quality review: no blocking finding; applied five of its observations: the server now keeps one generation counter bumped after each load (two overlapping publishes or a page reload could previously reuse a number and make browsers drop an update); islands, slabs and zones are at least as wide as their own name in the front band; a building is deep enough for every roof line on its top tier (stack tiers inset the roof); routes keep three lanes behind a foreign slab back edge so a ground route never shows through the raised deck; the clearance test now sweeps every lane node of a route and the arrow test asserts a lattice direction instead of restating the formula. Left as follow-ups (outside the supported flow or not visible in any world): a route whose last leg is a riser (component to its own container) points its arrow straight up; a self-relationship would yield a one-point route; lane sharing is a cost, not a ban. bun run check after the fixes: 92 node + 111 bun tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the web map with an isometric SVG blueprint built from scratch. Core composes a grid-snapped sheet (src/sheet: islands for people, external systems and each internal system, container slabs, buildings sized for their names and raised by observed code, group zones, and A* lattice routes with half-cell ports, one-lane clearance, front-side arrival and deck risers); the server ships { generation, world, sheet }; the browser only projects it 2:1 isometric, paints SVG with names lying on roofs and front bands, and handles wheel zoom about the cursor, drag pan, the footer zoom buttons, selection, hover, lit flows, Dark/Light and SSE updates. Three.js, the semantic-zoom SVG scene, the campus endpoints and flow playback are deleted; three is gone from package.json. Docs and groma/observed were refreshed by hand (cli components create/edit/plain-world, core components sheet, sheet-router, semantic-view, semantic-city, architecture-watch, web-viewer components iso-projection, iso-map, iso-camera). Verified with bun run check (92 node + 111 bun tests), fixture-based tests for footprints, routes, projection, camera and the bundle, and the Browser pane against the live world and the OpenClaw fixture (fit, zoom, pan, selection, flow, dark theme, SSE generation 2 and 4 with the selection kept). Cold simplicity, specification and quality reviews found no blocking issue; their non-blocking items were applied or recorded as follow-ups in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
