---
id: TASK-28.12
title: Keep TUI boxes readable and pan the map
status: Done
assignee:
  - '@grok'
created_date: '2026-08-15 19:52'
updated_date: '2026-08-15 20:01'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
  - src/viewers/tui/projection.ts
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect opens groma view, every visible name stays readable. The world is a map that may be larger than the terminal. The viewer does not shrink boxes to fit the screen. Arrowing pans just enough when the selected item would leave the view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Component and person names are not truncated when that item is on screen
- [x] #2 The world is not scaled down to fit the terminal
- [x] #3 Arrowing between items that are already on screen does not move cards, routes, or labels
- [x] #4 Arrowing to an item that would leave the screen pans just enough to keep it visible
- [x] #5 Headless viewer tests and an agent-tty walkthrough cover Core components with full names and a pan to an off-screen item
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
1. Stop scale-to-fit. Project the ELK world at a fixed readable scale (1 world unit = 1 cell, half-cell Y). Size titled cards to the full name.
2. Keep a camera origin on the viewer. Default to the current level's focus; if that region is larger than the terminal, show a window into it. Pan just enough when the selection would leave the screen. Do not pan when the selection is already visible.
3. Stop clamping cards and labels onto the viewport. Labels stay on their routes. Off-screen cells clip.
4. Update TUI docs and AGENTS.md: the map may be larger than the terminal. Extend viewer tests for full Core names, stable on-screen arrows, and a pan to an off-screen item. Verify with agent-tty.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Stopped scale-to-fit. The TUI projects ELK at 1 world unit = 1 cell (half-cell Y). Cards size to the full name. The camera is a window into that map; it pans just enough when the selection would leave the screen, and stays put when the selection is already visible. Level changes reset the camera to the selected system or container. Labels stay on routes instead of clamping to the viewport.

Simplicity: no extra pan keys or scrollbars. visibleIn sits next to panCells.

Verification: bun test test-bun/terminal-viewer.test.ts 10/10 including full Architecture model / World layout / Scan reconciler names and a pan to Git; bun run check (tsc, architecture, 52 Node, 10 viewer). agent-tty 120x36: start shows SYSTEM · Groma and Terminal interface untruncated; Containers · Core shows Scan reconciler and Architecture model in full; Right from Groma pans to Git.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI no longer shrinks the world to fit the terminal. Boxes stay large enough to read, and the camera pans just enough when a selection would leave the screen. Verified with viewer tests and an agent-tty 120x36 walkthrough of Core names and a pan to Git.
<!-- SECTION:FINAL_SUMMARY:END -->
