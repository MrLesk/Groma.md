---
id: TASK-282
title: Attach Web relationship arrows to clear building edges
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 20:30'
updated_date: '2026-09-05 20:48'
labels: []
dependencies: []
references:
  - sheet-routing
modified_files:
  - src/sheet/route-geometry.ts
  - src/sheet/route.ts
  - test-bun/building-port-attachment.test.ts
type: bug
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the detached and corner-crowded arrow ports shown in the supplied Web map screenshots on Web server, Source viewer, Screen, Scan lifecycle and World loader. Relationship ends should meet the visible building edge with a clear approach while preserving architecture meaning and the existing route model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Arrow endpoints meet the visible building boundary without the gaps shown in the supplied screenshots, including stepped towers.
- [x] #2 Busy building ports stay inside usable edge spans rather than collapsing onto corners, and their final approach remains clear.
- [x] #3 Architecture identity, relationship direction and world geometry remain unchanged by Web selection and projection; focused regression coverage and the repository check pass.
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
Keep additional ports within the original three-port edge span. Preserve the tangential coordinate chosen by Libavoid when attaching a route to its selected wall, removing the nearest-pin snap and its tiny wall-following legs. Leave Web projection and architecture data unchanged. Verify with three minimal geometry regressions, all five reported buildings in the browser, bun run check, own specification/quality review, and the requested full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced detached incoming ends on Web server and Scan lifecycle plus a tiny wall-following target leg on Screen. A fixed larger edge inset changed low-degree routing; replaced it with subdivision of the existing three-port span, preserving ordinary routes. The nearest-pin snap discarded Libavoid nudges and created short sideways end legs; preserving that coordinate removes them. Three new focused tests all fail against the respective previous behavior and pass with the fix. Existing routing/projection suites passed. First full check passed lint and typechecking, then failed only the sandboxed Node watch test with EMFILE; rerunning outside the sandbox.

Verified all five reported buildings in the browser: Web server and Scan lifecycle arrows touch their visible edges; Source viewer has separate incoming tips; Screen has a direct wall approach; World loader tips stay clear of corners. Three regression tests cover port subdivision, stepped-tower projection and immutability, and nudged route attachment; all failed against the previous behavior. Own specification and quality reviews found no blocking findings. The full-context complexity reviewer recommended keeping the two-operation correction and existing domain ownership; applied its advisory rename to buildingWallPort and a comment explaining the router shift. No public contract or documentation change is needed for this rendering defect repair. An earlier complete run timed out in the existing Web Markdown live-update test; that test passed alone, and subsequent full checks passed. Final reviewed code: bun run check passed, with 102 Node tests and 286 Bun tests; six existing lint warnings. Changed source files remain below 500 lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed detached and corner-crowded relationship arrows by keeping busy ports within the existing usable edge span and attaching routed endpoints directly to the selected wall. Verified all five reported buildings in the browser, three regression tests, the full repository check, and specification, quality and full-context complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
