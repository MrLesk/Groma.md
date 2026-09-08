---
id: TASK-326.3
title: Guide official scanner installation and project readiness
status: In Progress
assignee:
  - '@scanner_installation'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-08 22:27'
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
  - scanner-index
  - c-scanner
  - scanner-modules
  - init-command
  - scan
  - scanner-index-2
  - web-server
  - viewer-semantics
  - web-shell
  - terminal-painting
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
During initialization, a developer reviews the discovered technologies and recommended official plugins, accepts or adjusts one proposal, and reaches the first scan. Existing projects can run the same discovery/selection journey again when their technologies change. Reuse the existing exact-version scanner installation and project configuration rather than creating another package manager.

Start from the scanner management already in main and reuse suitable optional setup/readiness work from research/csharp-scanner-prototype. Distinguish package availability from the installed language tools and project preparation needed to scan. Language plugins own those checks; Groma presents their results consistently. Project SDK installation and project dependency preparation remain explicit user/tooling actions with concrete instructions when required. The Angular plugin itself carries compatible TypeScript tooling; this does not replace the project's development environment or Groma's embedded SDK.

Provide a non-interactive CI path with explicit selection and installation, without an interactive prompt or unsolicited install. Keep web, terminal, and plain empty/startup guidance consistent with actual multi-language support, replacing the current TypeScript-only claim where it conflicts with this flow. The acceptance project is ../callforpapers. Its proposal offers Java and Angular while retaining embedded TypeScript, producing three enabled scanners. Angular is a separate package with complementary framework evidence even though its file scope overlaps TypeScript.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before the initial scan, users can see discovered technologies and evidence locations, available support, recommended official packages, and coverage gaps in one proposal, then accept or adjust the selected plugins.
- [x] #2 Only the explicitly selected plugins are installed/enabled through the existing scanner management flow, with exact versions recorded for another developer or CI environment to restore.
- [x] #3 Readiness distinguishes an available scanner package from a ready project, and reports the plugin's concrete missing-tool or preparation instructions without silently provisioning a development environment.
- [x] #4 The non-interactive path reports recommendations and supports explicit installation and scanning without waiting for input.
- [ ] #5 ../callforpapers completes discovery, selection, installation, readiness, and first scan with Java, Angular, and embedded TypeScript; the supported company-merge flow has a human-reviewed architecture result.
- [x] #6 Rerunning the journey proposes relevant additions while preserving existing selections; startup and empty-project guidance in the current viewers and plain output no longer incorrectly claim that only TypeScript is supported.
- [x] #7 Declining a new recommendation does not enable it; an enabled scanner failure remains explicit and preserves the existing architecture rather than presenting a partial update as complete.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse discovery and exact-version installation in a shared review/select/install/readiness journey; preserve existing selections and keep unavailable releases unselectable.
2. Connect the journey before the terminal and browser first scan, and expose repeatable scanner setup plus explicit noninteractive scanner check/add/install/scan commands.
3. Add a small optional plugin-owned readiness hook; reuse Java and C# checks and the Angular project configuration checks without provisioning development tools.
4. Update shared empty/startup guidance and scanner documentation without changing OKF or C4 semantics.
5. Verify selection, decline, no unsolicited installation, readiness failures, and architecture preservation using independent fixtures. Exercise the compiled supported project copy, document actual release gates, and request coordinator review and serialized full checks.

Browser setup saves settings and initializes Git on the explicit first submission, then shows discovery and selected-package checkboxes before a separate readiness-and-scan submission. Discovery remains Git-based; GET does not initialize the project.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation uses one shared discovery/selection installer and plugin readiness report. Browser setup uses two explicit submissions so a non-Git directory initializes before Git-based discovery and no scan precedes review. Focused selection/readiness, init, web startup, Angular, and composition tests pass; scoped Biome, typecheck, and scrollbar check pass. Compiled CLI and fresh local Java/Angular packages exercised on the prepared acceptance copy: discover, explicit local add, setup --no-interactive, check, scan all exited 0 with embedded TypeScript + Angular + Java ready. All existing architecture Markdown hashes are unchanged. Evidence: /tmp/groma-task3263-proof/acceptance-cli.log, before-architecture.json, after-architecture.json; TUI empty guidance at 120x36 and 200x60 captured in empty-120.svg and empty-200.svg. Public catalog intentionally has no invented releases, so public-release installation and human acceptance remain coordinator gates.

Cold simplicity review passed without required simplifications. Own specification review: implemented AC1/2/3/4/6/7 have focused evidence; AC5 and public-release installation remain open because the catalog has no qualified optional release and human architecture acceptance belongs to the coordinator. Own quality review found no blocking code defect. Native browser completed Continue -> proposal -> zero-selection readiness/scan -> empty map. Corrected observed proposal step highlight and empty selection fieldset, plus stale viewer documentation. Repeated browser startup tests pass (7/7). Starting the coordinator-granted exclusive repository check.

Exclusive repository check passed: bun run check, Node 110/110 and Bun 386 passed, 1 skipped, 0 failed. The skip is the existing opt-in Java Maven test; the real prepared-copy Java readiness and scan succeeded separately. Six existing complexity warnings are outside changed files; no new warning. Full log: /tmp/groma-task3263-proof/check.log. Final native browser proposal at http://localhost:4794 shows the correct active step, evidence, retained TypeScript, and truthful unavailable Java/Angular candidates; completed empty-map flow is at http://localhost:4793. Task-owned final diff: /tmp/groma-task3263-proof/task-owned.diff. Awaiting coordinator full-context review and acceptance/release decisions; task remains In Progress.

Final full-context complexity review passed with no required changes. Coordinator approved the browser proposal and completed empty map plus TUI guidance. The prior Angular company-merge human review and unchanged acceptance-copy architecture hashes cover the local map result. AC1: browser/init sequencing and reviewed proposal; AC2: exact package installer fixture and persisted selection; AC3: package/project readiness fixture and real three-plugin check; AC4: noninteractive fixture plus compiled explicit commands; AC6: retained-selection fixture and coordinator viewer review; AC7: declined-package fixture and existing failed-scan architecture-preservation tests. AC5 and Definition of Done 1 remain open solely for the real qualified public-package acceptance journey. Verified implementation is ready for a scoped commit while task status stays In Progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one scanner review, selection, installation, and readiness journey to initialization and repeatable scanner setup. Explicit CI commands retain exact versions; plugin-owned checks do not provision project tools. Updated terminal/browser/plain guidance. Verified with bun run check (110 Node; 386 Bun passed, 1 existing skip), native browser/TUI review, and compiled Java + Angular + embedded TypeScript on the prepared project copy with unchanged architecture Markdown. The real qualified public-package journey remains open under AC5.
<!-- SECTION:FINAL_SUMMARY:END -->
