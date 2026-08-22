---
id: TASK-113
title: Size buildings by the project's range of code lines
status: Done
assignee:
  - '@claude'
created_date: '2026-08-22 22:33'
updated_date: '2026-08-22 22:37'
labels: []
dependencies: []
references:
  - sheet
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Buildings barely differ in height today: every 150 observed lines add half a floor up to three, so most components stand at one or two floors. Alex wants sizes rebased on the project's own range: the component with the most observed code lines is the tallest building, the one with the fewest the smallest, and everything else stands in between by its share, so differences show even when the range is narrow. Footprints keep following names; ghosts, people and external systems stay one floor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The observed component with the most code lines stands four floors and the one with the fewest one floor; every other stands in between in half floors by its share of that range
- [x] #2 When every observed component has the same line count, all stand one floor
- [x] #3 Ghosts, people and external systems stay one floor
- [x] #4 The web viewer doc describes the range rule
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
1. src/sheet/measure.ts: floorsOf(origin, lines, range) maps an observed component's lines onto 1..4 floors in half steps by its share of the project's range (all one floor when the range is empty); ghosts and non-components stay one floor.
2. src/sheet/place.ts: placeWorld computes the range over observed components' codeLines once and passes it to every building.
3. test-bun/sheet-scene.test.ts: the measurement test asserts the range rule (most lines four floors, fewest one, in between by share; equal counts all one; planned ghost one).
4. docs/viewers/web/index.md: replace the 150-lines rule with the range rule.
5. Browser: the tallest observed component shows four floors on http://localhost:4747.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
floorsOf(origin, lines, range) in src/sheet/measure.ts maps an observed component's share of the project's line range onto 1..4 floors in half steps; placeWorld computes the range once. Simplicity review applied: range type inlined in the signature, comments tightened, redundant assertion dropped, doc paragraph rewrapped. Evidence: bun run check green (92 node + 131 bun); live world range 41..458 lines gives a 1..4 floor spread across seven steps (navigation 458 lines four floors, sheet 41 lines one floor); in the browser the left face of navigation spans 48 px of height and sheet 12 px, so four floors against one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Building height now follows the project's own range of observed code lines: the component with the most lines stands four floors, the fewest one, the rest in half floors by their share; ghosts, people and externals stay one floor. Verified by the measurement unit test, the full check and the live map's face heights.
<!-- SECTION:FINAL_SUMMARY:END -->
