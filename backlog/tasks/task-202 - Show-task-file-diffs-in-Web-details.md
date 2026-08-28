---
id: TASK-202
title: Show task file diffs in Web details
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 21:13'
updated_date: '2026-08-28 06:26'
labels: []
dependencies: []
references:
  - cli-git
  - web-server
  - shell
  - render
  - page
  - source-viewer
  - web-viewer-details
  - task-diff
  - button
  - highlight
modified_files:
  - package.json
  - bun.lock
  - src/history/git.ts
  - src/viewers/web/task-diff/project.ts
  - src/viewers/web/task-diff/read.ts
  - src/viewers/web/server.ts
  - src/viewers/web/source/highlight.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/atoms/button.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/task-diff.test.ts
  - test-bun/web-live.test.ts
  - groma/observed/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/observed/systems/groma/containers/web-viewer/components/button.md
  - groma/observed/systems/groma/containers/web-viewer/components/highlight.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer selects a Backlog task in the Web viewer, its details pane shows the real changes for the task's recorded modified files without leaving the architecture context. The diff reuses Groma's source-viewer language and themes, identifies added, modified, deleted, and shared files clearly, and never presents another task's changes as owned by the selected task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a task shows each recorded modified file with an added, modified, deleted, unchanged, or shared state and added/removed line counts
- [x] #2 Opening a changed file shows a read-only unified diff with old and new line numbers, context rows, added rows, and removed rows inside the task details pane
- [x] #3 Every diff states an exact source identity; completed tasks use their exact task commit and active shared files are not misrepresented as task-owned changes
- [x] #4 Diff data loads on demand and does not enlarge the initial architecture or work payload
- [x] #5 Light, dark, and blueprint themes render a readable Groma-owned diff treatment that reuses the source-viewer syntax system
- [x] #6 Focused tests cover task commit resolution, file states, line projection, on-demand loading, and the selected task remaining active while files open
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
1. Resolve one honest diff source: a Done task's exact task commit, or HEAD versus the working tree for active tasks; mark a file Shared when another active task records it. 2. Add jsdiff and a task-diff read/projection domain that returns file states, counts, and unified hunks through an on-demand endpoint without changing the boot/work payload. 3. Reuse the source-viewer highlighter and details shell; replace passive modified-file rows with status rows and render the selected file's unified diff in a 640 px task pane. 4. Give added, removed, modified, deleted, unchanged, and shared states theme-owned Groma styling across light, dark, and blueprint. 5. Cover commit resolution, active/shared status, hunk projection, endpoint loading, and task selection with focused tests; run browser QA and bun run check, then perform the cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture decision approved by Alex: completed tasks use their exact task commit; active tasks use HEAD versus the working tree, and files recorded by several active tasks are explicitly labeled Shared instead of being misrepresented as task-owned. jsdiff is preferred over Pierre so Groma owns the DOM, source highlighting, and all three theme treatments.

Implemented the approved hybrid source rule through one on-demand endpoint and a grouped task-diff domain. Completed tasks resolve the exact `<task id> - <title>` commit; active tasks compare the full HEAD SHA with the working tree and mark overlapping active-task files Shared. jsdiff 9.0.0 projects only the unified hunks the browser needs.

Reused and simplified existing architecture: task painting moved out of the general details organism; source and diff views now share one syntax highlighter, one file-viewer shell, and one `chromeButton` atom. The source view lost 76 local lines and the details organism lost 66 task-specific lines. Loading rows use an explicit pending state so they never briefly claim that files are unchanged.

Focused tests pass for exact completed-task commits, active/shared file states, hunk line projection, and on-demand server loading. `bun run check` passes with 81 core and 192 viewer tests. Browser QA at 640 px passed in light, dark, and blueprint: Git status/count rows, Shared labels, unified old/new line columns, syntax treatment, 32 px Back control, unchanged task URL/selection, and no console warnings or errors.

Cold simplicity review: the flow is task selection → one task-diff request → exact Git versions → jsdiff projection → Groma DOM view; file opening changes only local task-diff state. The read/project/control/view split follows concrete server, pure projection, interaction, and rendering responsibilities. No compatibility, fallback, generic diff framework, second renderer, or boot-payload fields were added. No further deletion or collapse would keep the projection independently testable and the browser/server boundary clear.

Correction after visual review: the task summary no longer sets the expanded details width. Browser measurement now shows the standard task pane at 409.6 px, the opened file diff at 640 px, and Back returning it to 409.6 px while preserving `?task=TASK-202`. The final `bun run check` passes with 81 core and 192 viewer tests; two earlier full-suite attempts exposed unrelated watch-test timing flakes, and both affected files passed immediately in isolation before the clean full run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added on-demand Git diffs to Web task details with A/M/D/shared states, line counts, exact commit or working-tree identity, and themed unified hunks. Reused the source syntax treatment and shared chrome button, kept the normal task summary at the standard pane width, and expands only opened files to 640 px. Verified with browser measurements and interaction checks across all three themes, `bun run check`, 81 core tests, and 192 viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
