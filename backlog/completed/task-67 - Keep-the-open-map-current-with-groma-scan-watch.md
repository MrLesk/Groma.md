---
id: TASK-67
title: Keep the open map current with groma scan --watch
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:58'
updated_date: '2026-08-16 20:15'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/scanner.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/web/server.ts
  - src/typescript-files.ts
documentation:
  - docs/product-model.md
  - docs/scanners/index.md
  - docs/viewers/index.md
priority: high
type: feature
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person runs `groma view` or `groma web`, that live process stays current with source. It starts the same watch as `groma scan --watch` in-process: a watched TypeScript change runs one full scan, Core folds Markdown, and the map applies the new world without pressing R or refreshing the browser. Opening a viewer shows the world already in Markdown and does not scan. `groma scan --watch` is the same watch without a map and prints `ok` plus a summary on each fold. Selection stays if that box still exists. `R` still reloads the world from Markdown without scanning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma scan --watch watches the TypeScript plugin file set, folds each settled source change, prints ok plus a summary, and does not open a viewer
- [x] #2 groma view starts that same watch in-process, does not scan on open, and updates the map after a watched TypeScript change without pressing R
- [x] #3 groma web starts that same watch in-process, does not scan on open, and updates the city after a watched TypeScript change without a browser refresh
- [x] #4 After a live fold the current selection stays if that box still exists
- [x] #5 R still reloads the world from Markdown without scanning
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
1. Export a TypeScript scan-file predicate from the plugin glob and ignore lists.
2. Add watchScan: recursive source watch, debounce, one full scanRepository per settled matching change, no scan on start, closeable. Ignore node_modules, .git, and files the plugin would not read.
3. Add groma scan --watch that starts that watch and prints ok plus a summary after each fold.
4. startTerminalViewer starts the same watch in-process and applies each fold through the existing refresh path. Destroy closes the watch. No scan on open. R still only reloads Markdown.
5. startWebViewer starts the same watch, reloads the world after each fold, and pushes generation plus world over SSE. The browser replaces the city and keeps the selection if that id remains. No scan on open.
6. Update product, scanner, and viewer docs. Add focused tests for ignored files, a settled fold, TUI live apply with selection kept, web world payload, and R not scanning.

Watch only non-groma top-level source directories so architecture Markdown writes do not swallow source events.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review: entry is groma view/web/scan --watch; work is watchScan debounce plus one full scanRepository; result is a new world applied through existing TUI refresh or web SSE. Watchers skip groma, node_modules, and .git. No fingerprint engine. /world.json is the test read of the same snapshot SSE publishes.

Verification: bun run check (tsc; 63 node tests including scan --watch and watchScan; 43 bun tests including viewer-live and web-live). Chrome DevTools MCP could not attach to a browser, so the Three.js city rebuild was not clicked through; web-live proved the live world payload updates without refetching the page.

R still only calls loadArchitectureViewModel. View and web do not scan on open.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A live groma view or groma web process starts the same watch as groma scan --watch. A settled TypeScript change runs one full scan, Core folds Markdown, and the open map applies the new world without R or a browser refresh. Opening a viewer still shows the current Markdown and does not scan. R still reloads Markdown only.

Verified with bun run check: CLI --watch prints ok and stays open; watchScan ignores plugin test files; TUI and web apply an imported new component and keep the previous selection; R still applies a Markdown heading change without scanning.
<!-- SECTION:FINAL_SUMMARY:END -->
