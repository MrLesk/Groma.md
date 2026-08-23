---
id: TASK-146
title: Select multiple architecture items and relationships with Shift
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 16:41'
updated_date: '2026-08-23 17:52'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/selection.ts
  - test-bun/web-selection.test.ts
  - test-bun/web-url.test.ts
  - src/viewers/web/url.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
  - src/viewers/tui/tree.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/paint.ts
  - test-bun/tree.test.ts
type: feature
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect can build one ordered selection across architecture elements and relationship routes by holding Shift. The last selected item remains the details-pane authority, while the map and hierarchy show the whole set using Groma’s existing selection language. Backlog task activation stays a separate concern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A normal click selects only that architecture element or relationship; Shift-click toggles it in the current ordered selection from the map and every existing architecture-selection entry point
- [x] #2 The map shows the union of the existing selected-element and selected-relationship treatments, and the hierarchy marks every selected element without introducing a new colour or bulk-selection UI
- [x] #3 The last item added appears in the details pane; removing it makes the previously selected item primary, and removing the final item empties the pane
- [x] #4 Escape or a click on empty sheet clears the full architecture selection and keeps the existing active-task clearing behavior
- [x] #5 The URL preserves and restores the ordered architecture selection using authored element and relationship identities; unknown items are ignored
- [x] #6 The web viewer documentation and focused navigation-state and URL tests describe and verify the behavior
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
1. Add one pure web selection state that owns the ordered architecture target ids and derives the primary item; cover replace, Shift-toggle, removal order and clearing with focused navigation-state tests.
2. Refactor the browser coordinator to use that state, pass Shift from every architecture-selection entry point, keep active Backlog tasks separate, and prune missing targets on live updates.
3. Change the existing map and hierarchy selection APIs to paint the full set as the union of their current single-item treatments; keep the last target as the only details-pane authority.
4. Extend the existing URL grammar to write and read repeated kind and relationship parameters in selection order, preserving authored identities and ignoring unknown targets.
5. Update the web viewer contract, run focused checks and browser interaction verification, then perform the required cold and full-context simplicity reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added the pure Selection domain state and focused tests for plain replacement, ordered Shift-toggle, primary fallback, clearing and task separation. bun test test-bun/web-selection.test.ts: 3 pass.

Coordination pause: render.ts, iso/map.ts, organisms/details.ts, url.ts, web-url.test.ts and docs/viewers/web/index.md all contain uncommitted work from completed or active TASK-135, TASK-136, TASK-142 and TASK-145. Editing those paths now would make an isolated TASK-146 commit impossible and could overwrite active agents. No overlapping file was changed; resume after those base commits land.

Extended the state slice with selectedArchitecture() and retainSelection(), so rendering and live updates can derive from the same invariant. bun test test-bun/web-selection.test.ts: 4 pass.

Implemented one ordered Selection domain state shared by the browser coordinator and URL contract. Map and hierarchy consume the full architecture set; details consumes primarySelection(), the last id. Shift is forwarded by map pointer state, hierarchy rows, relationship ends, element children and peers, and task reference links. Active Backlog tasks remain a separate Selection variant and active list.

Verification: bun run typecheck passed; bun test test-bun/web-selection.test.ts test-bun/web-url.test.ts test-bun/web-live.test.ts test-bun/web-page.test.ts passed 15/15; bun run test:viewer passed 155/155. Browser QA at http://localhost:4749 verified normal replacement, Shift-add from hierarchy/details, Shift-add and removal of relationship:12, union map/hierarchy treatment, last-added details authority, ordered URL restoration, Escape clearing, empty-sheet clearing, no console warnings/errors, and screenshot evidence.

Full bun run check has one unrelated existing shared-tree failure: test/scan.test.ts still opens src/backlog-plugin.ts after TASK-135 moved/deleted that file. TASK-146 typecheck and all viewer tests pass; no TASK-146 file is involved in that failure.

Cold simplicity review explained the click -> Selection -> paintSelection -> map/hierarchy/details/URL flow and reported no blocking or non-blocking findings; it found no task-scoped code or tests to delete or collapse.

Contextual architecture review initially found that a non-primary selected descendant could be hidden by the hierarchy's primary-only open path. Alex chose to keep every selected item visible. Refactored shared treeRows() to accept all selected ids; web passes its full architecture selection and TUI callers pass their singular current id. Added fixture coverage for two selected paths and made Selection.ids readonly. Targeted re-review passed with no remaining finding.

Final verification after review fix: bun run typecheck passed; focused suite passed 19/19 with --timeout 20000; git diff --check passed; bun run test:viewer passed 159/159. Browser reproduction /?container=web-viewer&system=groma showed both rows visible and selected, Groma primary in details, and no console errors.

Final architecture review found that a manually collapsed ancestor could still hide a selected descendant and that the web documentation described only the primary path. Selected paths now override manual collapse in shared treeRows(); toggleExpansion() checks explicit collapsed state first so a second click reverses the stored intent. Updated the tree behavior test and web contract.

Final correction verification: bun run typecheck passed; focused tree/selection/URL tests passed 14/14; git diff --check passed; bun run test:viewer passed 161/161. Browser QA on /?container=web-viewer&system=groma verified that clicking Groma's collapse arrow cannot hide selected Web viewer, the second click remains reversible after selecting Git, the page is rendered, and console warnings/errors are empty.

Final bun run check rerun after the hierarchy correction: typecheck passed and 92/93 node tests passed; the same unrelated test/scan.test.ts failure remains because the shared TASK-135 move deleted src/backlog-plugin.ts. Viewer suite was run separately and passed 161/161.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one immutable ordered architecture selection shared by browser interactions and URL state. Normal clicks replace; Shift-clicks toggle elements and authored relationships from map, hierarchy, and details. The map unions existing treatments, every selected hierarchy path stays visible even against manual collapse, and the last item owns details with ordered fallback. Verified by focused state/URL/tree tests, typecheck, 161 viewer tests, and browser interaction/URL/console/screenshot QA. The only full-check failure remains the unrelated TASK-135 stale scanner path in the shared uncommitted tree.
<!-- SECTION:FINAL_SUMMARY:END -->
