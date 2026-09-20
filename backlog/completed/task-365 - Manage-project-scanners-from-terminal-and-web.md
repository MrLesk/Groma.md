---
id: TASK-365
title: Manage project scanners from terminal and web
status: Done
assignee:
  - codex
created_date: '2026-09-13 07:46'
updated_date: '2026-09-13 08:25'
labels:
  - scanners
  - viewers
dependencies: []
references:
  - TASK-364
  - scanner-modules
  - scan-lifecycle
  - web-server
  - commands
  - terminal-host
documentation:
  - docs/scanners/setup.md
  - docs/component-markdown.md
modified_files:
  - src/scanner/registry.ts
  - src/scanner.ts
  - src/relationship-inference.ts
  - src/scan-reconciler.ts
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/modules/settings.ts
  - src/scanner/session.ts
  - src/scanner/modules/settings-model.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/server.ts
  - src/cli.ts
  - src/viewers/tui/scanner-settings.ts
  - src/welcome/view.ts
  - src/welcome/model.ts
  - src/welcome.ts
  - src/scanner/cli.ts
  - src/view-host.ts
  - src/viewers/tui/model.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/web/scanners/settings.ts
  - src/viewers/web/page.ts
  - src/viewers/web/data.ts
  - src/viewers/web/render.ts
  - src/viewers/source/scanning.ts
  - test-bun/viewer-scanner-availability.test.ts
  - test-bun/scanner-settings.test.ts
  - test-bun/partial-scan.test.ts
  - src/scanner/modules/setup.ts
  - docs/component-markdown.md
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - docs/scanners/discovery.md
  - docs/scanners/setup.md
  - test-bun/scanner-settings-lifecycle.test.ts
  - test-bun/scanner-evidence.test.ts
type: feature
ordinal: 411000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users need one project scanner flow: run installed project selections, do nothing for an empty list, and continue reading saved architecture regardless of missing scanner packages. The splash screen, direct terminal viewer and web must offer scanner settings and distinguish no useful support (warning), partial support (quiet hint), readiness problems and unknown detection. The approved visual direction preserves the current terminal command table and web toolbar/map; scanner settings use a compact list with installation state, matched project files and explicit actions. Third-party scanners use the same metadata and selection rules as official scanners. Scope is the approved React + Rust example and the existing scanner/plugin contracts, not a marketplace or new architecture concepts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Automatic and explicit scans use installed project-selected scanners; missing packages do not stop available scanners, and an empty usable observation set performs no reconciliation and an empty installed selection starts no scan subscription (live settings may observe declarations for discovery). Failed active scans preserve the previous saved result and report their problem.
- [x] #2 Partial successful scans preserve Code and derived relationships contributed by scanners absent from the batch, including mixed-scanner relationships; authored Markdown, identities and single-file ownership remain unchanged.
- [x] #3 One shared settings state combines inventory, plugin-owned project discovery and readiness. It handles missing packages, unrelated selections, unknown compatibility, tool/version failures, no matching release, no source files, exclusions, nested declarations and partial matches without claiming complete architecture coverage.
- [x] #4 Configured third-party discovery metadata participates in recommendations and coverage; equivalent known technology support avoids official duplicate recommendations, while metadata-free plugins remain explicitly usable with unknown match status.
- [x] #5 Terminal splash and direct terminal viewer can open the scanner settings screen. The approved command-table styling, warning for no useful scanners, quiet partial-support hint, selected scanner details and keyboard navigation work.
- [x] #6 Web has an always-available Scanners toolbar entry, nonblocking warning or quiet partial-support hint, and a focused settings dialog matching the approved screenshot mockup; saved map navigation remains usable.
- [x] #7 Both settings surfaces support explicit recommended install, exact npm/Git/local source addition, missing package restore, project removal, readiness recheck and explicit version update through shared operations. Errors stay visible without losing saved architecture or successful existing selections.
- [x] #8 Settings and relevant source/declaration/exclusion changes refresh the shared status and active source subscriptions without restarting the viewer; architecture and Backlog work updates remain independent. No UI-specific filesystem watcher or direct Backlog filesystem access is added.
- [x] #9 Business/lifecycle regression checks and real terminal/web verification cover empty, partial, ready, missing, blocked and unknown states on disposable projects; repository check, cold simplicity review and full-context complexity review pass; user docs match final behavior.
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
First replace the all-scanners viewer gate with installed-project execution and preserve unrefreshed derived relationships using their existing scanner attribution. Build a shared scanner settings state and mutation operations on current inventory/discovery/readiness APIs. Connect a restartable source session to both viewers, keeping architecture and work publication independent. Add the approved terminal screen and web dialog with status notices and explicit package actions. Verify domain/lifecycle behavior, actual terminal/web flows, then run the repository check and the two required architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scanner settings are operational configuration, not new OKF concepts or C4 elements. Plugin metadata owns matching; scanner module inventory owns installation; the shared session owns readiness, execution and source subscriptions. Saved Markdown, links, identities and C4 ownership retain their meaning. Derived relationship Technology already carries contributing scanner IDs; partial reconciliation uses that attribution to preserve unavailable-scanner pairs and their Code endpoints.

Verification:
- AC1/2: scanner-session, viewer-scanner-availability, partial-scan and scanner-evidence tests verify empty no-op, available execution with missing selections, failed-batch preservation, mixed-scanner relationship preservation and complete refresh. Check-again plus missing-package combination has a lifecycle regression.
- AC3/4/8: scanner-settings case matrix and scanner-settings-lifecycle verify neutral/warning/hint/error, unknown and equivalent third-party metadata, nested declarations, source edits, exclusions, live add/remove, failed-add preservation and subscription replacement. Existing discovery checks cover declaration/version matching. Empty live settings retain declaration discovery through the scanner adapter; they execute no scanner or reconciliation.
- AC5/6/7: real compiled Groma on disposable React + Rust declarations with saved fixture architecture. Splash s opens settings and Escape returns; direct view Shift+S opens settings without taking the existing flow-step key. Checked 120x36 and 200x60, resizing, selected details, back to map and container navigation. Web dialog, add/remove/check flow, actual scanner error and subsequent prepared official TypeScript package scan verified; web changes also reached the open terminal settings. Quiet blue partial hint and saved map navigation verified. Package actions share the existing npm/Git/local inventory operations; package publication remains separate release work.
- Final bun run check: 16 Node tests pass; 273 Bun tests pass; 6 optional Rust/Go native-tool tests skipped. Native source subscription tests ran with macOS filesystem access. Compiled build and git diff --check passed. Screenshot evidence is in the thread visualization directory under scanner-settings-implemented.

Reviews:
Cold simplicity review found no blockers; removed unused checkedScannerSettings and renamed session variables for clear ownership. Implementer specification and quality reviews passed. Full-context review found Check again incorrectly treating a missing package as an active tooling failure. Fixed the condition to gate only found blocked packages and added the live lifecycle regression; final full check passes. Targeted implementer re-review found no remaining blocker. Real compiled UI checks also fixed launcher terminal ownership and standalone command arguments. No packages published.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented shared project scanner settings in splash, terminal map and web. Available selections refresh their evidence while absent-scanner Code and relationships remain saved; changes reconfigure live subscriptions. Verified with 16 Node tests, 273 Bun tests, real compiled terminal/web flows and both required complexity reviews; six optional native-tool tests are skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
