---
id: TASK-143
title: 'Push arrows off buildings, not just off borders'
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:12'
updated_date: '2026-08-23 16:57'
labels: []
dependencies: []
references:
  - sheet-router
modified_files:
  - src/sheet/route.ts
  - src/sheet/forces.ts
  - test-bun/sheet-route.test.ts
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The clearance field measures distance to surface borders only. Buildings were left out because RING already blocked a foreign footprint plus one lane, which put every walkable lane at or beyond the two-lane reach the field then had, so the building half was provably inert. The reach is now a full cell, so buildings would bite: an arrow passing a person's cylinder currently grazes it at six pixels, because one lane of ring is all that keeps it off. Buildings go back into the field, so an arrow keeps its distance from anything it passes, not only from the edges of surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An arrow that passes a building it does not touch keeps clear of it: measured on this repository's world, the closest a passing arrow comes to a person's cylinder rises from about six pixels to about a cell
- [x] #2 Arrow length and bends are measured before and after and stated
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
1. src/sheet/forces.ts and src/sheet/route.ts: name the combined building-and-surface distance field as clearance throughout.
2. Recompute clearance per relationship from foreign endpoints and surfaces, excluding its source and target; reserve the fixed target suffix so only final route assembly enters that approach.
3. test-bun/sheet-route.test.ts: prove a full-cell passing gap and that endpoint clearance cannot push parallel routes off their facing source side.
4. Re-measure the repository world for passing distance, length, bends and composition time; run focused and isolated full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction history: renamed the old border field as clearance and added building outlines. Review found that including a relationship’s own endpoints let soft clearance compete with endpoint-side selection. Clearance is now measured per relationship from foreign endpoints only. Excluding both endpoints exposed an A* self-retrace through the fixed target suffix, so those suffix nodes are reserved through the existing blocked lattice. No new tuning weight or routing abstraction was added.

Final repository measurements, before → after: Coding agent → Commands distance from Human architect 0.5 → 1 cell; total route length 1163 → 1159 cells; bends 123 → 143; best-of-five sheet composition 286 → 401 ms.

Verification: bun run typecheck passed; focused routing suite passed 17/17 in both the shared tree and an isolated TASK-143 worktree; isolated bun run check passed 92 Node tests and 142 viewer tests; git diff --check passed. The sheet-router architecture document now states the one-cell preferred passing clearance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the route clearance field from surface borders to foreign building outlines, kept route endpoints out of passing clearance, and reserved fixed target approaches from A*. The Coding agent route now passes Human architect at one cell instead of half a cell; final length, bend, timing, focused, and isolated full-suite evidence are recorded above.
<!-- SECTION:FINAL_SUMMARY:END -->
