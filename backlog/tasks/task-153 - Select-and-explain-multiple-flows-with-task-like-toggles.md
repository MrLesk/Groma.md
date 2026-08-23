---
id: TASK-153
title: Select and explain multiple flows with task-like toggles
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 18:16'
updated_date: '2026-08-23 18:43'
labels: []
dependencies: []
references:
  - render
  - iso-map
  - action-path
  - web-viewer
modified_files:
  - src/viewers/web/flow/state.ts
  - src/viewers/action-path.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/flow/details.ts
  - src/viewers/web/selection.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/url.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - src/viewers/web/organisms/flows.ts
  - test-bun/inspect-details.test.ts
  - test-bun/web-flow-selection.test.ts
  - test-bun/action-path.test.ts
  - test-bun/web-selection.test.ts
  - test-bun/web-url.test.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/index.md
  - docs/viewers/web/index.md
type: feature
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect can activate one or several derived command flows without a special x shortcut. Flow activation follows the existing Backlog-task interaction: the last activated flow owns the details pane, architecture or task selection may change while the flow highlights remain, and empty sheet or Escape clears the highlights. The selected flow explains its actor scope and ordered relationship legs in the right sidebar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking an inactive flow activates and selects it; clicking another flow keeps both highlighted and selects the new one; clicking the selected flow again deactivates it and falls back to the previously activated flow
- [x] #2 Selecting architecture or a Backlog task keeps active flows highlighted; clicking empty sheet or pressing Escape clears active flows, and x is no longer a flow-control shortcut
- [x] #3 The map highlights the union of every active flow while the flow list distinguishes active flows from the selected flow using the existing visual language
- [x] #4 The right sidebar explains the selected flow with its command, optional actor scope, and ordered relationship legs whose architecture endpoints or relationships can be selected
- [x] #5 The URL preserves ordered active flows, including actor scope, and restores the selected flow when no architecture item or task owns the details pane
- [x] #6 Shared viewer documentation defines command, flow, and leg; web documentation and focused state, path, URL, and interaction checks cover the behavior
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
1. Replace the singular ActiveAction with an explicit FlowRef and ordered web flow activation state; add a flow selection variant so the right pane has a typed authority.
2. Gather shared flow derivation under the flow domain with command, leg, route-union, and scope vocabulary; keep the map ignorant of flow count.
3. Move the web flow list into a flow domain and add flow details; reuse task-like activation behavior, union the active route sets, keep other selections independent, and remove x clearing.
4. Extend URL state to repeated ordered flow values with scope inside each value, update the shared and web viewer contracts, and cover pure state/path/URL behavior plus the supported browser flow.
5. After focused checks, run the cold simplicity review and the full-context defensive architecture review, apply accepted subtraction, then finalize, commit, and push only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented ordered FlowRef activation with one active scope per command, a typed flow Selection owner, shared route-union derivation, domain-grouped web flow state/list/details, a route-only map API, repeated scoped URL flows, and explicit selected-flow only when the owner is not the latest active flow. Removed the singular ActiveAction and x clearing.

Objective verification: bun run typecheck passed; bun run test:viewer passed 172/172; final focused state/path/URL/page/live suite passed 46/46; git diff --check passed. Rendered Browser QA at http://localhost:59653 exercised inactive activation, two-flow union, active non-selected details switching, selected deactivation with fallback, URL reload restoration, architecture selection retaining flow highlights, x remaining inert, Escape clearing, empty-grid clearing, actor-scoped activation replacing the same command in place, and selectable leg endpoints and relationships. The two-flow union rendered 25 routes for 3- and 24-leg flows, actor scope reduced the tested command from 24 to 23 routes, and endpoint/relationship selection retained two active flows and eight lit routes. Page identity and meaningful content passed, no framework overlay appeared, and console warnings/errors were empty.

Cold simplicity review traced URL/read -> toggle state -> route union -> list/map/details and passed the architecture after requesting recorded browser evidence plus two small URL/test deletions. The full-context complexity review also approved the domain grouping and map boundary. Applied both reviewers’ shared selected-flow simplification, removed obsolete by= assertions, deleted a trivial retainFlows wrapper, and renamed task state to activeTaskIds/activeTaskItems to reduce confusion beside activeFlows. Targeted verification showed the latest flow omits selected-flow while selecting an older active flow adds it.

Clean delivery verification: applied only TASK-153 to origin/main in an isolated worktree; bun run typecheck passed, bun run test:viewer passed 169/169, the 41 focused tests passed, and git diff --check passed. The different full-suite count excludes unrelated uncommitted tasks in the shared worktree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added task-like multi-flow activation, route-union highlighting, typed flow details, scoped ordered URL restoration, and shared flow vocabulary. Removed the singular ActiveAction and x shortcut. Verified through rendered browser interactions, type checking, 41 focused tests, the 169-test clean viewer suite, the 172-test shared integration suite, diff checks, cold simplicity review, and full-context defensive architecture review.
<!-- SECTION:FINAL_SUMMARY:END -->
