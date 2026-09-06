---
id: TASK-212
title: Let building routes choose straight ports
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 12:26'
updated_date: '2026-08-30 14:57'
labels: []
dependencies: []
references:
  - 'observed:coding-agent'
  - 'observed:commands'
  - sheet
  - 'observed:render'
  - 'observed:iso-camera'
  - 'observed:iso-map'
  - 'observed:iso-projection'
  - 'observed:web-server'
  - 'observed:source-viewer'
  - 'observed:web-viewer-details'
  - 'observed:page'
modified_files:
  - src/sheet/route-geometry.ts
  - test-bun/sheet-route.test.ts
  - src/sheet/route.ts
  - src/sheet/route-lanes.ts
type: bug
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the Groma Web map, each building relationship should leave and enter on a valid visible side that lets the route continue straight. Libavoid should choose among equivalent boundary pins from the actual connected buildings instead of Groma forcing one compass side from a coarse direction guess.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 1. Building routes use Libavoid to choose among valid boundary pins, so their first and last route segments continue straight from the building face.
2. Coding agent to Commands naturally leaves Coding agent from the north side; no relationship IDs, product names, or hand-authored coordinates are special-cased.
3. Incoming building sides are not preselected. Outgoing building sides use the same free choice, while existing non-building endpoint behavior remains unchanged.
4. The existing endpoint clearance, distinct-slot capacity, visible-building obstacle avoidance, crossing checks, and shared-lane checks continue to pass.
5. A minimum fixture proves that actual child positions, rather than owner-surface centers, influence the chosen route and that endpoint runs do not contain a staircase.
6. Focused tests, bun run check, and browser inspection of the supported Groma map pass without endpoint artifacts.

- [x] #2 Routes sharing a building side use a non-crossing pin order while preserving the authored relationship direction and straight endpoint runs.
- [x] #3 Routes between facing building sides with overlapping wall spans share a straight coordinate, and safe endpoint doglegs collapse without changing relationship direction or entering a building.
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
1. Represent each building endpoint as equivalent directional boundary pins on its existing Libavoid shape.
2. Let Libavoid choose source and target sides while preserving straight first and last runs; keep fixed-point routing for non-building endpoints.
3. Reorder equivalent pins selected on a shared building side so nested fan-out routes do not cross.
4. Align directly facing building ports when their visible wall spans overlap, and collapse safe endpoint transition doglegs while preserving the original departure and arrival directions.
5. Cover both geometric rules with minimum fixtures, run focused and full checks, and inspect the supplied live routes in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added crossing-free ordering for equivalent pins on a shared building side. Libavoid still chooses each route's side; Groma only permutes that side's already selected slots by turn depth, so relationship direction and straight endpoint runs remain unchanged. The live Render fan dropped from three mutual crossings to zero, and a minimum synthetic fan fixture now covers the rule.

The fan reorder is accepted only when it reduces strict route crossings and still passes the existing building-clearance and shared-lane safety checks. Otherwise Groma restores Libavoid's original geometry. The focused routing suite passed 20 repeated runs (140 tests), the route/scene/map suites passed 39 tests, scoped lint and typecheck passed, and the live Render fan kept the three authored directions with zero mutual crossings. The full repository check still reaches the two unrelated scan-watch failures already present in the shared worktree: empty watch CLI output and EMFILE from filesystem watchers.

Cold simplicity review: removed the duplicate full-route clone and kept only the per-fan snapshot needed for rollback. The review also proposed deleting rollback entirely, but that was rejected because the supported live Groma map had already reproduced a building-entry failure when every fan permutation was applied unconditionally; rollback is therefore required to keep the map renderable. Rechecks after the simplification passed the 39 focused tests, scoped lint, typecheck, and diff validation; the full check again failed only at the same two unrelated scan-watch tests.

Removed the three supplied extra-corner artifacts with two generic rules. Lane refinement now performs a final safe endpoint-dogleg collapse while preserving the original departure and arrival directions. Direct routes between facing building walls now align to a shared coordinate inside the walls' overlap, but only when building, shared-lane, and route-crossing safety do not worsen. Live relationships 43 and 56 became two-point straight routes; relationships 54 and 57 lost their one-cell endpoint staircases. The live 66-route map reports no route artifacts. Twenty repeated focused runs passed 180 tests, the wider sheet/map suites passed 32 tests, and scoped lint, typecheck, diff validation, browser console checks, and the 500-line limit passed. The full check again failed only at the same unrelated scan-watch empty-output and EMFILE failures.

Final cold simplicity review found no blocking issue. Applied its three readability cuts without changing behavior: route stages now run sequentially, the fan key reuses the existing endpoint-direction helper, and endpoint-direction preservation compares the two runs directly. After these cuts, the focused route suite passed 9 tests, the wider sheet suite passed 26 tests, scoped lint, typecheck, diff validation, and source file size limits passed. The full repository check again reached only the same unrelated scan-watch failures: empty watch CLI output and EMFILE from filesystem watchers.

Final review and approval: the user visually approved the live 4848 map. The full-context architecture and junior-safety review found no authority-backed blockers, confirmed that all three acceptance criteria are met, and verified that the rules depend only on generic endpoint and route geometry with no repository-specific element IDs. Final evidence remains 9 focused route tests and 26 route/scene/compose tests passing, scoped lint, typecheck, diff validation, browser artifact inspection, and the live 66-route safety check passing. The repository-wide check is blocked only by the existing unrelated scan-watch empty-output and EMFILE failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Building relationships now let Libavoid choose straight visible boundary pins, reorder shared-side fans without crossings, align safe facing routes, and remove small endpoint doglegs. Verified by the approved live Groma map, 9 focused route tests, 26 wider sheet tests, scoped lint and typecheck, and final architecture/junior-safety review.
<!-- SECTION:FINAL_SUMMARY:END -->
