---
id: TASK-372
title: Install recommended scanners through published releases in one step
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 13:16'
updated_date: '2026-09-13 13:32'
labels: []
dependencies: []
references:
  - scanner-modules
  - scan-lifecycle
modified_files:
  - packages/scanner/src/discovery.ts
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/official-catalog.ts
  - src/scanner/modules/discovery.ts
  - src/scanner/modules/settings.ts
  - src/scanner/modules/published.ts
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/modules/settings-model.ts
  - src/scanner/session.ts
  - src/viewers/tui/scanner-settings.ts
  - src/viewers/web/scanners/settings.ts
  - plugins/scanners/go/package.json
  - plugins/scanners/typescript/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/java/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/react/package.json
  - scripts/scanner-release.ts
  - src/scanner/cli.ts
  - test-bun/scanner-recommendations.test.ts
  - test-bun/scanner-compatibility.test.ts
  - test-bun/scanner-installation.test.ts
  - test-bun/scanner-settings-lifecycle.test.ts
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/discovery.md
  - docs/scanners/publishing.md
  - docs/scanners/setup.md
  - test-bun/scanner-settings.test.ts
type: enhancement
ordinal: 418000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanner recommendations currently reject valid projects using uncertain language versions and treat development manifests as proof of publication. Users must diagnose metadata and perform separate package operations. Recommendations should lead directly to installing an actual release and scanning, with clear instructions for real failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Technology detection recommends scanners without gating on language version declarations, prereleases, missing versions or empty technology version metadata. Groma API incompatibility still prevents plugin execution.
- [x] #2 An unversioned package installation selects a published stable release compatible with Groma and the current OS/CPU, records its exact version, and never substitutes a development manifest version. Existing selections restore their exact sources.
- [x] #3 Terminal and web provide individual Install, Install recommended scanners and Install missing scanners; installation saves selections and scans through the shared session without manual checks or refresh. Batch failures preserve successful selections and report the affected package.
- [x] #4 Download, no published release, unsupported Groma/platform and scanner execution failures give concrete next steps; users can retry from the same screen and saved architecture remains available. Tool and project dependency installation stays explicit.
- [x] #5 Official manifests and release documentation no longer encode tested language versions as installation restrictions; the shared publishing flow supplies real published discovery metadata without a second maintained catalog.
- [x] #6 Tests cover prerelease and missing language evidence, published release selection and exact restore, install-to-scan success/failure/retry, and bulk operations. Real terminal and web flows pass, bun run check passes, and two simplicity reviews are completed.
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
Keep local discovery plugin-owned and remove generic language-version compatibility gates. Resolve bare package names from npm publication metadata at installation, reusing the exact-version installer and Groma compatibility guard. Add two bulk settings actions through the existing session, retain failed actions for in-screen retry, and expose concise errors with full details. Update release metadata loading, affected manifests/docs and focused tests. Verify actual UIs, run cold simplicity review, self reviews, then full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review passed after accepting both findings: removed the obsolete unavailable settings state and corrected the old setup documentation. Focused checks and full repository check passed after cleanup and the UI-discovered stale readiness correction (a missing package now outranks a previous ready result). Own specification and quality review: discovery stays local; npm lookup happens only for explicit unversioned installation; exact sources remain pinned; bulk operations preserve successful selections and surface errors; scan retains existing evidence on failure. No OKF records or C4 concepts changed; scanner-modules owns configuration/install and scan lifecycle owns execution. Real terminal and browser flows passed install-recommended partial failure, in-screen retry, and exact install-missing. Public read-only lookup resolved TypeScript, Angular, Rust, C#, Go to actual npm 0.1.0 releases. No package publication performed.

Final full-context complexity review passed with no blocking findings or further simplifications required. The two reviews confirmed clear ownership across detection, published release resolution, installation, shared scanning session and UI. Final verification: bun run check passed 16 Node and 287 Bun tests, with 6 existing native scanner skips and zero failures; git diff --check passed. The release catalog command was exercised in a disposable checkout and read all eight official scanner manifests from their actual published npm 0.1.0 releases. Terminal and web were exercised for partial bulk installation, retry and exact missing-scanner restore. Disposable servers and mock package cache entries were cleaned up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanner recommendations now offer installation without generic language-version gates. Bare package names resolve to compatible published stable releases; exact selections remain pinned. Terminal and web support installing recommended or missing scanners, automatic scanning and same-screen retry while preserving successful selections and saved architecture. Release metadata comes from npm publication data. Verified with 303 passing tests, 6 existing skips, real terminal/web installation flows, public release metadata checks and two passing simplicity reviews. No npm publication performed.
<!-- SECTION:FINAL_SUMMARY:END -->
