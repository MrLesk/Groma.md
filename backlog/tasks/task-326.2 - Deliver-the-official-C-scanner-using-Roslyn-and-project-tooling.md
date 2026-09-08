---
id: TASK-326.2
title: Deliver the official C# scanner using Roslyn and project tooling
status: Done
assignee:
  - '@codex-csharp'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-08 22:02'
labels:
  - scanners
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/csharp-scanner-prototype'
  - c-scanner
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/csharp/.gitignore
  - plugins/scanners/csharp/dotnet/Command.cs
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - plugins/scanners/csharp/dotnet/ProjectInput.cs
  - plugins/scanners/csharp/dotnet/ScanRequest.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - plugins/scanners/csharp/dotnet/test/OperationTests.cs
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/config.ts
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/src/process.ts
  - scripts/package-csharp-scanner.ts
  - test/fixtures/csharp-operations/App/App.csproj
  - test/fixtures/csharp-operations/App/Calls.cs
  - test/fixtures/csharp-operations/App/Program.cs
  - test/fixtures/csharp-operations/App/Wrapper.cs
  - test/fixtures/csharp-operations/Core/Core.csproj
  - test/fixtures/csharp-operations/Core/Partial.Declaration.cs
  - test/fixtures/csharp-operations/Core/Partial.Implementation.cs
  - test/fixtures/csharp-operations/Core/Providers.cs
  - test/fixtures/csharp-operations/Example.slnx
  - test/fixtures/csharp-operations/NuGet.Config
  - test-bun/csharp-scanner.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - scripts/validate-csharp-package.ts
  - scripts/validate-csharp-repository.ts
  - docs/scanners/dotnet-csharp/validation.md
  - test-bun/scanner-evidence.test.ts
parent_task_id: TASK-326
type: feature
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer with the project's .NET tooling installed can install the official C# scanner and scan a supported solution/project into useful Groma evidence. Start from research/csharp-scanner-prototype: review and reuse its Roslyn/MSBuild worker, project loading, adapter, fixtures, setup work, and validation. Do not restart the scanner or import the branch's conflicting Backlog task records.

Use Roslyn and the .NET project tools for language and compilation semantics. Respect the project's SDK selection and supported project references. Consumers provide their language tools; private SDK installation and toolchain-free packaging are not product requirements. Package the scanner itself for the existing Groma loader. Keep tooling/project checks inside the plugin and expose their outcome through the shared installation/readiness journey.

Deliver one supported C# project using the branch's existing real-project evidence as the starting point. Review the rendered architecture before broadening support. Recheck the research branch's macOS restore failures and project-tool selection behavior; research CI is input, not release evidence. Use the shared evidence semantics without inventing collaborations from imports, interface declarations, or framework names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing branch is assessed and useful scanner code and validation assets are reused; the delivered scanner uses Roslyn and project tooling rather than custom language resolution.
- [x] #2 The supported project loads with its selected installed SDK, dependencies, and in-repository project references, with actionable diagnostics for missing tooling or unsupported project configuration.
- [x] #3 The scanner produces deterministic source/operation evidence with canonical targets and explicit uncertainty under the shared contract; unsupported runtime dispatch is not reported as certain.
- [x] #4 Installed into compiled Groma, the scanner produces a human-reviewed map for one supported C# project; repeated scans and supported source edits preserve curated ownership.
- [x] #5 A project-load or scan failure leaves the prior Groma architecture unchanged, and the supported macOS restore flow no longer reproduces the branch's failing case.
- [x] #6 Supported project/framework scope, tool versions, required preparation, and extraction limits are documented and checked through focused business-behavior tests; the package is ready for common release qualification.
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
1. Reuse the research Roslyn worker, canonical operation evidence, independent source fixtures, and C# package/consumer validation scripts. 2. Use installed dotnet and the selected project SDK through shared plugin-local readiness checks; remove private SDK installation, scan-time builds/restores and audit overrides. Use relative fixture restore input to avoid the reproduced macOS path-alias failure. 3. Qualify pinned FluentValidation 12.0.0 and independent project-reference fixtures using the packaged worker and current compiled Groma; verify deterministic evidence, SDK precedence, repeated scans, source edits, curated ownership and failure atomicity. 4. Document supported tooling, snapshot identity and limits. Complete focused checks, cold simplicity review, repository check, own specification/quality review, then coordinator map acceptance and full-context review before final status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused Roslyn worker, operation evidence, project loading, independent source fixtures and package scripts from origin/research/csharp-scanner-prototype. Removed private SDK/setup behavior and NuGetAudit override. macOS SDK 10.0.400 reproduced duplicate assets paths through /var and /private/var; relative restore input from the fixture working directory fixes that case. 17 Roslyn tests and 8 concurrent Bun adapter/readiness tests pass; focused Biome clean. FluentValidation at 5365d9294812c8a5c5a7f4d7447c9a65b79a025b restores without audit overrides and selects SDK 9.0.317 with SDK 10.0.400 also installed. Two complete worker observations match: 138 files, 1 scope, 820 operations, 1352 invocations. Historical compiled Groma package checks pass repeat scans, curated ownership after a valid source edit, and failed-scan map preservation. Current shared-source consumer build and review remain pending.

