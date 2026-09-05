---
id: TASK-238.10
title: Open source and diffs in the details pane
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 21:04'
updated_date: '2026-09-05 15:23'
labels:
  - tui
  - core
dependencies:
  - TASK-238.2
  - TASK-242
references:
  - navigation
  - details
  - source-viewer
  - task-diff
  - terminal-host
  - screen
  - web-server
  - web-viewer-details
  - read-read
modified_files:
  - src/viewers/source/read.ts
  - src/viewers/source/structure.ts
  - src/viewers/source/diff.ts
  - src/viewers/source/diff-lines.ts
  - src/viewers/web/source/read.ts
  - src/viewers/web/source/structure.ts
  - src/viewers/web/task-diff/read.ts
  - src/viewers/web/task-diff/project.ts
  - src/viewers/web/data.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/export.ts
  - src/viewers/web/server.ts
  - src/viewers/web/organisms/code-lists.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/source/control.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/task-diff/view.ts
  - test-bun/task-diff.test.ts
  - test/fixtures/source-view/groma/index.md
  - test/fixtures/source-view/groma/project.md
  - test/fixtures/source-view/groma/systems/shop/system.md
  - test/fixtures/source-view/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/source-view/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/source-view/src/orders.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/view-host.ts
  - docs/viewers/tui/index.md
  - src/viewers/tui/navigation-details.ts
  - test-bun/tui-source.test.ts
  - groma/systems/groma/containers/read/components/read-read.md
  - groma/systems/groma/containers/view-host/components/read-read.md
  - groma/systems/groma/containers/structure/components/structure-structure.md
  - groma/systems/groma/containers/view-host/components/structure-structure.md
  - groma/systems/groma/containers/terminal-viewer/components/diff.md
  - groma/systems/groma/containers/view-host/components/diff.md
  - groma/systems/groma/containers/terminal-viewer/components/diff-lines.md
  - groma/systems/groma/containers/view-host/components/diff-lines.md
  - groma/systems/groma/containers/read/container.md
  - groma/systems/groma/containers/structure/container.md
  - groma/systems/groma/containers/view-host/container.md
  - groma/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/systems/groma/containers/terminal-viewer/components/details.md
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 272000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a component is selected, the Code section of the details pane lists each file with its line count and the declarations under it, as the browser How it is built tab does. Enter on a declaration opens the source read-only in the details pane at that line; Enter on a modified file of a task opens its unified diff; Escape returns to the previous details. The source, structure and diff readers move from the web plugin to the shared viewer layer so both viewers call one reader; the browser keeps its behaviour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Code section lists each file with its line count and the declarations under it in authored order
- [x] #2 Enter on a declaration shows the source read-only at that line inside the details pane; Escape returns
- [x] #3 Enter on a modified file of a selected task shows its unified diff inside the details pane; Escape returns
- [x] #4 The source, structure and diff readers live in the shared viewer layer and the web viewer calls the same readers with unchanged behaviour
- [x] #5 Tests cover the Code section, the source view and the diff view from fixtures under test/fixtures
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
1. The readers move from the web plugin to src/viewers/source (read.ts, structure.ts, diff.ts with its line projection), taking a Git revision id instead of the web payload's revision; the web server, data, payload, export and details modules import them from there and behave as before.
2. The host wires three readers into the terminal viewer beside readTask: readStructure(elementId), readSource(elementId, file) and readDiff(taskId, file), all against the working tree until TASK-238.11 adds revisions.
3. The How tab's Code section lists each file with its line count and, once the structure arrives, its declarations in authored order: functions with (), classes with their members indented, each with its line; the details cursor walks the declarations after the walks; Enter opens the source read-only in the pane scrolled to that line and Escape returns.
4. A task's record lists its modified files as cursor stops; Enter on one shows the file's unified diff in the pane (added and removed lines marked) and Escape returns.
5. A fixture under test/fixtures with one TypeScript file backs a reader test; the terminal tests use stub readers to cover the Code section, the source view scrolled to its line and the diff view. Docs: the details section.

6. Curate the four shared reader files into one Source inspection component under View host, remove the scanner-created singleton containers, and relate the browser source/diff controls and terminal details to that shared responsibility.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: focused terminal/source/diff/navigation/lifecycle suite passes 19/19. Full bun run check passes outside the sandbox: 106 Node tests and 263 Bun tests; 13 existing complexity warnings remain non-failing. A real local web server returned 200 for the page, shared code structure, source, and task-diff endpoints. tui-test verified root and container layouts at 120x36. Cold simplicity review passed after reducing the source fixture from sixteen files to the minimum six and making detailsStops private. Full-context complexity review keeps the code design but blocks finalization: Groma records retain deleted web reader paths, split shared readers into file-shaped domains, and two scans do not reconcile moved/deleted scanner-owned Code references. Proposed prerequisite: make scanner reconciliation remove stale scanner-owned file references, then curate src/viewers/source/* as one Source inspection component under View host.

Final architecture repair: TASK-242 made scanner reconciliation remove stale scanner-owned paths. Groma then combined read.ts, structure.ts, diff.ts, and diff-lines.ts as one Source inspection component under View host, removed the empty Read and Structure containers, and added explicit dependencies from browser Source viewer, browser Task diff, and terminal Details. Two consecutive scans created 0 components and refreshed 99; every shared reader path resolves to read-read and the deleted IDs are absent. Final focused verification passes 25/25. The first full check had one native web-watch timeout; that exact test passed alone in 1.0 s, and the repeated full check passed with 106 Node and 266 Bun tests. The targeted full-context re-review confirms the blocking architecture finding is resolved; its obsolete task-reference finding was also removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added terminal Code, source, and task-diff drill-downs while moving all four readers into the shared viewer layer used by both terminal and browser viewers. Curated them as one Source inspection domain responsibility under View host. Verified interaction behavior with 25 focused tests, stable two-scan reconciliation, real web endpoints and tui-test sessions, and the complete 106 Node / 266 Bun repository suite.
<!-- SECTION:FINAL_SUMMARY:END -->
