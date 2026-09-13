---
id: TASK-383
title: Make every local scanner ready in Groma web
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 19:01'
updated_date: '2026-09-13 19:10'
labels: []
dependencies: []
references:
  - scanner
modified_files:
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - docs/scanners/dotnet-csharp/index.md
  - test/fixtures/rust-collision/Cargo.lock
  - test/fixtures/rust-semantic/Cargo.lock
  - test/fixtures/rust-shared/Cargo.lock
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
type: bug
ordinal: 429000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All eight official scanner folders are selected in the local Groma project, but the web scanner settings still report Needs attention for missing Go/Rust workers, missing Maven, and C# treating dependency-generated test source outside the repository as owned source. The user requires verification in local Groma web with every selected scanner operational before completion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All eight existing local scanner selections stay enabled and finish scanning without a blocked or Needs attention status in the local web UI.
- [x] #2 Local native workers and required project tooling are prepared and scanner-specific failures reproduced in this repository are corrected at their source, without suppressing errors or removing selections.
- [x] #3 Code changes have focused regression coverage and pass the repository checks; the actual local web scanner panel is checked after a completed scan.
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
1. Install persistent Go/Maven tooling and rebuild the selected local native workers; prepare Rust fixture lockfiles. 2. Treat C# compile sources outside the repository as semantic context while retaining in-repository project-boundary validation; add ownership and compiler-validation regression coverage. 3. Diagnose and fix the existing synchronous wait in the native test fixture, preserving test coverage and parallelism. 4. Verify all scanner results, run the native and repository checks, and trigger Retry in the actual local Groma web panel on port 4747; confirm all eight selections remain enabled and none needs attention after completion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Installed Go 1.27.1 and Maven 3.9.16 with Homebrew. Built Rust and Java packages and the local Go worker. The Go release-package script expects GOROOT/LICENSE, which Homebrew stores elsewhere; local scanning only needs buildWorker and that build succeeded. Prepared the three independent Rust fixture lockfiles with cargo fetch. C# outside-repository compile source now stays validation context without being emitted as owned evidence.

All eight selected plugins now finish the actual local web scan without Needs attention; independent registry collection reports no failures (C#18, Go5, Java5, Rust11, TypeScript278, Vue2 files; Angular/React correctly produce no observation). Required repository check passed 306 Bun/16 Node, 6 opt-in native skips. New C# regression passed alone. The full native suite hung in an existing FixtureSolution.Restore Task.WaitAll; official dotnet-stack captured the exact blocked managed stack at /tmp/groma-383-managed-stacks.txt.

The test fixture now awaits process completion/output rather than blocking the xUnit synchronization context. xUnit 2.9.2 is installed and declared; official xUnit1031 guidance confirms this deadlock mechanism: https://xunit.net/xunit.analyzers/rules/xUnit1031. Runner parallelism and test assertions are unchanged.

Final checks passed: all 7 C# native tests completed in 6.6 seconds after the diagnosed async-wait fix; bun run check passed clean lint/types, 16 Node and 306 Bun tests (6 opt-in native Go/Rust tests skipped). Implementer specification/quality/simplicity review passed for this bounded fix: external compiler input is still validated but emits no repository-owned file/operation, the existing project boundary remains enforced, and no new abstraction or error suppression was introduced. Actual localhost:4747 Project review > Scanners completed Retry with all eight installed selections and no Needs attention, Retry, or scanner-error notice. Buttons were enabled again after scanning; Go Details reported Scan completed. Saved an expanded-panel screenshot at /tmp/groma-all-scanners-ready.png. The original local server remains running and the verified browser tab is left open. Actual scan output contains no failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prepared all local scanner workers and tooling, generated Rust fixture lockfiles, and corrected C# ownership of SDK/package compile source outside the repository. Fixed an existing async test-fixture deadlock found during validation. All selected scanners finish without errors; confirmed all eight installed rows have no Needs attention in the actual local web UI after Retry. Native C# and full repository checks pass; screenshot recorded.
<!-- SECTION:FINAL_SUMMARY:END -->
