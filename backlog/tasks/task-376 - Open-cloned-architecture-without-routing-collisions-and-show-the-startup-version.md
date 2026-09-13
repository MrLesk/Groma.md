---
id: TASK-376
title: >-
  Open cloned architecture without routing collisions and show the startup
  version
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 16:44'
updated_date: '2026-09-13 16:49'
labels: []
dependencies: []
references:
  - sheet-routing
  - web-server
modified_files:
  - src/sheet/route-grid.ts
  - test-bun/sheet-route.test.ts
  - src/viewers/web/startup/page.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 422000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running Groma 0.3.0 on a Windows clone of the Groma repository opens the web startup error screen with Routes share a fixed port exit. The screen also omits the running Groma version, making the report harder to identify.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The reproduced fixed-port routing collision is resolved without dropping architecture relationships or allowing shared route exits.
- [x] #2 The web startup screen displays the running Groma version during setup, loading, and errors.
- [x] #3 A minimal regression test covers the routing failure and the full repository check passes.
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
1. Reproduce the reported startup failure and reduce it to a minimal routing regression. 2. Reserve only the nearest outward grid track for each fixed port so nearby exits remain distinct. Preserve route safety checks and architecture data. 3. Show package version in the shared startup header. 4. Verify routing tests, the cloned architecture map, browser startup states, and bun run check; perform specification and quality self-reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the same error on macOS from the current saved architecture. The south-facing exit of one actor and north-facing exit of a nearby actor have guards 12 units apart, but each reserves a 9-unit run. The shared grid already contains closer turning tracks. This is a presentation defect owned by sheet-routing, with no change to OKF documents or C4 element/relationship meaning.

Validation: the four-building/two-relationship regression throws Routes share a fixed port exit with the previous route-grid implementation and passes with the fix. Existing routing checks passed. bun run check passed: 16 Node tests, 291 Bun tests, six optional native tests skipped; log /tmp/groma-task-376-check.log. Manual current-architecture load and fresh local Git clone startup (scan enabled, no scanner cache) returned ready 204, page 200, and all 116 relationships represented by 116 routes. Browser inspection confirmed a rendered map and the package version in setup, loading and error states. The original failure also reproduced on macOS; Windows execution has not been independently tested. Specification and quality self-reviews passed: existing route safety remains enforced, no architecture data or relationships change, nearest-track reservation removes the redundant exit map, and the shared header uses the same package version source as the CLI. This is a bounded layout fix; no new public contract or storage behavior. No release was published.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed overlapping port-exit reservations that prevented saved architecture from opening. Each port reserves its nearest outward grid track, preserving route separation and obstacle checks. Added the running package version to the shared web startup header. Verified the failure before the fix, minimal regression, fresh-clone startup with all 116 routes, browser startup states and the full repository check. Windows runtime verification and release publication were not performed.
<!-- SECTION:FINAL_SUMMARY:END -->
