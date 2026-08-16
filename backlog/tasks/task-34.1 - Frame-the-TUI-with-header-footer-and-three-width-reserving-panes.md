---
id: TASK-34.1
title: 'Frame the TUI with header, footer, and three width-reserving panes'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 11:44'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fixed chrome replaces the overlay: a one-row header with the lowercase groma wordmark (brand green accent) on the left and the exit hint on the right; a one-row footer; between them a hierarchy pane (left), the map pane (center), and a details pane (right), each reserving its width. Details for the current selection render inside the right pane; the details overlay, its side-panel camera dodge, and the f full-screen toggle are deleted. The map pane is the camera viewport: the world layout never changes, the camera fits the map inside the pane.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Header shows the groma wordmark left and the exit hint right on one fixed row
- [x] #2 Hierarchy, map, and details panes fill the space between header and footer; map content never renders under a side pane
- [x] #3 Selection details always render in the details pane; the overlay, Enter-opens-details coupling, and f toggle are gone
- [x] #4 Changing selection, details, or terminal size never re-lays-out the world; the first view fits the whole map inside the map pane
- [x] #5 Existing navigation (arrows, Enter, +, -, R, Ctrl+C) still works, verified with agent-tty at 120x36 and 200x60
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add paneLayout(width, height) in src/viewers/tui/layout.ts: 1-row header, 1-row footer, hierarchy pane (26 cols), details pane (32 cols), map pane between; map viewport is the map pane interior.
2. projection.ts: replace internal viewportFor with a caller-supplied viewport in ProjectionOptions; fitView/fitLayer/followSelection take the viewport; delete coveredFromX and uncoveredViewport.
3. navigation.ts: delete ViewerPanel, panel state, and the flip action; dismiss only leaves zoom focus; inspect no longer opens a panel.
4. details.ts: drawDetails fills the fixed details pane bounds; delete detailsBounds and the content-height shrink.
5. chrome.ts: 1-row header with groma wordmark (green accent bar) left and Ctrl+C exit right; footer keeps the z strip and hints minus f/Esc-close/exit; new drawPanes for the three pane borders.
6. paint.ts + terminal-viewer.ts: compute layout each repaint, project into the map viewport, always draw details for the selection, drop the f key.
7. Update test-bun/terminal-viewer.test.ts and docs/viewers/tui/index.md; verify with agent-tty at 120x36 and 200x60.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified live with agent-tty at 120x36 (start view, Enter to Containers, Left+Enter to Components) and 200x60 (start view). bun run typecheck, test:viewer (16 pass, concurrent), test:node (56 pass) all green. Cold simplicity review applied: deleted dead WorldProjection.levelName/currentName, collapsed inspect into enter, made world a required paint argument, folded pane borders into drawChrome, un-exported footerHints, tests read pane geometry from paneLayout. Tests rewritten to cover business logic only (projection invariants, navigation state, camera rules, world immutability, lifecycle) and converted to bun:test test.concurrent; testing rules recorded in AGENTS.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the overlay TUI chrome with fixed panes: paneLayout() computes a one-row header (groma wordmark left, exit hint right), hierarchy/map/details panes that reserve width, and a one-row footer. The map pane interior is the camera viewport passed into projectWorld; the overlay, its camera dodge (coveredFromX), the panel state, and the f toggle are deleted, and the details pane always shows the selection. Verified with the concurrent bun test suite (16 pass), node tests (56 pass), typecheck, and agent-tty sessions at 120x36 and 200x60.
<!-- SECTION:FINAL_SUMMARY:END -->
