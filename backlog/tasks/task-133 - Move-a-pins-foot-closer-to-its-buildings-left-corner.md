---
id: TASK-133
title: Move a pin's foot closer to its building's left corner
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 13:36'
updated_date: '2026-08-23 13:37'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/map.ts
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pin's foot sits 18 world pixels inside the surface's westmost point, which reads as floating away from the corner. Alex wants it closer to the edge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pin's foot sits 10 world pixels east of its surface's westmost point, still inside the surface
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
1. src/viewers/web/iso/map.ts: FOOT_INSET 18 to 10.
2. Browser: the foot equals the roof's westmost point plus 10 times the camera scale and stays inside the roof polygon.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified over this repository's world by projecting every building: all 44 feet sit inside their own roof at the 10 px inset, the closest 4.5 screen px from a roof edge. bun run check green (92 node, 137 bun). No cold simplicity review: the change is one constant, with no code, concept or test to collapse.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A pin's foot sits 10 world pixels east of its surface's westmost point instead of 18, so it hugs the building's left corner while staying on the surface. Verified by projecting every building in this repository's world (no foot outside its roof) and by bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
