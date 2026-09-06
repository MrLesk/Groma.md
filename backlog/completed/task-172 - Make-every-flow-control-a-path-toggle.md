---
id: TASK-172
title: Make every flow control a path toggle
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 17:16'
updated_date: '2026-08-25 21:14'
labels: []
dependencies: []
references:
  - render
  - page
  - iso-camera
  - iso-map
modified_files:
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/selection.ts
  - src/viewers/web/url.ts
  - src/viewers/web/render.ts
  - src/viewers/web/flow/details.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - test-bun/web-flow-selection.test.ts
  - test-bun/web-selection.test.ts
  - test-bun/web-url.test.ts
  - test-bun/web-task-camera.test.ts
  - docs/viewers/web/index.md
  - test-bun/web-flow-activation.test.ts
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a viewer uses any flow row in the web hierarchy or details pane, Groma only toggles that flow's highlighted map path. Flow controls never select a flow or replace, open, or close the current details pane; deeper inspection starts from an item or connection on the map.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hierarchy flow rows and contextual Command and Flows through rows use the same activation-only toggle behavior
- [x] #2 Toggling a flow keeps the current architecture, relationship, or task details owner unchanged, and keeps the pane closed when there is no details owner
- [x] #3 Active flow paths still serialize to and restore from the URL without creating a selected flow or opening flow details
- [x] #4 Obsolete selected-flow details, relationship-focus pulse behavior, and their unused state are removed
- [x] #5 Focused automated checks and in-app Browser verification cover stable details ownership and path activation from both flow entry points
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
1. Collapse the shared flow row and state APIs to one activation-only path toggle; remove selected-flow styling and parameters. 2. Remove flow from the selection and URL models so active flow query entries restore highlights without owning details. 3. Delete the unreachable flow-details renderer and its relationship camera/pulse support, while preserving normal map item and connection selection. 4. Update the web-viewer contract and focused business-state tests. 5. Run focused checks and rendered Browser proof for hierarchy, Commands, and Flows through while preserving concurrent TASK-165 hunks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one activation-only flow path across hierarchy, Commands, and Flows through. Removed selected-flow selection and URL state, flow-details rendering, relationship endpoint camera fitting, map pulse state/styles, and selected-row presentation. Preserved concurrent TASK-165 project-profile and blueprint hunks in shared files.

Focused verification: 17 tests pass across flow state, selection, URL, camera, browser bundle, and page; typecheck passes; task-scoped diff hygiene passes. In-app Browser at http://localhost:4877 proves: a hierarchy toggle opens no details and lights 6 routes; an actor Command keeps Coding agent details and rescopes the URL; Flows through keeps Groma details and lights the union; clicking a lit connection opens relationship details; no flow-details DOM, framework overlay, console warning, or console error remains.

Repository-wide verification: bun run check passes with 95 Node tests and 150 viewer tests, zero failures.

Cold simplicity review: no blocking findings. Reviewer confirmed the direct flow-row to toggleFlow to toggleFlowActivation to map-highlight path is the simplest accepted design. Applied its sole optional clarity note by renaming web-flow-selection.test.ts to web-flow-activation.test.ts; focused 17-test suite, typecheck, and task-scoped diff hygiene pass afterward.

Final architecture review found no blocking complexity and confirmed the domain grouping and removed flow-selection variant make junior mistakes less likely. With user approval, renamed paintSelection to paintViewState because the function repaints selection, flows, tasks, URL, hierarchy, map, and details.

User approved the final paintViewState naming clarification. After the rename, the focused 17-test suite, bun run check (95 Node and 156 viewer tests), typecheck, and repository diff hygiene pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified hierarchy Flows, Commands, and Flows through as one activation-only path control. Removed flow selection, flow-owned details, selected-flow URL state, endpoint focus/pulse code, and obsolete tests/styles; map items and connections remain the inspection entry points. Verified with 17 focused tests, the full 95 Node plus 156 viewer suite, typecheck, diff hygiene, in-app Browser interaction, cold simplicity review, specification review, quality review, and final full-context architecture review.
<!-- SECTION:FINAL_SUMMARY:END -->
