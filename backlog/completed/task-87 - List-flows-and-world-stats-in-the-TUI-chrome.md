---
id: TASK-87
title: List flows and world stats in the TUI chrome
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 21:38'
updated_date: '2026-08-17 22:08'
labels: []
dependencies: []
priority: high
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI hierarchy pane shows only the element tree and the header only the wordmark. List every person command above the tree, reachable with the pane cursor and pickable with Enter, and show the observed system name with live flow and element counts in the header, matching the web chrome. Dark mode is out of scope: the terminal already owns the palette.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The hierarchy pane lists every person command above the tree; the pane cursor reaches them and Enter lights that walk, with the active row marked
- [x] #2 The header shows the observed system name with live flow and element counts
- [x] #3 The flows rows joining the pane cursor and the Enter pick are covered by fixture tests and bun test passes
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
1. navigation.ts reduceTree walks a combined cursor space: worldCommands ids above the tree rows; Up/Down cross the seam, Enter on a flow row lights that walk (resetting the trace), Right on one returns to the map, and tree rows keep their existing fold/select behavior.
2. organisms/hierarchy.ts draws the flows block above the tree: a dim Flows label, one '→ description' row per command, the active walk marked in the accent, the cursor highlight shared with tree rows; the tree keeps its scroll window in the remaining height.
3. organisms/chrome.ts takes a stats string drawn dim after the wordmark; paint.ts computes worldCommands once and derives 'System · N flows · M elements' from the observed non-external system.
4. Fixture tests: Up from the first tree row reaches the flow row, Enter lights it, Right returns to the map, tree behavior below is unchanged.
5. bunx tsc, bun test, agent-tty check of the flows block, header stats, and a flow pick from the pane.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
reduceTree now walks one cursor space: worldCommands ids above the tree rows; Enter on a flow row lights that walk (trace reset), Right returns to the map, tree rows keep fold/select. drawHierarchy renders the Flows block (dim label, '→ description' rows, accent mark on the active walk, shared cursor highlight, closing rule) and drops it when it would squeeze the tree out; the tree scrolls in the remaining height. drawChrome draws a dim stats string after the wordmark; paint.ts derives 'Groma · 4 flows · 35 elements' from the observed non-external system and computes worldCommands once. agent-tty evidence at 120x36 and 200x60: header stats, four-row Flows block above the rule, Tab+Up onto 'Starts the browser map', Enter lit it (accent ▌ on the row, footer 'Starts the browser map   s step   x clear'). Fixture test: Up from the first tree row reaches the flow row, Enter lights with focus kept, Right exits to the map, Down returns to the tree and Enter still selects. bunx tsc clean, bun test 156 pass.

Cold simplicity review: applied the accept-worthy index-based branch in reduceTree (index < commands.length decides the seam; direct fetch replaces two linear scans and the unreachable cursor guard) and the wordmark-constant nit in chrome.ts. The shared observedSystem helper nit was noted but skipped to keep this diff TUI-scoped; the {id, title} mapping stays as the reviewer accepted. Post-review: bunx tsc clean, bun test 156 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI chrome now surfaces the world: the hierarchy pane opens with a Flows block (every person command, deduped) sharing one cursor space with the tree, so Up crosses the seam, Enter lights the walk with the accent-marked active row, and Right returns to the map; the header shows 'Groma · 4 flows · 35 elements' style live stats after the wordmark. Verified with a navigation fixture test (seam crossing, pick, Right exit, tree select with the walk surviving) and agent-tty at 120x36 and 200x60 (flows block, stats, and a pane pick lighting the footer). bunx tsc clean, bun test 156 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