Current shared source snapshot compiled to /tmp/groma-csharp-sdk-XrB499/groma. Current package at /tmp/groma-csharp-sdk-XrB499/package passed relocation, repeat scans, curated partial-file ownership after a valid edit, and compilation-failure preservation. Pinned FluentValidation map is retained at /private/tmp/groma-csharp-sdk-XrB499/FluentValidation/groma for coordinator review; current compiled first scan 2.477s, repeat hash identical, mixed-language failed scan preserved SHA-256 9aa2f40c0e196196d322c3cdbf5b11f152c68e9533e00578711c6253fc574050. Normal SDK 9.0.317 restore completed with source/dependencies unchanged. Earlier test-process stalls occurred during local SDK-host replacement; after stopping those processes and refreshing the task-local host inode, detailed, normal and original default-verbosity suites each passed all 17 tests in 8–10 seconds without test changes. First dotnet banner mentioned HTTPS certificate installation; read-only keychain metadata showed only two localhost certificates issued August 25, before this task, and no task-local certificate files. No user certificate was deleted or modified; further runs disable certificate generation. Documentation records support boundaries and reproducible consumer checks.

Cold simplicity review passed after two bounded cleanups: malformed/incomplete JSON tests now reach worker execution after successful SDK/runtime readiness, and package validation imports only in its fresh process. Coordinator leased the existing scanner-evidence C# host test; its fake now supports readiness and uses an independent prepared-worker placeholder while retaining observation equality. Targeted re-review passed. Focused combined tests: 17 pass, 78 assertions; relocated package validation passes after cleanup. Full bun run check exit 0: 110 Node tests pass; 379 Bun pass, 1 Java-tooling integration skip, 0 fail; six existing complexity warnings are outside this task. Complete log /tmp/groma-csharp-sdk-XrB499/full-check.log. Implementer specification review: AC1 branch reuse is documented and executed; AC2 selected SDK 9.0.317, normal restore, project-reference fixtures and missing SDK checks pass; AC3 canonical direct/partial/generic providers, explicit dispatch uncertainty and repeat observation equality pass; AC4 compiled package and curated source-edit preservation pass, with coordinator map review still pending; AC5 compiled failure atomicity and reproduced/fixed macOS restore pass; AC6 versions/scope/preparation/limits and package qualification are documented and focused tests pass. Implementer quality review found no reproducible defect, unnecessary new abstraction, unclear ownership, or missing test in the supported flow. All changed source/test files are under 500 lines and task files have no lint complexity warnings. Runtime flow: configured plugin selects input and installed tools, starts prebuilt Roslyn/MSBuild worker, validates one complete observation, then shared core reconciles existing ownership. No architecture IDs, relationships policy, private toolchain management or live-project changes were added. Outstanding gates: coordinator map acceptance, full-context review; Linux/Windows release qualification and shared readiness presentation are owned by later TASK-326 children.

Coordinator acceptance completed on behalf of Alex: the retained pinned FluentValidation map was exported with the qualified compiled binary to /tmp/groma-csharp-review-export and inspected in the browser through system, one container with 138 observed components, Abstractvalidator, and How built. The exact src/FluentValidation/AbstractValidator.cs source appeared with C# provenance and 399 lines. Empty authored overview and no invented collaborations accurately represent the observed map; the independent fixture proves curated multi-file ownership and valid-edit preservation. Full-context review passed and recommends retaining the current design, with no blocker or required simplification. All task acceptance and Definition of Done evidence is complete. Linux/Windows qualification, shared readiness presentation and public package release remain separate task scope. A separately discovered baseline compiled TypeScript worker startup issue is assigned to the Java worker; no C# change was requested, and the C# map export succeeded. Coordinator authorized this task-only commit and push under an exclusive git-index lease.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the official C# scanner using the reused prebuilt Roslyn/MSBuild worker and installed project tooling, with plugin-local readiness, deterministic canonical evidence and explicit dispatch uncertainty. Qualified pinned FluentValidation on macOS arm64 with its SDK 9.0.317 and a .NET 10 worker; reproduced and fixed the macOS relative-restore path case. Verified package relocation, repeated scans, curated ownership after edits, and failure preserving the map. Validation: 17 Roslyn tests; repository check passes 110 Node and 379 Bun tests with one unrelated Java tooling skip. Cold, implementer and full-context reviews pass; coordinator accepted the rendered source map on Alex’s behalf. No Linux/Windows or public release qualification is claimed.
<!-- SECTION:FINAL_SUMMARY:END -->
