---
id: TASK-394
title: Show available scanner upgrades in web settings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-14 14:10'
updated_date: '2026-09-14 14:16'
labels: []
dependencies: []
references:
  - modules-settings
  - data
  - scanners-settings
  - web-server
modified_files:
  - src/scanner/modules/settings-model.ts
  - src/scanner/modules/settings.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/data.ts
  - src/viewers/web/scanners/settings.ts
  - test-bun/scanner-upgrades.test.ts
  - docs/scanners/setup.md
type: enhancement
ordinal: 440000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A working installed scanner can be older than the current compatible release, but web settings shows only its installed version and a prominent Remove action. Users cannot see that an upgrade exists without opening Details and trying Update.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening web plugin settings checks installed npm selections for newer compatible stable releases; startup and scans do not perform update checks.
- [x] #2 A newer release appears as installed version to available version with Update directly on the row. Remove and exact version selection stay in Details.
- [x] #3 A healthy older scanner does not produce a warning. Update lookup errors do not change scan readiness, and live scanner changes cannot display an upgrade for a different selected source.
- [x] #4 The visible upgrade action installs the shown version, and its upgrade indication disappears after success. Tests, browser verification and bun run check pass.
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
1. Add optional source-keyed upgrade results to settings responses only when requested on opening the dialog. Reuse the existing published scanner selector. 2. Keep upgrade lookup results separate from live scan readiness in the web control, display versions and the primary Update action, and move Remove into Details. 3. Test selection, no warnings and source identity; verify a real published TypeScript upgrade in the browser and run the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification and quality self-review passed. Opening plugin settings requests upgrades explicitly; startup reads and scanner publications do not call the registry lookup. Lookup results are stored by exact configured source separately from scan health, and live readiness remains authoritative while lookup runs. The row action pins the displayed version. No OKF records or C4 concepts change; this is temporary operational package information owned by scanner settings. Browser evidence from the disposable TypeScript project: no scan warning with 0.1.1 installed; opening Settings showed 0.1.1 to 0.1.2 with Update on the right; Details contained Choose version and Remove from project; clicking Update installed 0.1.2, completed the scan, and removed the offer. Tests cover compatible selection, skipping local/Git/missing modules, unchanged readiness and warning state, registry errors, and stale source rejection. bun run check passed types, 16 Node tests and 314 Bun tests with 6 existing optional native skips. No new complexity warning; the prior TASK-392 duplicate paint warning remains outside this change. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web settings checks for compatible npm upgrades when opened, shows installed and available versions with a primary Update button, and keeps Remove and exact version selection in Details. Upgrade checks do not affect scanner health. Verified a real 0.1.1 to 0.1.2 TypeScript upgrade and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
