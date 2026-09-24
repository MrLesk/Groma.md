---
id: TASK-396
title: Scan fresh checkouts without project dependency installation
status: Done
assignee:
  - '@codex'
created_date: '2026-09-14 20:23'
updated_date: '2026-09-15 12:47'
labels: []
dependencies: []
references:
  - react-src-index
  - vue-src-index
  - angular-src-index
  - java-src-index
  - framework-package
  - worker-main
  - go-src-index
  - rust-src-index
  - src-main
  - dotnet-scanner
  - csharp-src-index
  - src-index
  - build
  - scanner-src-index
  - sourceproject
  - worker-project
  - components
  - runtime
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
modified_files:
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/angular/src/components.ts
  - plugins/scanners/angular/src/scan.ts
  - test-bun/react-scanner.test.ts
  - test-bun/angular-scanner.test.ts
  - plugins/scanners/vue/src/evidence.ts
  - test-bun/vue-scanner.test.ts
  - plugins/scanners/java/src/maven.ts
  - plugins/scanners/java/java/md/groma/scanner/MavenModel.java
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/build.ts
  - plugins/scanners/go/worker/project.go
  - plugins/scanners/go/worker/main.go
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/rust/src/project.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/csharp/dotnet/SourceProject.cs
  - plugins/scanners/csharp/dotnet/ProjectInput.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj
  - plugins/scanners/csharp/dotnet/packages.lock.json
  - scripts/package-csharp-scanner.ts
  - plugins/scanners/python/package.json
  - bun.lock
  - plugins/scanners/python/worker/runtime.ts
  - plugins/scanners/python/src/index.ts
  - plugins/scanners/python/build.ts
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/python/.gitignore
  - test-bun/python-scanner.test.ts
  - test-bun/go-scanner.test.ts
  - test-bun/rust-scanner.test.ts
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - plugins/scanners/csharp/dotnet/test/OperationTests.cs
  - plugins/scanners/csharp/dotnet/test/CoverageTests.cs
  - plugins/scanners/go/build.ts
  - plugins/scanners/java/src/process.ts
  - scripts/scanner-release.ts
  - test-bun/scanner-fresh-checkout.test.ts
  - test-bun/java-scanner.test.ts
  - packages/scanner/src/index.ts
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - docs/scanners/java/index.md
  - docs/scanners/go/index.md
  - docs/scanners/rust/index.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/python/index.md
  - docs/scanners/angular/index.md
  - docs/scanners/react/index.md
  - docs/scanners/vue/index.md
  - docs/scanners/publishing.md
  - plugins/scanners/python/THIRD-PARTY-NOTICES.txt
  - docs/scanners/fresh-checkout-validation.md
  - docs/scanners/setup.md
priority: high
type: feature
ordinal: 442000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A fresh callforpapers checkout cannot complete Angular scanning until pnpm installs application dependencies. Other official scanners also require project restores or installed language SDKs. Installing an official scanner must be sufficient to inspect supported source in a fresh checkout. Analysis should return source facts it can establish and retain uncertainty for unavailable external definitions, rather than require a build-ready project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All nine official scanner packages run their supported source examples without project dependency directories, restore commands, or separately installed language runtimes and SDKs.
- [x] #2 Scanner packages include the analysis tools and runtime assets needed for their supported language versions; scanning does not download dependencies, execute package install scripts, or build the application.
- [x] #3 Source declarations, locations, and supported locally provable interactions remain useful; missing external definitions remain unresolved and never become certain provider claims.
- [x] #4 A fresh callforpapers checkout scans Java, TypeScript, and Angular without node_modules or a prepared Maven dependency cache; the supported company-merge output binding is retained.
- [x] #5 Repeated fresh-checkout scans preserve single file ownership, authored architecture, and deterministic results; source and project dependency declarations remain unchanged.
- [x] #6 Scanner documentation, packaging and release checks reflect the new requirement; bun run check and the required architecture reviews pass.
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
1. Trace each scanner packaging and project-loading path and replace build-ready prerequisites with local-source analysis while preserving supported provable facts.
2. Bundle required analysis runtimes in scanner delivery; remove target-project dependency restores, toolchain selection, and execution from scanning.
3. Update framework extraction to work without installed application packages and validate concrete source bindings with independent fixtures.
4. Validate each relocated package against a fresh fixture with no language SDKs on PATH or project dependency caches; validate a fresh callforpapers copy and repeat-scan ownership and Markdown stability.
5. Update contracts, documentation and release validation. Run bun run check, one cold simplicity review, implementer specification/quality reviews, then one full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All nine relocated packages passed fresh-checkout fixtures with an empty HOME and only Git on PATH (71 assertions). Separate Go/Rust domain fixtures passed (15 tests total with packaging). Roslyn: 7 tests passed after removing all fixture restore steps. Full bun run check passed outside the sandbox: 316 Bun tests plus Node tests; sandbox-only failures were local servers, ps and FSEvents. Cold simplicity review passed; removed obsolete Java classpath/generated inputs and duplicate Go package sorting.

Specification review: the nine package fixtures pass without tools/dependencies, and repeated callforpapers scans cover 1390 unique source owners and preserve all 47 earlier Angular relationship rows, including company merge. Both final scans are byte-identical across 1397 Markdown files and leave source/declarations unchanged (5.09s and 4.76s). Quality review found and fixed the inline-template output-provider regression and indexed Java diagnostics by source file to avoid timeout with 11000+ missing-type errors. Invalid calls stay unresolved; no new stored model fields or fallback modes. Documentation and release package checks updated.

Final full-context complexity review passed with no blockers; clarified one remaining plugin-guide sentence. Release validation reproduced NU1004 when a self-contained C# publish wrote a host RID into the source lockfile. Runtime publish now uses a temporary build-output lockfile; shared locked restore passes unchanged. NuGet audit and .NET test sockets required execution outside the sandbox; no audit policy was disabled.

Final delivery assembly passed on macOS arm64. The assembled nine-package fresh-checkout suite passed again (9 tests, 71 assertions). C# locked restore passed after the local self-contained publish; source lock stayed platform-neutral. Refreshed all nine local generated scanner outputs from verified packages. Full final repository check: 16 Node tests and 317 Bun tests passed, 15 opt-in skips covered separately where applicable. No publication or commit performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Official scanners now carry their analysis tools and runtimes and scan supported source without project dependency installation or SDK setup. Verified all nine relocated packages, local call/callback evidence and uncertainty, 7 C# tests, and the complete repository check. A source-only callforpapers scan retains all 47 Angular relationships across 1390 unique source owners; repeat scans produce byte-identical Markdown and leave project files unchanged. Both required reviews passed. Runtime assets and platform-specific build state are packaged separately from project source.
<!-- SECTION:FINAL_SUMMARY:END -->
