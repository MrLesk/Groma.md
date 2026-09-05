---
id: TASK-248
title: Polish the web header and search Backlog tasks
status: Done
assignee:
  - codex
created_date: '2026-09-05 13:06'
updated_date: '2026-09-05 14:05'
labels: []
dependencies: []
references:
  - web-shell
  - control
  - session
  - view
  - work-overlay
  - search
  - render
  - page
  - stats
  - revision-history
modified_files:
  - features/web-search.feature
  - src/search.ts
  - src/viewers/web/search/model.ts
  - src/viewers/web/search/control.ts
  - src/viewers/web/search/session.ts
  - src/viewers/web/search/view.ts
  - src/viewers/web/work/selection.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/stats.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/chrome/credits.ts
  - test-bun/web-search.test.ts
  - test-bun/work-selection.test.ts
  - docs/viewers/web/index.md
  - groma/systems/groma/containers/web-viewer/components/control.md
  - groma/systems/groma/containers/web-viewer/components/session.md
  - groma/systems/groma/containers/web-viewer/components/view.md
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses the web header, Groma groups project and revision context on the left, a stable search field in the middle, and Fit/zoom, Theme, Help and Credits on the right. Controls use consistent spacing and heights; counts are quieter and the search menu is easier to read. When an optional work-source plugin supplies tasks, the same search finds task IDs and titles across statuses, including unmapped tasks, and opens existing task details and mapped highlights. Architecture search remains independent of Backlog. Alex approved this example on 2026-09-05. No PRs; use the shared main workspace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Header context, search, and view/utilities follow the approved order; opening search does not shift adjacent controls.
- [x] #2 One search finds architecture and plugin-supplied tasks by ID/title across all statuses, including tasks without map pins; task rows identify ID and status.
- [x] #3 Accepting a task result opens the existing task details and highlights mapped architecture when available.
- [x] #4 Without a work-source plugin, architecture search works normally; core architecture search has no Backlog coupling.
- [x] #5 Search keeps its keyboard navigation, temporary preview, cancel restoration, and a readable result surface.
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
1. Keep core search architecture-only; expose match relevance so a Web search model can merge it with optional WorkItem summaries from the existing plugin boundary. Search all supplied task IDs and titles without status or map-pin filtering.
2. Keep one search session for temporary map previews, keyboard navigation and cancel restoration. Route task acceptance through the existing Work selection/details/highlight path and refresh task search on work updates without rebuilding the map.
3. Place project and revision context left, a stable search field in the middle, and Fit/zoom, Theme, Help and Credits right. Reuse existing controls and improve the search surface while removing obsolete expanding-field state.
4. Record the approved flow in Gherkin, add focused ranking and task-selection tests, update Web docs and affected architecture through Groma. Preserve TASK-247 hunks in shared files.
5. Verify mapped/unmapped task search, missing plugin, live updates, keyboard cancel, and stable header layout in the browser. Run bun run check; simplify, review specification and quality, then obtain the full-context complexity review for Alex before completion.

6. Keep query changes unselected and camera-stable; only arrow navigation previews a result. Enter explicitly opens the first result when no row was chosen. Verify typing, arrows, clearing and acceptance in the browser.

7. Give the header popups a shared 12-pixel visual gap beneath the header, including Search, Help, Credits and Revision; verify the popup bounds in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex approved the header grouping and unified task search on 2026-09-05, explicitly requiring optional plugin ownership and no Backlog coupling in core. TASK-247 coordinator confirmed page.ts, shell.ts and Web docs are stable for separate header/search edits; its scroll and Back-button hunks must remain untouched and unstaged.

Validation: 17 focused search/selection tests pass; all 14 changed TypeScript files pass Biome; git diff --check is clean. Browser evidence at 1440 and 900 pixels confirms unchanged header rectangles during search, task ID/title acceptance, repeated task opening, mixed architecture/task results, scrolling past five rows, exact Escape camera/selection restoration, light/dark result surfaces, and Fit/zoom controls. A separate EMPTY_WORK_SOURCE preview found and opened architecture without task results. Unit tests cover custom plugin statuses, unmapped work, and task-only index updates. Full check was run after the final cleanup: it stops on type errors in active unrelated TUI work. Running both suites with server/watcher permissions gives 104/104 Node passes and 273/288 viewer passes; all 15 remaining failures are in terminal navigation/work/source/history tests. No Web test failed. Logs: /private/tmp/task248-check-final.log and /private/tmp/task248-tests-final.log. Temporary preview servers were stopped and browser viewport restored.

Subtraction review removed obsolete search expansion CSS/lifecycle and shared task acceptance with existing work selection. Specification and quality reviews found no supported-flow defect. The final full-context reviewer recommended no material architecture changes: core remains architecture-only, Web search owns task merging, session owns preview, Work owns opening. Its one local cleanup was applied: Clear now uses the existing query reset path. Focused tests and changed-file lint passed afterward.

Alex reported that automatic top-result preview moves the map while typing. Reopened this task to remove that automatic preview and start each result list without a selected row.

Alex also requested floating Search, Help, Credits and Revision popups below the header.

Correction verified in the browser: b, ba, back and backlog leave the exact camera transform unchanged, with zero selected rows and no aria active result. Down selects the first result; editing the query clears that selection. Clear works, and Enter without arrow selection opens TASK-248. Search, Help, Credits and Revision popup bounds each show a 12px gap below the header. Full bun run check passes (104 Node tests and 291 viewer tests). An earlier run had one watcher timeout; the final complete run passed. Self subtraction/specification/quality review and final full-context correction review found no material concerns. Evidence: /private/tmp/task248-correction-check.log and /private/tmp/task248-qa/06-floating-search.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Polished the Web header with permanent unified architecture/optional task search and consistently floating popups. Typing updates results without selecting or previewing a match or moving the camera; arrows explicitly preview and Enter or click opens existing details. Core stays independent of Backlog. Browser verification and the full bun run check pass; complexity review found no material concerns.
<!-- SECTION:FINAL_SUMMARY:END -->
