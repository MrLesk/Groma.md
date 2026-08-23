---
id: TASK-139
title: Attach person routes to the cylinder edge
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 14:24'
updated_date: '2026-08-23 16:35'
labels: []
dependencies: []
references:
  - iso-projection
modified_files:
  - src/viewers/web/iso/project.ts
  - test-bun/iso-map.test.ts
type: bug
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the web viewer, routes leaving a person still attach to the old square footprint. On the Human Architect cylinder, off-centre routes therefore start in empty ground instead of at the curved wall. The web map should show each outgoing route meeting the cylinder circumference, matching the visible round shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the repository's web map, every route leaving Human Architect starts at the visible cylinder wall instead of the old square footprint edge
- [x] #2 Multiple outgoing routes remain distinct and keep their routed direction after their visible start is attached to the curve
- [x] #3 Focused projection tests cover off-centre departures from a person cylinder, and browser QA confirms the Human Architect result
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
1. src/viewers/web/iso/project.ts: derive the circle/stadium geometry once and reuse it for both the painted outline and the point where any curved route endpoint meets the visible wall; leave the sheet route unchanged.
2. test-bun/iso-map.test.ts: replace the broad repository-fixture assertion with a minimal projected scene that proves off-centre departures and arrivals meet the shared visible outline without changing their routed direction.
3. Browser: confirm every Human architect route starts at the cylinder wall and curved endpoints remain distinct.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction history: replaced duplicate curved roof/endpoint dimensions with one local stadium geometry used by both painting and route attachment. Applied the visible-wall rule symmetrically to source and target endpoints of every curved building while leaving sheet routes unchanged. Final quality review identified that the focused test proved direction signs but not a fixed axis; the test now compares each drawn segment with its original routed direction across all four sides, including roof-shadow anchors.

Verification: bun run typecheck passed. bun test test-bun/iso-map.test.ts passed 11/11. Browser QA at http://localhost:4747 confirmed all visible Human architect routes meet the cylinder at distinct points and keep their routed directions; browser console had no warnings or errors. git diff --check passed. No public contract or documentation changed because this is internal web projection behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Attached curved route endpoints to the same circle/stadium geometry used to paint their buildings, preserving the routed axis and distinct ports. Verified with type checking, 11 projection tests, browser inspection of Human architect, and clean console/diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
