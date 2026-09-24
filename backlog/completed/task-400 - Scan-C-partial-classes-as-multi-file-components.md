---
id: TASK-400
title: Scan C# partial classes as multi-file components
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:31'
updated_date: '2026-09-15 14:23'
labels:
  - scanner
  - csharp
dependencies:
  - TASK-397
references:
  - dotnet-scanner
documentation:
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/PartialSourceUnits.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/csharp/dotnet/test/SourceUnitTests.cs
  - test-bun/csharp-source-units.test.ts
  - docs/scanners/dotnet-csharp/index.md
type: feature
ordinal: 446000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
C# permits one class declaration to span several source files through partial declarations. The current fresh scan gives each file its own component even when the compiler identifies one class. The supported example is one partial class split across two authored C# files in the same declared project, with no unrelated independent type sharing those files.

Use TASK-397 source-unit evidence and existing C4 components with multiple OKF Code references. Associations must follow compiler type identity, not matching filenames or class names alone. This task covers partial classes in the current source-only C# scanner; it does not add Razor, XAML, generated-source execution, or automatic grouping of services and their dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fresh scan represents the authored files declaring one unambiguous partial class as one component, while retaining exact source references and available declaration and operation evidence.
- [x] #2 Associations use compiler type identity in the declared project context. Unrelated same-name types in different namespaces or projects remain separate; files containing unrelated independent types are not automatically absorbed.
- [x] #3 Repeat scans preserve component identity and ownership. Adding an unowned partial declaration file to an existing class follows TASK-397; curated ownership, shared-file conflicts, and disappearing associations retain its safeguards.
- [x] #4 New or edited partial-class source files are reflected through the normal scanner watch and refresh flow without installing target dependencies, restoring packages, or running source generators.
- [x] #5 A minimal two-file partial-class fixture verifies packaged scanner observations through core and component details, repeated scans, and incremental attachment; existing source-call evidence remains intact.
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
1. Extract partial-class associations using Roslyn symbol identity within each project, only when all declarations occupy authored files with no unrelated independent types. 2. Serialize through the shared source-unit contract. 3. Verify native and packaged dependency-free fixtures, project/namespace separation, incremental attachment and repeats through core; document limits and run checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 10 Roslyn tests passed, including partial-class identity, namespace/project separation and independent-type exclusion. The rebuilt self-contained package passed the fresh-checkout test with no language tools on PATH. Its core/session fixture preserved identity, authored meaning and local call evidence, then attached a new partial declaration through the real watcher. Full check passed with the package test enabled: 330 Bun tests, 15 optional skips, 16 Node tests, lint and types. Native test-runner sockets needed execution outside the sandbox. Implementer specification and quality reviews passed; no new architecture rule beyond TASK-397.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
C# reports unambiguous authored partial-class files as source units using Roslyn identity per project. Native and packaged tests verify separation, stable ownership, incremental live attachment and dependency-free scanning. Full repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
