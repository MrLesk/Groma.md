---
id: TASK-334
title: Preserve source project hierarchies in scanner observations
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 20:50'
updated_date: '2026-09-10 21:16'
labels: []
dependencies: []
references:
  - scan-observation
  - scan-lifecycle
  - scan-evidence
  - typescript-scanner
  - scanner-scan
  - scan
  - vue-src-scanner-index
  - evidence
  - adapter
  - validate-csharp-package
  - source-relationships
  - c-scanner
  - go-src-scanner-index
modified_files:
  - packages/scanner/src/index.ts
  - src/scan-reconciler.ts
  - src/scanner/registry.ts
  - src/scan-evidence.ts
  - plugins/scanners/typescript/src/scan.ts
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/src/evidence.ts
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/main.go
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - test-bun/scanner-session.test.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/okf-writers.test.ts
  - test-bun/scan-refresh.test.ts
  - test-bun/scan-component-naming.test.ts
  - test-bun/scanner-composition.test.ts
  - test/accept.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/architecture-findings.test.ts
  - test-bun/react-scanner.test.ts
  - test-bun/scanner-modules.test.ts
  - test-bun/go-scanner.test.ts
  - test-bun/rust-scanner.test.ts
  - scripts/validate-csharp-package.ts
  - plugins/scanners/csharp/dotnet/test/ContractTests.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/dotnet/test/OperationTests.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/scanners/evidence.md
  - docs/scanners/rust/index.md
  - docs/scanners/typescript/index.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/dotnet-csharp/validation.md
  - test-bun/angular-scanner.test.ts
  - test-bun/vue-scanner.test.ts
  - test-bun/scanner-roots.test.ts
  - src/relationship-inference.ts
  - test-bun/csharp-scanner.test.ts
  - plugins/scanners/csharp/dotnet/ProjectInput.cs
  - docs/scanners/go/index.md
type: enhancement
ordinal: 380000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Represent source solutions, workspaces, projects and packages through roots with parent links and file membership. Preserve source grouping evidence without requiring scanners to assign C4 concepts. Remove the redundant complete flag and add structured diagnostic locations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Observations use roots with optional parent and defining file, and files list their root memberships; solutions remain represented above their projects.
- [x] #2 Core handles multiple top-level source roots, retains curated file ownership and uses hierarchy only as initial placement evidence.
- [x] #3 All supported scanner producers and parsers use the same contract without legacy adapters; complete is removed and diagnostics support optional file and line.
- [x] #4 The authoring guide explains source grouping, declaration symbols, executable operations, invocations and the role of dependency evidence with concrete examples.
- [x] #5 Scanner identity is separate from technology and analysis engine metadata; architecture attribution remains the stable scanner ID.
- [x] #6 The unused source relationships field is removed from the shared observation contract and all producers.
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
Replace root/scopes/placements with roots and per-file memberships, preserving source ancestry and curated architecture ownership. Separate stable scanner identity from technology and engine details. Remove complete and the unused source relationships exchange; retain dependency analysis inside scanners when consumed. Update all eight producers, native workers, core consumers, tests, and scanner authoring documentation. Verify the existing C# solution example, independent roots, shared-file ownership, diagnostic locations, repository checks, and available native integrations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the complete agreed observation revision across core, all eight scanner producers and native workers. Added root hierarchy and shared-membership validation, preserved solution/project ancestry and curated Code ownership, separated scanner id/technology/engine details, removed complete and unused source relationships, and added structured diagnostic locations. Updated authoring and scanner documentation. Initial full repository check passed (110 Node and 427 Bun tests, 7 optional skips); focused regressions cover root hierarchy, independent roots, shared-file ownership, and diagnostic locations. Rust cargo check and package build also pass. Final checks include the rebuilt Rust worker.

Native verification: Rust package rebuilt and all four Rust integration tests passed; Go 1.27.1 was prepared under /tmp, both native Go integration tests passed, and the Go/Java packages were rebuilt. Prepared .NET SDK 10.0.400 under /tmp and restored existing cached dependencies with locked mode. Native C# compilation exposed one remaining Root assertion and two xUnit analyzer errors; fixed these without changing test scenarios. Both C# assemblies now compile; running the test host with its required local socket access. No SDK was installed globally.

Final verification: bun run check with GROMA_TEST_GO and GROMA_TEST_RUST passed 110 Node tests and 433 Bun tests (543 total), with only the optional Maven tooling test skipped. The same six pre-existing complexity warnings remain; no new warnings. All 18 native .NET tests passed after compiling with the temporary SDK. A prior full .NET run stalled and was cancelled after process/stack inspection; contract-only tests and the real worker-to-adapter solution scan passed independently, then the unchanged full test suite passed in 7.4 seconds with diagnostic logging. No assertions, scenarios, runner concurrency, timeouts, or retry behavior were changed to obtain this result. Real C# adapter verification returned one solution root, two project roots, six files, and 19 operations. Rust cargo check, Rust/Go/Java/C# package builds, guide JSON parsing, and git diff --check passed.

Local simplicity, specification, and quality reviews complete. Flow: scanners return source-root hierarchy and file memberships; registry exclusions retain required ancestors; core uses top roots and member/leaf roots as initial system/container clues while existing Code ownership remains authoritative. Only stable scanner IDs enter stored Code references; invocation composition retains the same attribution. Removed unused dependency collectors and avoided schema adapters or new C4/OKF concepts. Clarified that the linked-source restriction belongs to the current C# scanner, not to the shared contract. No authority-backed blocking finding remains.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the full scanner observation revision across eight scanners, native workers, core, tests, and documentation: source hierarchies and file memberships, separate scanner identity/technology/engine fields, structured diagnostic locations, and removal of complete and unused source relationships. Curated ownership and stored Code attribution remain stable. Verified with 543 passing repository tests, 18 passing native .NET tests, real C# solution transport, native package builds, and the documented JSON example; one optional Maven tooling test was unavailable.
<!-- SECTION:FINAL_SUMMARY:END -->
