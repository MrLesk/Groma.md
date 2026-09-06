---
id: TASK-84
title: 'Add flows, counts, and dark mode to the web chrome'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 20:50'
updated_date: '2026-08-17 21:33'
labels: []
dependencies: []
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web sidebar shows only the element tree and the header only the wordmark, so nothing surfaces the person commands or the size of the world at a glance. List the person commands above the element tree in the sidebar, each activatable by click, and give the header the observed system name with flow and element counts plus a light/dark toggle. Approved example: the reference demo chrome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The sidebar lists every person command above the element tree; clicking one activates its flow and the active row is highlighted
- [x] #2 The header shows the observed system name with live counts of flows and elements
- [x] #3 A header toggle switches the whole viewer between light and dark themes; map, chrome, and details all follow
- [x] #4 Sidebar flow activation and the theme switch are covered by fixture tests and bun test passes
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
1. action-path.ts: extract worldCommands(world) (every person command, deduped); travelledBy filters it.
2. theme.ts: light and dark Palette records with mutable current bindings and setPalette; accent stays the fixed brand green; cssBlock(palette) renders the CSS custom properties; shadow ink and row hover join the palette.
3. page.ts: root gets light vars, [data-theme=dark] the dark ones; header becomes lockup, stats span (flex 1), flow controls, theme toggle button; sidebar nav gains a #flows list above #tree; shadow.ts and grid.ts read palette bindings; hatch.ts rebuilds its texture cache when the palette changes.
4. render.ts: paintFlows (new organisms/flows.ts) lists commands with the active one highlighted, click picks the flow; paintChrome writes 'system · N flows · M elements'; rebuildCity extracted from applyWorld; theme toggle flips data-theme, setPalette, scene background, and rebuilds.
5. Tests: worldCommands dedup/order fixture test; setPalette swaps and restores the live bindings. bunx tsc, bun test, browser check of sidebar picks, stats, and both themes across map, chrome, details.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
worldCommands extracted in action-path.ts (travelledBy now filters it). New organisms/flows.ts paints the sidebar flow list above the tree; header gains a stats span (system · N flows · M elements) and a Dark/Light toggle. theme.ts holds light and dark Palette records with mutable live bindings and setPalette; cssBlock renders the CSS vars for :root and [data-theme=dark]; shadow ink, grid line, and row hover joined the palette; hatch.ts rebuilds its texture cache when the palette changes; the lockup already uses currentColor. render.ts: rebuildCity extracted from applyWorld; the toggle sets data-theme, swaps the palette, resets scene background, and rebuilds. Browser evidence on 4791: stats 'Groma · 4 flows · 35 elements'; four flow rows; clicking one activates and highlights it and the header names it; dark screenshots show dark map+chrome+details with green flow dots and light labels; toggling back restores light with the flow still active. bunx tsc clean, bun test 153 pass.

Cold simplicity review: applied the accept-worthy deletion of the accent color-literal assertion (test rules forbid asserting colors; the invariant is structural) and both nits (paintChrome renamed paintStats, hatch cache key compares the raw numbers). Post-review: bunx tsc clean, bun test 153 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web chrome now surfaces the world: the sidebar opens with every person command (worldCommands, deduped; clicking activates the flow and highlights the row), the header shows 'Groma · 4 flows · 35 elements' style live stats, and a Dark/Light toggle swaps the entire viewer via palette live bindings plus one city rebuild, with CSS vars for the chrome and a palette-keyed hatch texture cache; the brand green stays fixed. Verified with fixture tests (worldCommands dedup/order, setPalette swap; bun test 153 pass, bunx tsc clean) and browser checks: flow pick from the sidebar, correct stats, dark and light screenshots of map, chrome, and details with an active flow surviving the toggle.
<!-- SECTION:FINAL_SUMMARY:END -->
