---
id: TASK-170
title: Refine contextual flow and leg interactions
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 20:10'
updated_date: '2026-08-24 21:12'
labels: []
dependencies: []
references:
  - render
  - iso-camera
  - iso-map
  - page
modified_files:
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/flow/details.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/render.ts
  - test-bun/web-flow-selection.test.ts
  - test-bun/web-task-camera.test.ts
  - docs/viewers/web/index.md
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make web flow controls clearer and keep contextual inspection stable. Tighten the hierarchy flow marker and spacing, let Commands and Flows through toggle map paths without replacing the current details owner, and make selected-flow legs clearly identifiable and useful for locating their endpoint components.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hierarchy flow rows use the checkbox as their only control marker and do not reserve a separate glyph column
- [x] #2 Toggling a Command or Flows through row keeps the selected actor or component in the details pane while updating the active path on the map
- [x] #3 Selected-flow details label each leg as a relationship rather than presenting an unlabeled numbered list
- [x] #4 Clicking a flow relationship focuses its endpoint components and starts a continuous slow pulse that never fades them completely out
- [x] #5 Keyboard and assistive-technology users can identify and activate flow relationship destinations
- [x] #6 Focused automated tests and in-app Browser verification cover hierarchy spacing, stable contextual details, relationship focus, and the continuous pulse lifecycle
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
1. Remove the separate path glyph from the shared flow row and collapse its grid so the checkbox, name, and scope use the available width directly.
2. Add one activation-only flow-state operation for contextual rows; keep the existing hierarchy operation as the owner of flow details.
3. Render selected-flow legs as one Relationships list of focus buttons. Fit each clicked leg’s two endpoints with the shared camera geometry, keep flow details open, and let the map own a replaceable continuous slow pulse that keeps endpoints visible.
4. Add focused state, camera, and rendering checks; update the web-viewer contract; then verify both interaction paths and the continuous pulse in the in-app Browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial implementation:
- Removed the hierarchy flow glyph and its reserved grid column; the checkbox is now the single flow marker.
- Split contextual activation from hierarchy selection so Commands and Flows through update the map without taking details ownership.
- Replaced unlabeled flow legs with accessible relationship focus buttons.
- Reused camera body geometry to fit both relationship endpoints and added map-owned replayable flash state.
- Updated the web viewer contract.

Initial verification:
- bun test test-bun/web-flow-selection.test.ts test-bun/web-task-camera.test.ts test-bun/web-page.test.ts (9 pass)
- bun run typecheck (pass)
- git diff --check (pass)
- Browser: contextual activation kept Render details and lit 6 routes; hierarchy selection showed Flow · 6 relationships and 6 focus buttons; first relationship changed camera from scale 0.0708 to 0.4582, flashed observed:coding-agent and observed:page, cleared both flash classes after 1.1 s, and kept the flow title and URL. No console warnings or errors.

Simplicity review:
- Cold review found no blocking complexity.
- Removed the duplicate endpoint tooltip, renamed the mixed camera test, and collapsed repeated camera commit logic into applyFocus.
- src/viewers/web/render.ts is 500 lines after consolidation.
- Focused 9-test suite and browser interaction were rerun after simplification and passed.

Repository-wide check:
- bun run check is currently blocked before tests by unrelated uncommitted TUI work in test-bun/navigation.test.ts lines 252, 253, and 259, where a locally narrowed state requires currentId: string but reduceViewer returns ViewerState with currentId possibly undefined. TASK-170 does not modify those files.

Final check update:
- bun run typecheck and git diff --check pass after the concurrent TUI type fix landed.
- bun run check reaches the viewer suite: 177 pass, 5 fail in unrelated concurrent projection, blueprint, and TUI campus work (test-bun/projection-routes.test.ts, test-bun/iso-map.test.ts, and test-bun/tui-campus.test.ts). TASK-170 focused tests remain 9/9 passing and its verified browser flow remains clean.

UX correction: replace the fast flash with a slow pulse whose lowest opacity remains visibly above zero; rename the implementation to match the product term.

Pulse correction verification:
- Renamed the map effect, CSS class, lifecycle state, and documentation from flash to pulse.
- Pulse uses two 1.6 s ease-in-out cycles; its authored opacity floor is 0.55, so endpoints never disappear.
- Focused 9-test suite, typecheck, and diff hygiene pass.
- In-app Browser at http://localhost:4875 verified map-pulse on observed:coding-agent and observed:page, duration 1.6 s, two iterations, both still visible around the midpoint, cleanup after 3.2 s, stable flow details and URL, no framework overlay, and no console warnings or errors.

UX correction: the relationship endpoint pulse remains continuous; choosing another relationship replaces the pulsing pair, and reduced-motion users receive steady emphasis.

Continuous pulse verification:
- CSS iteration count is infinite; the map no longer owns animation-end cleanup or a pulse generation counter.
- Reduced-motion mode keeps the pulsing pair steadily emphasized without animation.
- Focused 9-test suite, typecheck, and diff hygiene pass.
- In-app Browser at http://localhost:4876 verified observed:coding-agent and observed:page were still running map-pulse after 5.2 s, then focusing relationship 2 replaced the pair with observed:page and observed:render. Flow details and URL stayed stable; no overlay or console warnings/errors.

Final targeted simplicity re-review:
- No blocking findings; the current implementation is the simplest one satisfying the accepted behavior.
- The continuous pulse correction reduced complexity by deleting animation-end cleanup and generation state.
- Original review findings remain resolved: duplicate tooltip removed, camera test responsibility named, and shared camera commit collapsed into applyFocus.
- Applied: renamed toggleFlow to toggleHierarchyFlow, documented the forced layout read that restarts a pulse, and relabeled the initial task notes.

Final verification:
- bun run check passes: 95 Node tests and 178 viewer tests, zero failures.
- Focused TASK-170 suite passes 9/9; typecheck and diff hygiene pass.
- In-app Browser proves compact hierarchy rows, stable contextual details, six labeled relationship buttons, endpoint camera focus, a continuous visible pulse after more than three cycles, pulse replacement on the next relationship, stable flow details/URL, and no console warnings or errors.
- Each relationship is a native button with an exact accessible label such as “Focus relationship 1: Reads the architecture in the browser, Coding agent to Page”.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clarified flow interactions across the web hierarchy and details pane: compact checkbox-only rows, activation-only contextual flows, labeled relationship focus buttons, endpoint camera fitting, and a continuous replaceable pulse that keeps endpoints visible. Updated the web viewer contract and consolidated shared flow/camera behavior. Verified with the complete repository check (95 Node and 178 viewer tests), the focused 9-test suite, typecheck, diff hygiene, and in-app Browser interaction evidence including continuous pulse replacement and accessible relationship labels.
<!-- SECTION:FINAL_SUMMARY:END -->
