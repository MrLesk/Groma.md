---
id: TASK-326.3
title: Guide official scanner installation and project readiness
status: Done
assignee:
  - '@scanner_installation'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-12 14:25'
labels:
  - scanners
dependencies:
  - TASK-326.1
  - TASK-326.4
  - TASK-326.9
references:
  - TASK-228.2
  - TASK-228.3
  - TASK-322
  - 'https://github.com/MrLesk/Groma.md/tree/research/csharp-scanner-prototype'
  - ../callforpapers
  - TASK-326.8
  - TASK-326.9
  - scan-observation
  - scan-lifecycle
  - c-scanner
  - scanner-modules
  - init-command
  - scan
  - web-server
  - viewer-semantics
  - web-shell
  - terminal-painting
  - java-src-scanner-index
  - angular-src-scanner-index
  - TASK-352
  - TASK-356
documentation:
  - docs/scanners/index.md
  - docs/component-markdown.md
modified_files:
  - packages/scanner/src/index.ts
  - src/scanner/registry.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/csharp/src/index.ts
  - src/scanner/modules/readiness.ts
  - src/scanner/modules/setup.ts
  - src/init-command.ts
  - src/init-command-ui.ts
  - test/init-ui-helpers.ts
  - src/scanner/cli.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/src/index.ts
  - src/viewers/web/server.ts
  - src/viewers/web/startup/page.ts
  - src/empty-world.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/tui/organisms/empty.ts
  - test-bun/web-startup.test.ts
  - test/initialize.test.ts
  - test-bun/scanner-setup.test.ts
  - docs/scanners/setup.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/viewers/tui/index.md
  - docs/viewers/web/index.md
parent_task_id: TASK-326
type: feature
ordinal: 364000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer needs one discover, select, install and readiness journey before scanning a project with multiple technologies. Reuse scanner management and exact-version installation, keep project tooling requirements explicit, and support interactive and non-interactive entry points. This task covers the implemented journey and its accepted prepared-package callforpapers example. Running that journey with publicly published official packages belongs to TASK-356.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before the initial scan, users can see discovered technologies and evidence locations, available support, recommended official packages, and coverage gaps in one proposal, then accept or adjust the selected plugins.
- [x] #2 Only the explicitly selected plugins are installed/enabled through the existing scanner management flow, with exact versions recorded for another developer or CI environment to restore.
- [x] #3 Readiness distinguishes an available scanner package from a ready project, and reports the plugin's concrete missing-tool or preparation instructions without silently provisioning a development environment.
- [x] #4 The non-interactive path reports recommendations and supports explicit installation and scanning without waiting for input.
- [x] #5 The prepared callforpapers example completes the implemented installation, readiness and first-scan path with Java, Angular and embedded TypeScript, and its company-merge architecture result has the recorded coordinator-authorized review. Public-package delivery is owned by TASK-356.
- [x] #6 Rerunning the journey proposes relevant additions while preserving existing selections; startup and empty-project guidance in the current viewers and plain output no longer incorrectly claim that only TypeScript is supported.
- [x] #7 Declining a new recommendation does not enable it; an enabled scanner failure remains explicit and preserves the existing architecture rather than presenting a partial update as complete.
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
Reuse discovery, scanner selection and exact-version installation in initialization and scanner setup. Delegate readiness to each plugin and expose the same steps through non-interactive commands. Validate the prepared callforpapers packages and review the Web, terminal and empty-project guidance. Public delivery is tracked in TASK-356.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation uses one shared discovery/selection installer and plugin readiness report. Browser setup uses two explicit submissions so a non-Git directory initializes before Git-based discovery and no scan precedes review. Focused selection/readiness, init, web startup, Angular, and composition tests pass; scoped Biome, typecheck, and scrollbar check pass. Compiled CLI and fresh local Java/Angular packages exercised on the prepared acceptance copy: discover, explicit local add, setup --no-interactive, check, scan all exited 0 with embedded TypeScript + Angular + Java ready. All existing architecture Markdown hashes are unchanged. Evidence: /tmp/groma-task3263-proof/acceptance-cli.log, before-architecture.json, after-architecture.json; TUI empty guidance at 120x36 and 200x60 captured in empty-120.svg and empty-200.svg. Public catalog intentionally has no invented releases, so public-release installation and human acceptance remain coordinator gates.

Cold simplicity review passed without required simplifications. Own specification review: implemented AC1/2/3/4/6/7 have focused evidence; AC5 and public-release installation remain open because the catalog has no qualified optional release and human architecture acceptance belongs to the coordinator. Own quality review found no blocking code defect. Native browser completed Continue -> proposal -> zero-selection readiness/scan -> empty map. Corrected observed proposal step highlight and empty selection fieldset, plus stale viewer documentation. Repeated browser startup tests pass (7/7). Starting the coordinator-granted exclusive repository check.

Exclusive repository check passed: bun run check, Node 110/110 and Bun 386 passed, 1 skipped, 0 failed. The skip is the existing opt-in Java Maven test; the real prepared-copy Java readiness and scan succeeded separately. Six existing complexity warnings are outside changed files; no new warning. Full log: /tmp/groma-task3263-proof/check.log. Final native browser proposal at http://localhost:4794 shows the correct active step, evidence, retained TypeScript, and truthful unavailable Java/Angular candidates; completed empty-map flow is at http://localhost:4793. Task-owned final diff: /tmp/groma-task3263-proof/task-owned.diff. Awaiting coordinator full-context review and acceptance/release decisions; task remains In Progress.

Final full-context complexity review passed with no required changes. Coordinator approved the browser proposal and completed empty map plus TUI guidance. The prior Angular company-merge human review and unchanged acceptance-copy architecture hashes cover the local map result. AC1: browser/init sequencing and reviewed proposal; AC2: exact package installer fixture and persisted selection; AC3: package/project readiness fixture and real three-plugin check; AC4: noninteractive fixture plus compiled explicit commands; AC6: retained-selection fixture and coordinator viewer review; AC7: declined-package fixture and existing failed-scan architecture-preservation tests. AC5 and Definition of Done 1 remain open solely for the real qualified public-package acceptance journey. Verified implementation is ready for a scoped commit while task status stays In Progress.

Scope reconciliation approved by Alex on 2026-09-12: close the accepted implementation/local-evidence scope, apply TASK-352 removal of package qualification and CI test requirements, and consolidate all remaining public delivery in TASK-356. Revised criteria describe recorded completed behavior; older notes about waiting for publication or rebuilding qualification automation are superseded. Historical evidence and modified-file traceability are preserved. No source files or tests were changed or rerun for this task-record cleanup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The installation and readiness implementation is complete, supported by the recorded compiled Java/Angular/TypeScript run, preserved architecture, browser/TUI acceptance, full-context review and repository check. The remaining public-package journey is consolidated in TASK-356.
<!-- SECTION:FINAL_SUMMARY:END -->
