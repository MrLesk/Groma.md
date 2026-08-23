---
id: TASK-157
title: Keep Backlog updates out of web map layout
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 19:56'
updated_date: '2026-08-23 20:23'
labels: []
dependencies: []
references:
  - web-server
  - backlog-plugin
  - render
modified_files:
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/render.ts
  - test-bun/web-live.test.ts
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - test-bun/web-page.test.ts
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the web viewer, the architecture map loads independently of the Backlog plugin. Backlog may finish later and may emit further work updates, but those updates only change the work overlay and never load, place, route, or move the architecture map.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The web viewer can publish and serve the architecture map before the initial Backlog read completes
- [x] #2 When the initial Backlog snapshot becomes available, connected and newly opened pages show its work overlay without recalculating or replacing the architecture world or sheet
- [x] #3 Later Backlog events update only work data and pins; architecture loading, placement, routing, and camera geometry are not invoked
- [x] #4 Focused concurrent tests prove delayed initial work and later work updates while preserving the same map geometry
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
1. Load and publish the architecture map with an empty work snapshot, then start the Backlog read without delaying the server.
2. Give architecture and work their own server events so a work read updates only the cached work snapshot and pins.
3. Apply work events in the browser by repainting the work island, pins, and task selection without projecting or repainting the map or changing the camera.
4. Add focused concurrent lifecycle tests for a delayed first read and later work changes, then run the relevant web and work checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the independent work stream on main after synchronizing the worktree with origin/main. The server now loads and caches the architecture map first, begins the initial WorkSource read after listening, serializes work updates as their own SSE event and generation, and queues WorkSource reads so a slow result cannot be overtaken. The browser applies a work event through pins, the work island, and task selection only; it does not project or repaint the scene and does not fit or move the camera. Focused concurrent evidence: 22/22 web lifecycle, page, selection, Backlog, and pin tests pass; typecheck passes.

Cold simplicity review passed with no blocking findings. Accepted both reductions: generation counters now live only in the cached payload, publishWork no longer returns an unused promise, and the lifecycle test uses one root fetch instead of two. Post-simplification verification: 22/22 focused tests pass, typecheck passes, git diff --check passes, and the complete suite passes 269/269. Browser QA at http://localhost:4857/ passed: title and meaningful 51-element map rendered, no framework overlay or console warning/error appeared, the Backlog island opened to three active task chips, and the map stayed visually fixed while the overlay expanded.

Exact browser invariant check: with TASK-CAMERA selected, a live Backlog update removed that task. The camera style stayed exactly `translate(580.67px, 293.54px) scale(0.0759)` and the map box stayed 1280×720 at (0,0); task selection and URL cleared and the floating details pane closed. Full-context architecture review confirmed the final split prevents work updates from reaching architecture projection, placement, routing, or camera code. Final verification after the review fix: 32/32 focused tests, typecheck, diff check, and 269/269 full tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web viewer now serves its architecture map before Backlog is ready and treats Backlog as an independent asynchronous overlay. Initial and later work snapshots update only work state, pins, selection, URL state, and floating shell content; they do not reload, replace, project, place, route, fit, or move the map. Focused lifecycle tests and an exact browser camera comparison verify the boundary.
<!-- SECTION:FINAL_SUMMARY:END -->
