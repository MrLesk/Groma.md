---
id: TASK-28.19
title: Select components at the last C4 level
status: Done
assignee:
  - grok
created_date: '2026-08-15 21:26'
updated_date: '2026-08-15 21:29'
labels: []
dependencies: []
references:
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Entering Components currently keeps the parent container selected, so the architect cannot select or zoom to a component. Components is the last C4 level. Enter on a container, or the footer components slot, should select a child component and fit the camera to it. Arrows should still move between components while details are open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on a container with components selects a child component at Components level
- [x] #2 Footer components selects a component and zooms the camera to it
- [x] #3 Arrows can select another component while side details are open
- [x] #4 Viewer tests cover arriving at a selected component from a container
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
1. When entering or jumping to Components, select the first child component of the focused container (or the first component in the system if that container has none).
2. Allow arrow selection while side details are open; keep arrows blocked in full-screen details.
3. Update docs and tests so Enter on Scanner or Core lands on a component, and footer components does too.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity: enterView and jumpView pick firstComponentUnder so Components always has a component selected when one exists. Arrows work with side details; full-screen still blocks them.

Verification: bun test 15/15; bun run check. Enter on Core selects Architecture model; Right with details open selects World layout; Enter on Scanner selects Scanner plugin; footer components from Groma selects Architecture model.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Components is the last C4 level and is now selectable. Enter on a container or the footer components slot selects a child component and fits the camera. Arrows still work while side details are open. Verified by Enter-on-Scanner/Core tests and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
