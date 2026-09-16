---
id: TASK-243
title: Route the current Groma map without shared paths
status: Done
assignee:
  - '@codex'
created_date: '2026-09-03 18:40'
updated_date: '2026-09-03 19:24'
labels:
  - sheet
  - web
dependencies: []
references:
  - sheet-routing
modified_files:
  - test-bun/sheet-shared-transition.test.ts
  - src/sheet/route-lanes.ts
  - src/sheet/route-geometry.ts
priority: high
type: bug
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs `groma web` in the current shared main workspace, Groma must load the map instead of failing the shared-route safety invariant. The supported result keeps every authored route, has no crossings or shared path bodies, and preserves attachment to visible endpoint boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma web` starts successfully for the current Groma architecture instead of reporting shared route length 3496.44
- [x] #2 The routed current architecture has zero crossings and zero shared path body length without weakening or bypassing the safety check
- [x] #3 A minimum routing fixture reproduces the failure and passes after the fix
- [x] #4 Focused routing tests and the complete repository check pass
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
1. Cover a constrained building corridor and a reduced four-route shared highway with generic routing fixtures.
2. Let the lane refiner separate a long segment that spans both endpoint transitions, preserving the endpoint side that the conflict group shares.
3. Treat an existing shared route body as a pre-existing route conflict when checking whether separation introduces a new proper intersection; continue rejecting crossings with unrelated routes.
4. Keep the final building-crossing and shared-path safety gate unchanged, then verify the scanned web entry point, focused routing tests, the complete repository check, and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced `groma web` before and after its scan. The initial 92-relationship map failed with `crossings=` empty and `sharedPathLength=3496.44`; after the first transition repair, the reduced remaining highways shared 2376.96 units.

The lane refiner excluded a long middle run when that run represented both endpoint transitions. Once included, separating it could turn an already-overlapping route pair into a proper intersection, but the before/after guard treated that as a newly introduced conflict. The final implementation preserves both endpoint stubs when needed, recognizes a shared endpoint independent of relationship direction, and lets the crossing guard distinguish an existing shared-path conflict from a genuinely new crossing. The final safety gate is unchanged.

Focused verification: 17 routing tests pass, including the reduced constrained corridor, the reduced four-route shared highway, unrelated-crossing protection, endpoint attachment, orthogonality, artifacts, and fixture-wide no-shared-path checks. The scanned `groma web --port 43991` command starts and `/` returns HTTP 200.

Final verification: bun run check passed outside the sandbox with 106 Node tests and 266 Bun tests. The sandbox suppresses macOS recursive file-watch events; an isolated native watcher probe reproduced that environment limit, and the affected live-reload test passed in 279 ms outside it. The cold simplicity review found no simplification. The implementer specification and quality reviews found the acceptance criteria satisfied, task ownership clear, and both changed source files below 500 lines. The full-context complexity review found no architecture change necessary and recommended clarifying the crossing guard contract; that comment was updated and all 17 focused routing tests passed again.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the shared-route lane refiner handle long two-ended transitions and classify an existing shared body as a prior pair conflict. The unchanged final safety gate now accepts the current zero-shared-path map. Verified with the real groma web entry point (HTTP 200), 17 focused routing tests, and the complete 106 Node / 266 Bun repository suite.
<!-- SECTION:FINAL_SUMMARY:END -->
