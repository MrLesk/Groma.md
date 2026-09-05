---
id: TASK-267
title: Guide Web and TUI startup through initialization and empty projects
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 18:30'
updated_date: '2026-09-05 18:59'
labels: []
dependencies: []
references:
  - init-command
  - project-initialization
  - web-server
  - commands
  - page
  - screen
  - scan-lifecycle
  - viewer-semantics
  - web-shell
documentation:
  - docs/product-model.md
modified_files:
  - features/startup.feature
  - src/initialize.ts
  - src/init-command.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/server.ts
  - src/viewers/web/startup/page.ts
  - src/cli.ts
  - src/empty-world.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/page.ts
  - src/viewers/tui/panes/view.ts
  - test/fixtures/startup-source/package.json
  - test/fixtures/startup-source/src/main.ts
  - test/first-run.test.ts
  - test-bun/web-startup.test.ts
  - test-bun/web-first-run.test.ts
  - test-bun/web-live.test.ts
  - src/scanner.ts
  - docs/product-model.md
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - groma/systems/groma/containers/web-viewer/components/web-server.md
  - groma/systems/groma/containers/web-viewer/components/map-session.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-page.md
  - test-bun/viewer-lifecycle.test.ts
type: feature
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs groma web or interactive groma view, Groma guides them through missing initialization and a successful scan with no components instead of exposing a stack trace or unexplained blank map. The Web entry point presents setup in the browser using the existing project initialization behavior; the TUI uses the existing terminal setup. Reproduced example: ../backlog.md has a .groma directory with no index.md or project.md, so the directory-only readiness check incorrectly proceeds and view --plain throws ArchitectureReadError. Initialization, scanning, and the viewer should form one understandable startup flow without duplicating architecture ownership.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A missing Groma directory or a directory missing the required initialization records leads to setup, including the reproduced .groma case, rather than a raw stack trace.
- [x] #2 groma web serves a styled browser setup flow that uses the existing initialization operation, runs the initial scan automatically, and opens the map when components are found.
- [x] #3 Interactive groma view uses the same readiness decision, completes terminal initialization when needed, scans automatically, and shows the terminal map or clear no-components guidance.
- [x] #4 A successful scan with no components shows actionable guidance in both viewers; existing drafted architecture remains accessible and a scan failure is not described as an empty project.
- [x] #5 Plain terminal inspection gives one actionable initialization message without a stack trace; fixture checks cover startup transitions and the reproduced failure, real Web and TUI flows are verified, and bun run check passes.
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
1. Use gromaInitialization to report the existing architecture folder and whether its required index and project records exist; keep all initialization writes in initializeGroma. 2. Let one Web HTTP server serve browser setup or startup errors, then hand requests to the existing ready-map session after initialization and automatic scan. Browser setup collects project name and architecture folder without package installation. 3. Share no-components guidance, keep existing architecture accessible, and register newly created top-level source directories with the scan watch. 4. Verify fixture startup transitions and real browser/TUI flows, update product and viewer documentation, curate the implementation under the existing Web server component, pass bun run check, perform cold simplicity review, implementer specification/quality reviews, and final full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Read-only reproduction: ../backlog.md/.groma exists with observed/, plans/, missing/ but no index.md or project.md. ensureInitialized only checks directory presence; view --plain fails with ArchitectureReadError for .groma/index.md. Existing initialization, empty states, and first-run tests are the reuse points. Optional browser Backlog installation was raised with Alex; recommended scope is project identity and storage, then automatic scan. No source edits yet. TASK-266 currently owns relationship details; avoid its files unless a concrete overlap is necessary.

Focused Web test reproduced a supported empty-project failure: creating the first src directory after startup does not refresh the map, because watchScan watches only initial top-level directories and ignores directory creation. Fix the source-watch registration for newly created top-level source directories so the promised create-code transition works. This is a reproduced failure in AC4, not speculative filesystem handling.

Cold simplicity review passed: setup reuses initialization and extracts only the existing ready-map session; no material simplification was recommended. Full checks identified obsolete empty-state prose tests and a storage-layer import at the Web boundary. Replaced the direct storage lookup with the shared gromaInitialization result; reduced the lifecycle test to the empty-to-ready transition and removed its redundant prose-only test. Browser setup, draft access, live first-source update, and styled failure page were exercised. tui-test verified partial-folder setup, empty guidance, live first-source update, component navigation, and screenshots at 120x36 and 200x60.

Implementer specification review: the shared readiness result handles the reproduced missing index/project records; browser and terminal setup use initializeGroma; automatic scan precedes the map; no-components guidance preserves drafted architecture; plain inspection in ../backlog.md prints only the initialization instruction. Implementer quality review: setup has one host owner, map handlers are moved without changing their contract, architecture writes still use the authoring table, initialization remains in core, test fixtures are isolated, and changed files stay below 500 lines. No blocking startup defect remains. The first-source watch test passed eight isolated runs and four complete viewer suites with diagnostic tracing; temporary diagnostics were removed. A subsequent full check passed startup but hit an existing concurrent architecture-read/delete failure in web-authoring; the required check is being repeated.

After diagnostics were removed, the first-source startup transition passed both subsequent full checks. Those runs instead hit unrelated existing test failures: an architecture read racing actor removal, and the large-world generator exceeding its 20-second timeout under load. No recovery logic or timeout change was added to this task.

Full-context complexity review passed: no blocking startup defect, material architecture recommendation, or further simplification to discuss. Keep the shared initialization operation, small startup host, and existing ready-map session. Startup remains application behavior owned by the existing Web server component; ordinary OKF readers still see the same Markdown records and C4 boundaries.

The unchanged large-world suite passes alone: 6/6 tests in 7.95 seconds, including its generator. All 105 Node tests, startup tests, and the other viewer tests pass in the latest full run; only the large-world timeout prevented that run from completing successfully.

Final required bun run check passed: 105/105 Node tests and 304/304 Bun tests; TypeScript and lint checks completed. Biome reports eight existing complexity warnings outside the changed startup code. git diff --check is clean. Both cold simplicity and final full-context complexity reviews passed. Browser setup, automatic scan, drafted architecture access, empty-to-first-component updates, styled startup errors, and terminal setup/navigation at two sizes were verified. The sibling Backlog repository was inspected read-only and was not modified.

Removed the now-unused page escape import noticed during shared-file coordination. The earlier final lint count included that harmless warning; the remaining warnings are outside this task.

Final check after the unused-import cleanup passed: bun run check completed with 105 Node tests and 304 Bun tests, zero failures, and seven pre-existing lint warnings. Both shared files are staged using only this task’s startup hunks; TASK-268 working changes remain unstaged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web startup now presents styled project setup when initialization records are missing, then scans and opens the map at the same address. TUI startup uses the same readiness decision and its terminal wizard. Both viewers explain missing components while keeping existing architecture accessible, and first source directories trigger live scans. Startup failures show readable errors instead of stack traces. Verified with isolated fixtures, real browser and tui-test flows, 105 Node tests, 304 Bun tests, and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
