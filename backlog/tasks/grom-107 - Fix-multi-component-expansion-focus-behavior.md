---
id: GROM-107
title: Fix multi-component expansion focus behavior
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-21 22:35'
updated_date: '2026-07-21 22:48'
labels: []
dependencies: []
modified_files:
  - src/web/client/app.tsx
  - src/web/client/canvas.tsx
  - src/web/client/graph.ts
  - src/web/client/styles.css
  - src/web/tests/model.test.ts
type: bug
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expanded component plates must behave as independent disposable canvas projections. Collapse belongs to each expanded plate, selecting another visible component must keep selection and camera on that component, and expanding one component must not disable expansion of another.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each expanded component plate shows a minus collapse control in its top-right corner, with no page-level collapse control
- [ ] #2 Selecting a component outside an expanded plate keeps selection and camera focus on the newly selected component
- [ ] #3 Two or more component plates can remain expanded simultaneously
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the single focus path with ordered independent expanded component IDs in app and graph state. 2. Render a per-group minus collapse control and remove the page-level breadcrumb collapse UI. 3. Make camera framing prefer the current visible selection over the latest expanded group. 4. Update the focused graph tests to the new expansion contract and cover simultaneous sibling expansion; do not run verification in this focused session.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented independent ordered expansion state, per-group minus collapse controls, and selection-first camera framing. Updated the graph view-model tests for the renamed expansion contract and added simultaneous sibling expansion coverage. No runtime, test, build, CI, browser, or online verification was run per the focused-run instruction, so acceptance criteria remain unchecked and the task remains In Progress.

Corrected the collapse control event path: React Flow assigns pointer-events:none to non-selectable, non-draggable group wrappers, so the visible button could not receive clicks. Group nodes now explicitly retain pointer events while remaining non-selectable semantic containers. No runtime verification was run per instruction.

Pre-PR review completed with two independent Terra passes and one Claude pass. Both Terra reviewers found the same nested-collapse issue; collapse now removes the full visible projection branch. Targeted model tests and the local build passed. Browser interaction confirmed two sibling plates can be expanded simultaneously and expose independent collapse controls; full task finalization was not performed.
<!-- SECTION:NOTES:END -->
