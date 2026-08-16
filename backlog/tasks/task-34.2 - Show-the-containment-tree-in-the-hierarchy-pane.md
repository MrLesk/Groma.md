---
id: TASK-34.2
title: Show the containment tree in the hierarchy pane
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 11:56'
labels: []
dependencies:
  - TASK-34.1
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hierarchy pane lists the merged world as a containment tree: people, internal systems, and external systems at the root; containers under their system; components under their container. Ghosts carry a distinct marker. The tree and the map share one selection: map moves update the tree highlight, and choosing a tree row selects that element on the map, panning or zooming the camera so it is visible. Groups from element frontmatter stay invisible to the tree, matching navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every element of the merged world appears exactly once, nested by containment; ghosts are marked distinctly
- [x] #2 Rows are collapsed except the path to the current selection; collapsed rows with children show a child count
- [x] #3 With the hierarchy pane focused, Up/Down move through visible rows, Left/Right collapse and expand, Enter selects that element on the map and the camera brings it into view
- [x] #4 Map arrows keep working while the tree highlight follows the map selection
- [x] #5 The tree scrolls when taller than the pane, keeping the highlighted row visible
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
1. New src/viewers/tui/tree.ts: pure treeRows(world, selectionId, tree) flattening the merged world by containment (roots sorted by id, children via element.children), honoring manual expand/collapse sets plus the always-visible path to the selection; rows carry depth, glyph state, ghost origin, and collapsed child counts.
2. navigation.ts: ViewerFocus gains 'hierarchy'; ViewerState gains tree {cursor, expanded, collapsed}; Tab toggles map/hierarchy focus; in hierarchy focus Up/Down move the cursor over visible rows, Left collapses or climbs to parent, Right expands, Enter selects the cursor element on the map at its level; Esc returns to the map; map-side selection changes sync the cursor and unhide the selection path.
3. New organisms/hierarchy.ts: draws rows in the hierarchy pane with selection accent bar, cursor tint when focused, ghost marker, counts, truncation, and scrolling that keeps the cursor visible.
4. terminal-viewer.ts + paint.ts: wire Tab and tree state through repaint; Enter from the tree reuses followSelection so the camera frames the new level.
5. Business-logic tests: treeRows flattening/collapse/count/ghost invariants, reducer cursor movement and sync, camera-follow on tree enter; docs update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tab toggles map/hierarchy focus (design decision made in-session; Esc also returns to the map). Cold simplicity review applied: tab branch reuses syncTree, single index clamp, one compareElements comparator shared with navigation, ancestorsOf takes the id map, paint requires tree, ghost-marker doc clarified. Verified live with agent-tty: tree render with counts and ghost marker at 120x36, Tab/Right/Down/Enter selecting Core (camera framed containers), Esc+Right map move with tree bar following and Core auto-collapsing, scrolling at 80x12 keeping the cursor row visible. bun run typecheck, test:viewer 19 pass, test:node 56 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the containment tree to the hierarchy pane: pure treeRows flattening in tree.ts (collapsed by default, selection path always visible, manual expand/collapse overrides), reduceTree handling Tab focus, cursor movement, collapse/expand, and Enter selection, drawHierarchy painting selection bar, cursor tint, ghost markers, counts, and cursor-visible scrolling. Map and tree share one selection in both directions. Verified with unit tests of tree flattening, reducer flow, and scroll invariants plus live agent-tty sessions.
<!-- SECTION:FINAL_SUMMARY:END -->
