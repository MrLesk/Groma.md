---
id: TASK-409
title: Fit map surfaces and repair projected relationship arrows
status: Done
assignee:
  - '@codex'
created_date: '2026-09-16 19:35'
updated_date: '2026-09-16 20:26'
labels: []
dependencies: []
references:
  - scene
  - iso-project
  - map
  - presentation
  - relationships
modified_files:
  - src/sheet/place.ts
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/style.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/presentation.ts
  - src/sheet/route-grid.ts
  - src/sheet/route-search.ts
  - src/sheet/route.ts
  - test-bun/route-crossings.test.ts
  - test-bun/web-map-presentation.test.ts
type: bug
ordinal: 455000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web map shows oversized actor and external-system islands, unreadable project overview text, detached arrow endpoints in 2D, and crowded arrowheads on busy relationships. Reported while viewing callforpapers; fixes belong to shared presentation behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Actor and external-system islands fit their content and label without forced square sides.
- [x] #2 Project title and overview use readable sizes consistent with map labels at 700% zoom.
- [x] #3 Relationship endpoints meet the visible buildings in both 2D and isometric views.
- [x] #4 Busy relationships have clearer arrow presentation without removing relationships or changing their meaning.
- [x] #5 Focused layout and projection checks and bun run check pass.
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
1. Fit actor and external islands to independent content width/depth; enlarge the project title and overview.
2. Attach projected arrows to visible building faces and settle back-wall endpoints through their existing bends in 2D.
3. Preserve the initial complete routing pass, then improve each route once with crossing, bend, and distance costs while the other paths retain their occupied lanes. Restore normal route opacity.
4. Verify real crossing reduction on Call for Papers, minimal geometry regressions, deterministic paths, world immutability, dense ports, and browser close-ups.
5. Complete cold simplicity review, implementer specification/quality reviews, final full-context complexity review, documentation and bun run check.

6. Reproduce and remove the reported local arrow hairpin; verify the visible route and add a minimal geometry regression.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: focused layout/projection tests passed. Final bun run check passed: Node 21 tests and Bun 352 passed, 17 skipped, 0 failures. Existing unrelated lint warnings remain; changed functions introduce no complexity warnings. The first full run could not use FSEvents or local listening ports in the sandbox; the successful run used the required local test APIs.
Browser verification used the current renderer with scan disabled against ../callforpapers: actor/external islands fit narrow columns; title and overview inspected at 745%; selected Proposal submission inspected in 2D with the formerly detached actor arrow touching the building. The visual check exposed a perpendicular roof-shadow offset on tall buildings; flattening now joins each back-wall port to its settled position with short orthogonal segments, preserving original route bodies and model data. Regression cases cover round, pill and tall block endpoints in both poses.
Specification and quality review: all four requested presentation changes are covered; no stored OKF/C4 meaning changes, scanner changes or project-specific rules. Neutral routes remain selectable, selected/task/flow routes retain full emphasis. Route crossings are not eliminated; visual clutter is reduced through neutral contrast. Existing world immutability and pose-transition tests pass. Documentation updated. No blocking findings.

Correction: the final Node runner reported 16 passed tests, not 21; the Bun totals above are correct. Final diff whitespace check passed, and changed source/test files remain below 500 lines.

Reopened after user review: dimming routes did not address the requested geometric routing problem. Restore normal visibility and reduce actual crossings and crowded route bends in the reported flow.

Actual routing correction: normal neutral opacity restored. The initial valid routing pass is followed by one crossing-aware improvement pass with occupied lanes fixed for every other route. Replaced paths must have lower combined crossing, bend and distance cost. On unchanged Call for Papers placement and 124 relationships, crossing pairs fall from 990 to 599; bends 499 to 525; total route length 21182 to 22644 cells. Speaker campaigns/profiles incident-route crossing counts fall from 143 to 80. The minimal diagonal-pair regression crossed with the old router and has no crossing with the new router. Dense system/container port regression remains passing. Flattened ports now move their existing adjacent bends instead of adding small endpoint staircases.

Cold simplicity review completed with no routing blocker. Applied its three simplifications: first pass only stores raw paths, route ordering is computed once, and flattened route arrays use a shallow copy because endpoint points are replaced rather than mutated. The obsolete dimming documentation was removed. Focused recheck after simplification: 45 passed. Implementer specification review confirms the four requested outcomes, with item 4 now based on geometric crossing reduction rather than opacity. Quality review: route identities/directions, original world immutability, distinct occupied lanes, clear ports, and deterministic output are preserved; no new dependency or architecture concept. The final close-up confirms existing 2D endpoint bends replace the previously added staircases. Full check before these behavior-preserving simplifications passed 16 Node tests and 354 Bun tests (17 skipped).

Final post-simplification bun run check passed: 16 Node tests; 354 Bun tests passed, 17 skipped, zero failures. git diff --check passed. Additional read-only comparison of the rendered 2D geometry (using identical projection for the saved before/after scenes) confirms crossing pairs 983 to 601. The shared-sheet metric remains 990 to 599. Measured scene load/routing in this local diagnostic grew from about 0.2 s to 4.9 s because of the additional routing pass; camera movement does not reroute. Remaining crossings are not claimed to be eliminated.

Final full-context complexity review passed with no blocker or further material simplification. It confirmed layout/presentation ownership and the need to report the measured layout-time tradeoff and remaining crossings. No new architecture model or stored knowledge was introduced.

User screenshot exposed a 2D hairpin on the Speaker-to-Speaker profiles relationship. Root cause: moving a back-wall port past its nearest short bend reversed that bend while keeping the preceding staircase. flattenRouteEnd now consumes overtaken bends before connecting the settled port. It preserves straight-route midpoint handling, original sheet data, and route identities. Four minimal regressions cover west/north ports at source/target and partial/full flattening, asserting that path length has no backward travel. Focused tests: 32 passed. Full bun run check: 16 Node tests; 358 Bun passed, 17 skipped, zero failures. Browser reloaded from the current renderer; the reported loop is visibly gone beside Speaker profiles in 2D. Targeted specification and quality review found no blocker; this correction changes only endpoint presentation. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fits actor/external islands to content, enlarges project text, and attaches arrows to visible geometry. Crossing-aware routing retains normal opacity and all relationships. Corrected the reported 2D hairpin by consuming bends overtaken by the settling endpoint. Verified the reported Speaker profiles close-up, four directional regressions, and bun run check (16 Node; 358 Bun passed, 17 skipped). Some crossings remain; initial route generation measured about five seconds locally.
<!-- SECTION:FINAL_SUMMARY:END -->
