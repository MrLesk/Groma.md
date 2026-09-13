---
id: TASK-335
title: Expose scanner diagnostics in scan results
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 21:43'
updated_date: '2026-09-10 21:45'
labels: []
dependencies: []
references:
  - scan-lifecycle
  - architecture-model
modified_files:
  - test-bun/scanner-diagnostics.test.ts
  - src/types.ts
  - src/scan-reconciler.ts
  - src/scanner.ts
  - docs/scanners/index.md
type: bug
ordinal: 381000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A user running groma scan must see limitations reported by successful scanners. Carry existing observation diagnostics into the summary and text report with scanner identity and optional source location. Keep diagnostic reporting separate from fatal scanner failures and architecture records.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scan summaries preserve diagnostics from every observation with their scanner identity, severity, code, message, and optional file and line.
- [x] #2 The scan report displays scanner diagnostics and successful scans still reconcile architecture.
- [x] #3 Scans without diagnostics preserve the existing report behavior.
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
Add a regression using an isolated empty-project fixture. Extend ScanSummary with scannerDiagnostics, collect observation messages during reconciliation, format them in the existing scan report, and document the result. Run focused tests and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression failed before implementation because the summary discarded messages. It now passes for two scanners, messages with and without locations, successful architecture reconciliation, and a subsequent diagnostic-free scan with identical architecture. Diagnostics stay transient; no OKF/C4 model or plugin contract changed. Existing uncommitted changes from tasks 333 and 334 were preserved; baseline copies of touched existing files are retained under /tmp/groma-task-335-baseline for task-only review.

Implementer specification and quality review: each accepted observation contributes its existing diagnostics and complete scanner identity; CLI scan and watch already call formatScanReport. Empty diagnostics omit the optional field and preserve report output. Message severity does not change success/failure semantics. No persistence, plugin, watcher, or native worker changes were introduced. The regression verifies aggregation and attribution across two scanners, location display, successful reconciliation, and unchanged architecture after clearing messages. Task-only diffs match the approved scope.

Final validation: bun run check passed on macOS ARM64, with 110 Node and 428 Bun tests passing, 7 optional-toolchain skips, zero failures, and the same 6 existing complexity warnings. git diff --check passed. Linux and Windows were not run locally. The focused regression failed before the fix and passed after it. Changes are uncommitted pending user acceptance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Successful scanner diagnostics now reach ScanSummary.scannerDiagnostics and the CLI scan/watch report with scanner identity and optional source location. Diagnostic-free reports retain existing behavior, diagnostics do not fail scans, and architecture storage is unchanged. Added a passing integration regression and updated scanner documentation. Full repository checks passed: 538 tests, 7 skips.
<!-- SECTION:FINAL_SUMMARY:END -->
