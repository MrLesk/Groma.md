---
id: TASK-382
title: Detect scannable framework projects and isolate scanner failures
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 18:48'
updated_date: '2026-09-13 18:58'
labels: []
dependencies: []
references:
  - scanners-projects
  - scan
  - scanner-scan
  - vue-src-scanner-index
  - scan-lifecycle
  - scanner-session
  - scanner-source-watch
  - setup
  - architecture-model
modified_files:
  - plugins/scanners/projects.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/vue/src/index.ts
  - src/scanner/registry.ts
  - src/scanner/session.ts
  - src/scanner/source-watch.ts
  - src/types.ts
  - src/scanner.ts
  - src/scanner/modules/setup.ts
  - test-bun/scanner-session.test.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/nested-scanners.test.ts
  - test-bun/scanner-composition.test.ts
  - test-bun/rust-scanner.test.ts
  - test-bun/scanner-settings-lifecycle.test.ts
  - docs/scanners/index.md
  - docs/scanners/setup.md
  - docs/scanners/evidence.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/angular/index.md
  - docs/scanners/react/index.md
  - docs/scanners/vue/index.md
  - docs/scanners/go/index.md
type: bug
ordinal: 428000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enabling local scanners in the Groma repository loads framework dependencies from scanner implementation packages as if they were applications. Angular and React then require missing project configurations. A single plugin import or scan failure also prevents healthy scanners from updating saved architecture. Users approved correcting project selection and publishing healthy results while retaining saved evidence from failed scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Angular, React and Vue skip dependency-only packages and inactive source fixtures while continuing to scan supported nested projects and report invalid configurations for real source projects.
- [x] #2 Plugin import and scan failures are isolated: healthy scanners update architecture during command-line and live scans, while every failed scanner is identified.
- [x] #3 Failed scanners retain saved Code references and relationships, including relationships supported by several scanners; successful recovery clears the scanner error.
- [x] #4 Focused regressions, repository checks and documentation describe the supported behavior.
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
1. Select framework packages only when they have a tsconfig.json and supported source files belonging to that package; keep compiler errors for selected projects. 2. Return successful observations and all scanner failures from the registry, excluding stale evidence from failed scanners. Use existing partial reconciliation to retain their saved evidence. 3. Carry failure reports through CLI and live sessions and allow initial setup to continue with healthy scanners. 4. Add project-selection, import-failure, watch recovery and persisted-evidence regressions; update scanner contracts; rebuild local framework plugins; run focused and full checks followed by required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused batch/project tests pass (19 tests). The live regression reached recovery correctly; its neutral-banner assertion was incorrect because the test tool intentionally lacks discovery metadata and therefore produces the existing coverage hint. The assertion now checks that every blocked scanner and the error notice clear, which is the requested behavior.

Cold simplicity review passed with no blockers; removed its one duplicated assertion. Implementer specification review: framework fixtures cover real nested projects, dependency-only tooling, inactive fixtures, type-only files, malformed active configurations, and no-match scans. CLI composition regression covers simultaneous import/execution failures, healthy new-file publication, retained failed-scanner Code and shared relationships, and recovery. Live regression covers source changes and clearing all failed statuses. Quality review: explicit two-field ScanBatch stays in scanner delivery; existing reconciliation owns stored evidence preservation, plugin watch patterns remain unchanged, all running scans settle before publication, and every failure is returned. No core persistence format or C4 changes.

Final bun run check passed: clean lint/typecheck, 16 Node tests and 306 Bun tests, 6 optional native Go/Rust skips, no failures. Full-context complexity review passed with no material findings. Rebuilt local Angular/React/Vue packages. Actual repository collection (without reconciliation) returned TypeScript 278 files and Vue 2 files; Angular/React no longer failed on plugin package tsconfig paths. Go/Rust missing workers, Java missing Maven, and C# rejecting a generated NuGet test source outside the repository were separately reported and did not prevent healthy results. Initial C# sandbox pipe error was distinguished by repeating this collection with required named-pipe permission; the generated-source issue remains outside this task. Saved architecture was not scanned/reconciled in this verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Framework scanners now require a package-local configuration and supported source files, skipping dependency-only packages and inactive fixtures. Scanner batches report all import/execution errors while reconciling healthy observations through existing preservation rules. CLI, initial setup and live sessions support partial results and recovery. Verified nested framework fixtures, mixed failures, shared relationship/Code preservation, live source updates, local repository collection, clean full checks and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
