---
id: TASK-288
title: Fit the web camera to selected flows and architecture
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:00'
updated_date: '2026-09-05 22:12'
labels: []
dependencies: []
references:
  - iso-camera
  - render
  - flow-controls
  - web-viewer-details
  - web-shell
documentation:
  - docs/viewers/web/index.md
modified_files:
  - features/flows.feature
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/render.ts
  - test-bun/web-selection-camera.test.ts
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/url.ts
  - test-bun/web-flow-activation.test.ts
  - test-bun/web-url.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/chrome/shell.ts
  - test-bun/web-shell.test.ts
type: enhancement
ordinal: 327000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect selects a flow in the web map, the camera centers and adjusts zoom to show its complete path and components. Multiple selected flows fit together. Selecting an architecture item centers and fits that item using the displayed geometry and available map area.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a flow fits every explicit endpoint and route of that flow in the visible map area.
- [x] #2 Selecting multiple flows fits their combined components and paths; removing a flow refits the remaining selection.
- [x] #3 Selecting an architecture item centers and adjusts zoom to fit its complete displayed body, including contained architecture for a system or container.
- [x] #4 Selection changes preserve the architecture layout and work in nested and separated layer views.
- [x] #5 Focused camera and selection tests and the web behavior documentation cover the supported result.
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
1. Reuse projected-point fitting for exact flow routes and architecture bodies, including descendant bodies and separated-layer joins. Keep task outgoing-route fitting distinct. 2. Use one ordered checked-flow list; its last entry owns the reader and step. Clicking toggles membership, and repeated flow URL parameters restore the selected set. 3. Fit architecture selection and accepted search results after pane state updates, using the details pane final layout edge. Fit all checked flow routes on toggle and return; clearing selection leaves the camera unchanged. 4. Cover selection lifecycle, URL restoration, projected geometry and pane framing, update behavioral scenarios and the web guide, run bun run check, and perform self specification/quality review plus the requested full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared projected-body fitting for architecture items and explicit flow routes; task fitting keeps its existing outgoing-route behavior. Checked flows use one ordered list and one current reader, with repeated flow URL parameters. Browser verification on a read-only preview confirmed flow addition zoomed out (479% to 86%), removal restored 479%, component selection centered and zoomed to 3910%, and Back to flow fitted separated geometry. Focused checks: 22 tests pass and typecheck passes. No other agents were contacted because recorded file lists do not overlap.

Browser inspection reproduced clipped focus when selection opened the sliding details pane. Camera framing now uses its untransformed layout edge and intended visibility, rather than the animated rectangle. The supported 900px minimum page also leaves only 212px between panes; the shared fit margin now scales within that area to keep zoom positive.

The corrected browser search flow now shows the entire selected component centered between the panes immediately after opening details. Self specification review: flow union fitting, removal refit, item and descendant fitting, immutable projected geometry and guide coverage all have automated or browser evidence. Self quality/simplicity review: reused existing bounds and fit math, kept flow state in its domain, removed duplicated initial/live painting and flow-opening code, and kept the renderer at 498 lines. No changes to OKF/C4 records, scanner behavior, layout, or other agents files.

Final verification: bun run check passed, including Biome and scrollbar lint, TypeScript, the Node suite, and 303 Bun tests across 61 files. Browser retest verified Search acceptance from a cleared map after the pane-animation fix. All five acceptance criteria are verified; final full-context complexity review is pending before terminal status and commit.

Full-context complexity review completed: no blocking findings; keep the implementation. Reviewer confirmed clear ownership across flow state, camera, shell framing and renderer, with no new architecture concepts or geometry state. Non-blocking recommendations reserved for discussion: clarify the flow-controls architecture overview and reuse flowSelection in URL restoration. Neither recommendation is needed for the verified acceptance criteria.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web camera now centers and fits selected architecture items and the combined explicit paths of checked flows. Multiple flows remain highlighted, the last checked flow owns details, and URLs restore the checked set. Camera framing uses final pane layout and displayed nested or separated geometry. Verified through browser interactions and bun run check: lint, typecheck, Node tests and 303 Bun tests passed. Full-context complexity review found no blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
