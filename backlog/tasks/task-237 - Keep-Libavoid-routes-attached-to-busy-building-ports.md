---
id: TASK-237
title: Keep Libavoid routes attached to busy building ports
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 21:26'
updated_date: '2026-09-01 21:48'
labels: []
dependencies: []
references:
  - sheet-routing
modified_files:
  - src/sheet/route.ts
  - test-bun/sheet-port-matching.test.ts
type: bug
ordinal: 259000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs groma web for the current Groma architecture, the 93-relationship sheet must load instead of failing because Libavoid returns an endpoint that reconciliation cannot match to a target building port. The failure is reproduced at relationship:37, from init-command to scan-lifecycle, when the complete relationship set gives scan-lifecycle 13 connections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The current 93-relationship Groma map routes without a Libavoid building-port matching error
- [x] #2 A minimum fixture reproduces the busy-building endpoint selection and passes after the fix
- [x] #3 Every routed endpoint remains attached to its building boundary
- [x] #4 Existing crossing and shared-path routing safety checks remain satisfied
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
1. Infer the selected building wall from Libavoid's first routed segment, keep the nudged point as the outside guard, and attach the route to the nearest registered port on that wall. 2. Cover the failure with a reduced 17-building, 9-relationship fixture that preserves the endpoint-selection pressure and asserts every result remains on a visible boundary. 3. Verify the current 93-relationship map, focused routing tests, the repository check, and the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced without scanning by loading the current map runtime. relationship:37 succeeds alone and in the first 38 relationships, but fails in the complete 93-relationship set. Its scan-lifecycle target has 13 incident relationships.

Root cause: buildingPorts uses inclusive corner shares under dense load. Libavoid endpoint nudging moves relationship:37 10.347 units beyond scan-lifecycle's visible corner, exceeding the 9.01 matching threshold. The existing busy-hub fixture first reproduces at 20 routes; 19 routes pass.

Inset Libavoid building pins by distributing them at interior wall shares; fixed non-building port allocation is unchanged.

Raised the existing busy-hub fixture to the minimum 20-route reproduction and added endpoint boundary invariants while preserving TASK-235's separate error-message assertion cleanup.

Corner insetting alone did not fix the 20-route fixture. Port reconciliation now derives the selected wall from the route's endpoint direction, keeps Libavoid's nudged point as the outside guard, and attaches to the nearest registered wall pin.

Rejected the 20-route hub as the regression fixture because it also exceeds the existing shared-lane safety limit, which is a separate behavior. Reduced the current failing world to a generic 17-building, 9-relationship fixture: the old reconciliation misses relationship:37's registered north port by 9.472 units (above its 9.01 threshold), while direction-aware reconciliation routes all nine without crossings or shared paths.

Focused verification passes: the reduced regression and existing routing suite report 15 passing tests. The browser runtime now loads the current architecture with 93 relationships and 93 routes; routing completed in 422 ms during verification.

Cold simplicity review found no blocking issue and confirmed the production flow is the simplest scoped change. Accepted its clarity findings by naming the regression after the visible-boundary invariant and documenting why the reduced coordinates are exact.

Implementer specification review: groma web's loadMapRoot entry point produces the approved observable result (93 authored relationships become 93 sheet routes); the reduced fixture proves the original endpoint-pressure case and visible-boundary attachment; routeAll's existing crossing and shared-path safety gate runs before returning. No acceptance-criterion gap found. Implementer quality review: the fix stays inside existing route reconciliation, preserves real wall pins instead of accepting off-wall coordinates, adds no public contract or dependency, and uses a domain-focused regression file under 500 lines. No blocking quality finding found.

Repository verification: bun run check passed after rerunning two transient filesystem-watcher failures. Final result: Biome lint completed with 28 pre-existing complexity warnings, TypeScript passed, 91 Node tests passed, and 212 Bun tests passed.

Full-context complexity review found no blocking issue and recommended keeping the direction-aware reconciliation. It confirmed routing ownership remains grouped in the sheet domain and is difficult to bypass. It noted that an explicit error could replace the nearest-port non-null assertion, but this is non-blocking because buildingPorts already guarantees ports on every wall and no supported failure requires more code.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed groma web routing for busy buildings by mapping Libavoid's nudged endpoint back to the nearest registered port on the wall selected by the route direction, while retaining the nudged point as its guard. Verified the reduced 17-building/9-relationship regression, all endpoint boundary assertions, the current 93-relationship browser payload, 15 focused routing tests, and the full repository check (91 Node and 212 Bun tests). Cold simplicity, implementer specification/quality, and full-context complexity reviews found no blocking issue.
<!-- SECTION:FINAL_SUMMARY:END -->
