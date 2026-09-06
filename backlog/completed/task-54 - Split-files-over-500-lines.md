---
id: TASK-54
title: Split files over 500 lines
status: Done
assignee: []
created_date: '2026-08-16 18:34'
updated_date: '2026-08-16 18:39'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - src/viewers/tui/navigation.ts
  - src/typescript-scanner.ts
  - test/architecture-model.test.ts
priority: medium
type: chore
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split every remaining source and test file over 500 lines except src/viewers/web/render.ts. Keep public imports stable where callers already use them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 projection.ts, navigation.ts, typescript-scanner.ts, and architecture-model.test.ts are each under 500 lines.
- [x] #2 src/viewers/web/render.ts is unchanged.
- [x] #3 Existing tests still pass.
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
1. Split projection into camera, routes, and projectWorld.
2. Split navigation spatial movement out of reduceViewer.
3. Split the TypeScript scanner graph from the C4 observation.
4. Split architecture-model tests into happy path and error cases.
5. Re-export public symbols from the original modules.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split projection into camera/routes/projectWorld, navigation spatial movement out, TypeScript scanner into files/graph/observation, architecture-model tests into helpers + happy path + errors. Left web render alone. node tests 53/53, bun test-bun 38/38, tsc clean. No remaining file over 500 lines in the repo (excluding git/node_modules).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split the four non-web files that were over 500 lines. Public imports stay on the original modules. Tests and typecheck pass. Nothing over 500 remains except whatever the web agent owns.
<!-- SECTION:FINAL_SUMMARY:END -->
