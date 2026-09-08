---
id: TASK-324
title: Prototype project-aware C# scanning and explicit setup
status: In Progress
assignee:
  - '@chatgpt'
created_date: '2026-09-07 22:15'
updated_date: '2026-09-08 05:35'
labels: []
dependencies: []
references:
  - c-scanner
  - scanner-modules
  - scan-observation
documentation:
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/evidence.md
modified_files:
  - features/csharp-scanner.feature
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/Command.cs
  - plugins/scanners/csharp/dotnet/ProjectInput.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - test/fixtures/csharp-operations/NuGet.Config
  - test/fixtures/csharp-operations/Example.slnx
  - test/fixtures/csharp-operations/Core/Core.csproj
  - test/fixtures/csharp-operations/App/App.csproj
  - test/fixtures/csharp-operations/Core/Providers.cs
  - test/fixtures/csharp-operations/Core/Partial.Declaration.cs
  - test/fixtures/csharp-operations/Core/Partial.Implementation.cs
  - test/fixtures/csharp-operations/App/Wrapper.cs
  - test/fixtures/csharp-operations/App/Program.cs
  - test/fixtures/csharp-operations/App/Calls.cs
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - plugins/scanners/csharp/dotnet/test/OperationTests.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/src/process.ts
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/sdk.ts
  - plugins/scanners/csharp/src/setup.ts
  - plugins/scanners/csharp/src/index.ts
  - packages/scanner/src/index.ts
  - src/scanner/registry.ts
  - src/scanner/cli.ts
  - scripts/package-csharp-scanner.ts
  - plugins/scanners/csharp/.gitignore
  - test-bun/scanner-evidence.test.ts
  - test-bun/csharp-scanner.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - scripts/validate-csharp-package.ts
  - scripts/benchmark-csharp-scanner.ts
  - .github/workflows/csharp-scanner.yml
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/scanners/dotnet-csharp/production-readiness.md
  - docs/scanners/dotnet-csharp/validation.md
  - .github/workflows/csharp-project-research.yml
priority: high
type: spike
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested research and a runnable review-branch prototype for globally installed Groma. The current C# adapter rebuilds on every scan, chooses the first root input, and emits no operation evidence. The experiment must establish useful .NET coverage without turning declarations, DI registrations, or partial analysis into unsupported architecture claims.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document scanner contract, .NET support boundaries, relationship semantics, installation design, security, scale limits, and production release gates with primary references.
- [ ] #2 A prepared C# worker scans unambiguous or explicitly selected nested SDK-style inputs without building or restoring during scan; incomplete or unsupported contexts fail before reconciliation.
- [ ] #3 Roslyn operation evidence canonicalizes supported direct calls and preserves virtual, interface, delegate, and external uncertainty, with deterministic regression fixtures.
- [ ] #4 Explicit scanner setup and a relocatable prebuilt package demonstrate opt-in dependency preparation for globally installed Groma; no npm publication is implied.
- [ ] #5 Run focused .NET tests, repository checks, packaged-worker checks, and a pinned public-repository experiment; record actual results and remaining gaps.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the language-neutral evidence/core-ownership boundary; document the baseline and supported .NET subset. 2. Separate repository root and input selection; enforce complete project/file/compilation coverage and deterministic resource limits. 3. Add conservative Roslyn operation extraction using the existing optional evidence fields. 4. Replace scan-time builds with a prebuilt worker and explicit optional scanner setup; prepare portable artifacts and private SDK installation with verified downloads. 5. Add synthetic counterexamples and run a pinned FluentValidation experiment, full checks and packaged/compiled smoke tests. 6. Record evidence and release blockers, push only the research branch, and keep current architecture selection policy unchanged.

7. Reverify PR #106 and its artifacts; test unmodified pinned ASP.NET eShopOnWeb projects as well as FluentValidation, inspect source witnesses, and record real outcomes and release gaps.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented conservative Roslyn operations, explicit root/input selection, SDK-context validation, complete failure semantics, prebuilt bundle and opt-in scanner setup. Local focused checks: 15 Roslyn tests and 24 Bun tests passed before adding Web SDK and SDK-pin controls. Full bun run check: 110 Node + 365 Bun tests passed; existing six complexity warnings remain. Compiled relocated Linux package: 6 files / 2 scopes / 19 operations / 24 invocations, 3.53s first complete CLI scan, identical repeated Markdown, compilation failure preserved existing map. Public and multi-OS validation remains in progress.

Resumed on 8 September after user requested actual-project validation. Verified branch fd56e71 and PR #106 exist; previous conversational summary incorrectly reported no implementation. Retrieved Linux CI artifacts proving deterministic FluentValidation scanning and private SDK setup. Broaden the experiment to pinned eShopOnWeb without changing core relationship selection.
<!-- SECTION:NOTES:END -->
