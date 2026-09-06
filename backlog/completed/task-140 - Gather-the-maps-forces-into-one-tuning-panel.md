---
id: TASK-140
title: Gather the map's forces into one tuning panel
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 15:42'
updated_date: '2026-08-23 17:53'
labels: []
dependencies: []
references:
  - sheet
  - sheet-router
modified_files:
  - src/sheet/forces.ts
  - src/sheet/grid.ts
  - src/sheet/pack.ts
  - src/sheet/place.ts
  - src/sheet/route.ts
  - test-bun/sheet-grow.test.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/sheet-route.test.ts
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The weights that shape the map are scattered: building spacing and the roof corridor in grid.ts, the placement costs in pack.ts, the routing costs and the two repulsion fields in route.ts. Alex tunes these by eye, so they belong in one file, each named for what it does and documented with what raising it buys and what it costs. Geometry that is not a matter of taste, such as the lanes in a cell or the half cell a floor hides, stays where it is. The border push and the route push, which currently share one pair of constants because their values match, become two pairs so they can be tuned apart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every taste weight for building spacing, building arrangement and arrow routing lives in one module, each with a comment saying what it does and what more of it costs
- [x] #2 The border push and the route push are separate weights
- [x] #3 The sheet is unchanged: the same world gives byte-identical buildings and routes before and after
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
1. src/sheet/forces.ts: every taste weight for building spacing, building arrangement and arrow routing, in three sections, each with what it does and what more of it costs.
2. grid.ts, pack.ts, place.ts, route.ts and the three tests import from it; geometry (LANES, PAD, ROOF_SHADOW, MARGIN, EMPTY) stays in grid.ts.
3. The border push and the route push become two pairs, bound once each in route.ts, so they can be tuned apart.
4. Prove the sheet is unchanged by composing this repository's world before and after.

5. Restore the tuning boundary after later sheet work: move nested-content padding and the near-target bend cost into forces.ts without changing their values; verify byte-identical output and focused sheet tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Composing this repository's world gives a byte-identical scene before and after, verified against a snapshot taken before the move (44 buildings, 55 routes, 96x84, 95 bends, 1079.5 cells); validated in a worktree of HEAD plus only this task's files, 92 node and 139 bun. Review applied: grid.ts still declared ISLAND_GAP alongside the panel's, a dead duplicate, now removed; each pair of field weights is bound once in route.ts as offBorder and offRoutes, so the reach and the push cannot drift apart at the call sites, and the sweep's bound is named limit rather than shadowing the heuristic's reach; the section headings now name their units, cells for arrangement and lanes for routing; the entries that lacked a cost clause have one; RING is marked as a clearance rather than a cost, since raising it can leave a world unroutable rather than merely costlier. Not done, and left as a follow-up: docs/scanners/typescript/expected.txt, the scanner's approved example, gains a Forces and a Grid component from this change, but another agent has that same file modified in the shared tree, so regenerating it here would either drop their work or import it into this commit; one regeneration after both land will settle it.

Final architecture review found later drift after commit 95a3141: TASK-145 placed visual nested-content padding in grid.ts, and TASK-147 left the near-target bend cost inline in route.ts. Both are tuning choices, while grid.ts should contain only fixed lattice/projection geometry. Reopen the tuning boundary only; preserve behavior exactly.

Boundary repair complete: NESTED_CONTENT_PAD remains 2 but now belongs to forces.ts; the former near-target turn cost BEND * (1 + LANES), 6 * (1 + 4), is the named FINAL_BEND = 30 in forces.ts. This is exact behavior equivalence. Verification: 40 focused sheet tests pass with 0 failures and bunx tsc --noEmit is clean. Cold simplicity review and targeted architecture re-review found no remaining blocker, no removable indirection, and confirmed the forces.ts/grid.ts boundary is domain-grouped and junior-safe.

Commit-scope verification: applied only the staged TASK-140 patch to a detached worktree at 29ea5e7; all 40 focused sheet tests passed and bunx tsc --noEmit was clean. This proves the commit excludes and does not depend on the concurrent actor-vocabulary changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Centralized the sheet's visual spacing, arrangement, and routing choices in forces.ts, including later nested-padding and final-bend additions, while grid.ts retains fixed geometry. Values and rendered behavior remain unchanged; verified by the original byte-identical scene comparison, 40 current focused sheet tests, clean TypeScript, cold simplicity review, and targeted architecture re-review.
<!-- SECTION:FINAL_SUMMARY:END -->
