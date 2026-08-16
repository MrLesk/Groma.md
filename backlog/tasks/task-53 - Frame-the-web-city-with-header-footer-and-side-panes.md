---
id: TASK-53
title: 'Frame the web city with header, footer, and side panes'
status: Done
assignee:
  - '@web'
created_date: '2026-08-16 18:32'
updated_date: '2026-08-16 18:47'
labels: []
dependencies: []
references:
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/tui/layout.ts
  - src/viewers/tui/tree.ts
documentation:
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect uses `groma web`, Groma shows the city inside the same fixed chrome as the TUI: a header, a hierarchy pane, the map pane, a details pane, and a footer. Side panes reserve width. The city never draws under them. The first view fits the map inside the map pane.

TASK-35 shipped the web map without chrome so the city could be judged. The TUI already proved this frame. The web plugin now uses it, with HTML for the tree and details instead of terminal cells.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma web shows a header with the groma wordmark, a left hierarchy pane, a center map pane, a right details pane, and a footer
- [x] #2 The hierarchy and details panes reserve width. The city never draws under them. The first view fits the map inside the map pane.
- [x] #3 The hierarchy pane lists the containment tree in map order, collapsed except the path to the selection, with a kind legend. The tree and map share one selection.
- [x] #4 The details pane always shows the current selection: name, kind, origin, description, relationships, children, and code.
- [x] #5 The first internal system is selected on open. Clicking a tree row or a map box updates the tree, details, and route text together. Empty clicks and Esc do not clear the selection.
- [x] #6 The footer holds the 2D and 3D controls and a zoom readout of fit or a percentage.
- [x] #7 docs/viewers/web/index.md describes this chrome.
- [x] #8 Web paint is composed from TypeScript atoms, molecules, and organisms, matching the TUI plugin split.
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
1. Split web paint into atoms (theme, kind, label), molecules (hatch, block, zone, route), and organisms (city, hierarchy, details, chrome). page.ts is the template; render.ts mounts camera and selection.
2. CSS-grid the page: header, hierarchy | map | details, footer. Side panes reserve width. The city lives only in #map.
3. Reuse TUI treeRows/kind marks for the hierarchy and inspectDetails for the details pane (name, kind, origin, description, promoted relationships, children, code).
4. Start with defaultSelection(world, context). Tree and map share that id. Empty click and Esc keep it. Clicking a tree row, details child/peer, or map box updates tree, details, and route text.
5. Move 2D/3D into the footer with a zoom readout (fit at the opening zoom, else a percentage).
6. Test inspectDetails. Update docs/viewers/web/index.md. Browser-check the chrome and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chrome is a CSS grid: header, 240px hierarchy, map, 280px details, footer. The city canvas lives only in #map. Opening selection is defaultSelection(world, context). One selectedId paints treeRows, inspectDetails, and route labels.

Paint is atoms (theme, kind, label, space), molecules (hatch, block, zone, route), organisms (city, hierarchy, details, chrome). page.ts is the template; render.ts mounts camera and selection.

Simplicity review dropped paintZoom, Inspected.kind, tree expand/collapse state, the window resize listener, and tests that only re-checked TUI treeRows/defaultSelection. Path-to-selection still expands the tree. Twisties are status only.

Browser: first view is Groma selected, 3D, fit. Tree and details stay in step when clicking Web viewer and Page. Empty map click and Esc keep the selection. Layout measure: hierarchy 240, map 728+, details 280, no overlap. bun run check: tsc clean, 53 node tests, 36 bun tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web now frames the city with the TUI chrome: header, hierarchy, map, details, and footer. Side panes reserve width. The first internal system is selected. Tree, details, and map share that selection. Web paint uses atoms, molecules, and organisms. Verified in the browser on this repository and with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
