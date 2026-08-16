---
id: TASK-69
title: Apply architecture Markdown changes on the open map
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 20:27'
updated_date: '2026-08-16 20:28'
labels: []
dependencies: []
references:
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/web/server.ts
documentation:
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
priority: high
type: feature
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person has `groma view` or `groma web` open, a change to architecture Markdown updates the map by itself. The live process reloads the world from Core without scanning and without pressing R. `groma scan --watch` remains the source watch. R still reloads Markdown on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view redraws after an architecture Markdown change without pressing R and without scanning
- [x] #2 groma web updates the city after an architecture Markdown change without a browser refresh and without scanning
- [x] #3 R still reloads the world from Markdown without scanning
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
1. Add a closeable architecture Markdown watch on groma/observed, groma/plans, and groma/missing that notifies after a settled .md change and does not scan.
2. startTerminalViewer and startWebViewer start that watch and apply through the existing refresh / SSE world path.
3. Update viewer docs. Test a heading change updates TUI and web without R or a page refresh, and that R still reloads Markdown without scanning.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Chose automatic apply over a header banner. watchArchitecture notifies on settled .md changes under observed/plans/missing; viewers call the existing refresh/SSE path and do not scan.

Verification: bun run check. viewer-live applies Shop→Shopfront without R; web-live publishes Shopfront on /world.json without refetching /; R test still applies Markdown without creating Orders.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An open groma view or groma web now reloads the world when architecture Markdown changes. No scan, no R, no banner. Source still updates through scan --watch. R still reloads on demand.

Verified with bun run check: TUI and web apply a heading change by themselves; R still reloads Markdown without scanning.
<!-- SECTION:FINAL_SUMMARY:END -->
