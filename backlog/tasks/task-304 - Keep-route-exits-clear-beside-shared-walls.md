---
id: TASK-304
title: Keep route exits clear beside shared walls
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 14:43'
updated_date: '2026-09-06 14:51'
labels: []
dependencies: []
references:
  - sheet-routing
modified_files:
  - src/sheet/route-grid.ts
  - test-bun/sheet-route.test.ts
type: bug
ordinal: 342000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer opening the current web map must not lose the map because an earlier route traps another connection beside a shared wall. Reserve the short outward lane from each fixed port before routing paths, while preserving all relationships, building clearance, distinct paths, and existing attachment behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The reproduced shared-wall exit trap routes every connection without overlapping paths or crossing buildings.
- [x] #2 A minimal regression test fails without the reservation and passes with it; existing routing invariants and bun run check pass.
- [x] #3 The current Groma map opens and renders all its relationships after the fix.
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
Reserve each fixed port through the nearest existing outward turning track before searching any route. Keep the longer fan tracks available without reserving unused space along them. Preserve port selection, route finishing, architecture meaning, and rendering. Verify the narrow shared-wall regression, existing routing invariants, current-world composition, the browser, and bun run check; finish implementer specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause reproduced on the current 83-element, 113-relationship world: Human architect → Commands occupied both free edges beside the Human architect → Screen exit. The latter port could reach only two grid nodes; clearing previously used edges restored a route. The reservation now includes the guard-to-nearest-turning-track lane before any search. A first trial reserved longer per-port fan tracks and caused a busy parallel connection to detour; reducing the protected segment to the nearest track restores that existing test while retaining every turning track.

Added a minimal three-building, two-connection shared-wall regression. The exact test against the prior route grid fails with Could not route relationship route:1; the fixed grid passes with both routes, no building crossings and no shared path. All existing focused routing tests pass. Final bun run check passes 106 Node and 330 Bun tests (436 total), with six unchanged complexity warnings. The first sandboxed run could not start the existing FSEvents watcher test; the complete check passed with normal macOS watch access. git diff --check passes; changed source/test files are 131/362 lines.

Restarted this thread’s preview on port 4773 using the real web server and current architecture. /ready returns 204 and /world.json returns 200 with all 113 relationships and 113 routes. A fresh browser tab opens the Architecture map at http://localhost:4773/?system=groma&hud=off. Implementer specification and quality reviews found no unmet criterion or supported-flow defect. This is a bounded route-reservation correction owned by sheet-routing; OKF records, C4 relationships, Markdown meaning, and renderer contracts are unchanged. Existing web documentation remains accurate; source comments explain the exit rule. The rule depends only on wall geometry and connection count, not project names, programming languages, or current file names.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Protected each port through its nearest outward turning track so an earlier route cannot trap its exit. A minimal shared-wall regression fails on the old code and passes with the fix. All 436 repository tests pass, and the restarted current-map preview opens with all 113 routes.
<!-- SECTION:FINAL_SUMMARY:END -->
