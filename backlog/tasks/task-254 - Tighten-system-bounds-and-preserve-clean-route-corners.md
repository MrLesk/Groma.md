---
id: TASK-254
title: Tighten system bounds and preserve clean route corners
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-05 16:45'
updated_date: '2026-09-05 16:54'
labels: []
dependencies: []
references:
  - sheet-composition
  - sheet-routing
modified_files:
  - src/sheet/compose.ts
  - src/sheet/route-lanes.ts
  - test-bun/sheet-compose.test.ts
  - test-bun/sheet-shared-transition.test.ts
type: bug
ordinal: 293000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens the web map, system islands fit their final container placement and nearby relationship routes remain separated without unnecessary short corner steps. Fix the northern empty band and line artifacts shown in the supplied screenshots. Preserve architecture meaning, container subtrees, route endpoints and obstacle clearance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Final system bounds keep the intended inset around occupied container bounds instead of retaining the old northern empty band
- [x] #2 Lane separation preserves clean route corners without the reproduced short backward steps
- [x] #3 Routes remain attached and avoid buildings and shared paths; layout remains deterministic and does not mutate the world
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Tighten composed system bounds around final subtrees and rebuild sheet bounds. 2. Separate route body lanes by moving existing corners while retaining endpoint guards. 3. Add focused regression checks, inspect the current projected map, and run bun run check. 4. Perform own specification and quality review, then full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Final placement now determines system bounds and sheet extents, retaining a two-cell inset. Route spacing first moves free interior corners and keeps the existing guarded-transition option when a constrained corridor requires it. Removing that option failed the existing constrained-corridor case, so it is preserved. Focused routing and placement checks pass; before/after browser previews using the real SVG painter confirm the northern band and stepped corners are removed. The first full check passed lint but stopped on incomplete flow API changes from concurrent TASK-253, outside this task.

Specification review: final island inset and tight sheet bounds are covered by the new placement regression; free route bends retain two corners, fixed endpoints, orthogonality and lane clearance in the new routing regression. Existing fixture and constrained-corridor checks pass. Quality review: 36 tests across five geometry suites pass, changed-file Biome lint passes with no warnings, diff check passes, changed source files stay below 500 lines. Shared translate replaces the duplicate helper; applyPositions now takes its IDs from the position map. No OKF/C4 or public contract change requires documentation edits. Full repository verification remains pending because concurrent TASK-253 is changing the flow API.

Full-context complexity review found no blockers or material architecture changes and recommended keeping both domain-owned fixes. Applied its one small deletion: removed the unused intermediate island-width assignment, which final occupied bounds overwrite.

Final targeted placement rerun passes after the contextual review cleanup. A second full bun run check still stops at TypeScript errors from the in-progress flow contract transition (for example missing ArchitectureGraph.flows and old ViewState.flows references). No full-check success is claimed. Task remains In Progress with DoD 2 unchecked; commit and push are deferred until repository verification can complete. No other task files were edited.

Alex explicitly authorized committing and pushing the task changes despite the documented unrelated full-check failures. Commit scope is the four recorded implementation/test files and this task record. Full repository verification remains pending; this authorization does not claim that the full check passed.
<!-- SECTION:NOTES:END -->
