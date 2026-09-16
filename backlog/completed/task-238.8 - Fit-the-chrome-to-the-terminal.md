---
id: TASK-238.8
title: Fit the chrome to the terminal
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 21:03'
updated_date: '2026-09-03 06:39'
labels:
  - tui
  - render
dependencies:
  - TASK-238.2
modified_files:
  - src/viewers/tui/layout.ts
  - src/viewers/tui/model.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/work/model.ts
  - src/viewers/tui/work/navigation.ts
  - test-bun/work.test.ts
  - src/view-host.ts
  - test-bun/helpers.ts
  - src/viewers/tui/panes/text.ts
  - src/viewers/tui/panes/hierarchy.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - src/viewers/tui/panes/screen.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/terminal-viewer.ts
  - docs/viewers/tui/index.md
  - src/viewers/tui/navigation-search.ts
  - src/viewers/tui/panes/chrome.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 270000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view` in a narrow terminal, the panes start folded by width: the map keeps at least 60 columns; the hierarchy pane takes 26 columns and the details pane 32; at 120 columns and wider both panes are open; from 90 to 119 the details pane starts folded; under 90 both are folded and the footer names the selection. `[` folds or opens the hierarchy and `]` the details at any width; a pane takes its columns from the map and never covers it; both folded is the map-only view. Inside a container map the header shows the scope path (system, container, component count). `p` shows the project profile (title, description, overview) read-only in the details pane. A mouse click selects a row or a building.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Panes start folded by the width table: both open at 120 and wider, details folded from 90 to 119, both folded under 90 with the selection named in the footer
- [x] #2 `[` and `]` fold or open the hierarchy and details at any width; a pane takes columns from the map and never overlays it
- [x] #3 Inside a container map the header shows the scope path with the component count
- [x] #4 `p` shows the project profile in the details pane; Escape or `p` returns to the previous details; nothing is editable
- [x] #5 A mouse click on a row or a building selects it
- [x] #6 Tests cover the fold decision per width and the profile view from a fixture under test/fixtures
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
1. layout.ts: PaneVisibility gains hierarchy; panesForWidth(width) gives both panes at 120 and wider, hierarchy only from 90 to 119, none under 90; the viewer seeds its state from the renderer width.
2. navigation.ts: toggle-hierarchy ('[') folds or opens the hierarchy and drops hierarchy focus to the map when folding; Tab and Work focus open it; toggle-profile ('p') shows the project profile in the details pane and Escape or p returns; detailsCommands is empty while the profile shows so Up/Down scroll it; selectMapItem and clickTreeRow select from a click by id.
3. model.ts and view-host.ts: TerminalViewModel carries project from loadProjectProfile; the renderer turns useMouse on; test helpers load the same profile.
4. panes: screen.ts hides the hierarchy box when folded and wires onMouseDown on the hierarchy text (row index) and the map buffer (local cell); view.ts adds the scope path with the component count inside a container map, names the selection in the footer while details are folded, and builds the profile view (title, description, overview) with no tab; details.ts gets profileLines.
5. terminal-viewer.ts: keys [ and p; the click handlers map a row to its id and a cell to the smallest projected item under it, then reduce.
6. Tests in chrome.test.ts: fold table per width, [ folding and Tab reopening, profile view from test/fixtures/viewer-view via p and Escape, a hierarchy row click and a map click selecting their element; docs/viewers/tui/index.md keys and layout updated.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented so far: panesForWidth in layout.ts and the viewer seeds panes from the renderer width; [ and p reduce through toggle-hierarchy and toggle-profile, Tab and Work focus open the hierarchy, Escape closes the profile first; the header shows system › container · N components inside a container map and the footer names the selection while the details are folded; the project profile loads through loadProjectProfile into TerminalViewModel.project for the viewer and the test helper; hierarchy rows carry ids so a click can resolve them; itemAt in projection.ts finds the smallest element under a map cell. The toolkit's frame buffer never receives the click in the test renderer, so the map's box takes it and translates to the buffer's cell.

Evidence: chrome tests 10 pass (fold table per width, [ and Tab, folded hierarchy giving its 26 columns to the map with cells unmoved, p until Escape from test/fixtures/viewer-view, hierarchy row click, building click, smallest-item hit test); the other terminal suites 37 pass; typecheck clean; lint keeps the 9 pre-existing complexity warnings. tui-test captures in the session scratchpad: 80x30 both panes folded with '■ Catalog' in the footer, 100x36 hierarchy only, 120x36 both open, 120x36 after [ and ] map only, 120x36 after p with the project title in the details frame and 'p back   esc back' in the footer, and a container map whose header reads 'Catalog › Import · 15 components'.

Follow-up for the camera task: the first repaint runs before the map has its size, so its camera is fitted to a 1x1 viewport and kept; a fresh projection at the real size places cells differently. The building click test therefore clicks the card title it finds on screen rather than a cell computed from a fresh projection.

Cold simplicity review: nine accepted-scope findings applied. One reducePanes decides folds and the profile (and refuses the profile without a project, so footer and details agree); clickTreeRow is the reducer's own Enter after placing the cursor; itemAt is the topmost painted item under the cell (items list outer before inner); the hierarchy folds by absence like the details, so ScreenView carries no pane flags; loadTerminalModel in view-host.ts is the one model loader for the host and the tests; the unit hit test folded into the click test; profile is a boolean; the header stats split into scopeStats and rootStats; a comment marks that clicks resolve against the frame last painted. Follow-up recorded, not applied: a click can select the container boundary inside its own container map, a selection arrows cannot reach; one selectable predicate shared by clicks and mapAnchors would close it.

Full-context complexity review: two blocking state leaks fixed, the profile flag now ends when Work focus opens or the details fold (test added), and the docs no longer say the details pane opens by default. Applied simplifications: the frame buffer takes the map click itself (the earlier probe that suggested otherwise ran two copies of the toolkit), which also bounds clicks to the buffer; the screen resolves a hierarchy row to its id so the viewer keeps only the last projection; a map click selects only an id in mapAnchors, the rule arrows use, closing the unreachable container-boundary selection; loadTerminalModel lives in viewers/tui/model.ts next to its type; reducePaneKeys names what it handles; an 80-column mount test covers the seeded folds and the click tests assert the selection changed.

Follow-ups for Alex, not applied: the profile overview wraps as one paragraph (a multi-paragraph project.md would grow the pane past its scroll); initialState could take the panes instead of the viewer overriding them; p could move focus to the details so Up/Down scroll at once; a project.md removed mid-session leaves the profile flag set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The terminal chrome fits its terminal: panes start folded by width (both open at 120 columns and wider, the hierarchy alone from 90 to 119, none under 90 with the selection named in the footer), [ and ] fold or open the hierarchy and details at any width and hand their columns to the map, a container map's header shows System › Container · N components, p shows the project profile read-only until Escape or p, and a mouse click on a hierarchy row or a map building selects it. Tests cover the width table, the folds, the profile view from test/fixtures/viewer-view and both clicks; tui-test captures show the folds at 80, 100 and 120 columns, the profile and the scope path.
<!-- SECTION:FINAL_SUMMARY:END -->
