---
id: TASK-175
title: Adopt shared TypeScript and C# scanner evidence
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 21:43'
updated_date: '2026-08-25 22:25'
labels: []
dependencies: []
references:
  - scan-reconciler
  - core
  - scanner
  - scan
  - scanner-observation
  - typescript-scanner
  - csharp-scanner
modified_files:
  - src/scanner/observation.ts
  - src/scanner/typescript/files.ts
  - src/scanner/typescript/graph.ts
  - src/scanner/typescript/scan.ts
  - src/scanner/csharp/Groma.CSharpScanner.csproj
  - src/scanner/csharp/Contract.cs
  - src/scanner/csharp/Scanner.cs
  - src/scanner/csharp/Command.cs
  - src/scanner/csharp/Program.cs
  - src/scanner/csharp/.gitignore
  - src/scanner/csharp/packages.lock.json
  - src/scanner/csharp/adapter.ts
  - src/scan-reconciler.ts
  - src/core.ts
  - src/scanner.ts
  - src/types.ts
  - src/create.ts
  - src/edit.ts
  - src/typescript-scanner.ts
  - src/typescript-files.ts
  - src/typescript-graph.ts
  - test/accept.test.ts
  - test/scan.test.ts
  - test/typescript-scanner.test.ts
  - test-bun/scanner-evidence.test.ts
  - src/scanner/csharp/test/Groma.CSharpScanner.Tests.csproj
  - src/scanner/csharp/test/ContractTests.cs
  - src/scanner/csharp/test/ScannerTests.cs
  - package.json
  - experiments/dotnet-scanner/.gitignore
  - experiments/dotnet-scanner/README.md
  - experiments/dotnet-scanner/scan-masstransit.sh
  - experiments/dotnet-scanner/src/Command.cs
  - experiments/dotnet-scanner/src/Contract.cs
  - experiments/dotnet-scanner/src/Groma.DotNetScanner.csproj
  - experiments/dotnet-scanner/src/Program.cs
  - experiments/dotnet-scanner/src/Scanner.cs
  - experiments/dotnet-scanner/src/packages.lock.json
  - experiments/dotnet-scanner/test/ContractTests.cs
  - experiments/dotnet-scanner/test/Groma.DotNetScanner.Tests.csproj
  - experiments/dotnet-scanner/test/ScannerTests.cs
  - experiments/dotnet-scanner/test/packages.lock.json
  - groma/observed/systems/groma/containers/scanner/container.md
  - groma/observed/systems/groma/containers/scanner/components/scan.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-observation.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/csharp-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/adapter.md
  - groma/observed/systems/groma/containers/scanner/components/graph.md
  - groma/observed/systems/groma/containers/scanner/components/scanner-plugin.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-files.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-graph.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/typescript/index.md
  - docs/scanners/typescript/contract.md
  - docs/scanners/typescript/expected.txt
  - docs/scanners/typescript/observation.txt
  - docs/scanners/dotnet-csharp/index.md
  - docs/product-model.md
  - src/cli.ts
  - docs/component-markdown.md
  - README.md
  - groma/observed/systems/groma/containers/core/components/scan-reconciler.md
  - src/naming.ts
  - groma/observed/systems/groma/containers/scanner/components/files.md
priority: high
type: feature
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer scans a TypeScript or C# project through Groma, Groma uses one deterministic source-evidence boundary for both languages. Scanners report atomic source facts and never decide multi-file architecture ownership; curated architecture Markdown remains the semantic authority. The production implementation should retain only the minimum code proven by the TypeScript research and the MassTransit Roslyn trial.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The supported scan entry point detects and scans TypeScript and C# projects through one language-neutral evidence contract
- [x] #2 Both scanners emit deterministic atomic file and symbol evidence separately from project placement, source relationships, and diagnostics, without inferring multi-file component ownership
- [x] #3 A scan publishes one validated complete observation or fails before reconciliation without publishing partial evidence
- [x] #4 Reconciliation preserves curated architecture component file membership and adds previously unknown source as separate evidence instead of silently grouping it
- [x] #5 Focused TypeScript, C#, contract, and reconciliation tests pass against approved fixtures, and a real MassTransit scan remains deterministic and does not modify the target repository
- [x] #6 A cold simplicity review and the required full-context complexity review find no remaining acceptance blocker
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
1. Define one validated, deterministic scanner observation contract for language identity, root, scopes, atomic files/symbols, placements, relationships, and diagnostics.
2. Refactor the TypeScript scanner into the scanner domain so it emits complete file evidence, infers only placement from imports/directories, and never groups files into one component.
3. Promote the Roslyn trial into the production scanner domain, align its JSON with the shared contract, and add a Bun adapter that discovers and invokes it without writing the target repository.
4. Replace candidate-at-a-time folding with batch reconciliation: preserve curated Markdown file membership, refresh supported symbols, project scopes as systems/containers, and create only unknown files as inferred singleton components.
5. Extend scan/watch detection to TypeScript and C#, remove obsolete experiment/legacy scanner code, and update the authored scanner architecture.
6. Verify focused contract, TypeScript, C#, reconciliation, CLI/watch, full project checks, and repeated disposable MassTransit scans.
7. Run one cold simplicity review, apply only in-scope reductions, then run the required full-context complexity/junior-safety review before finalization and task-scoped commit/push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context decision: scanners provide atomic evidence and placement, while core owns C4 projection and reconciliation. Alex explicitly approved inferred placement from TypeScript imports/directories and C# projects. Curated Markdown remains authoritative for multi-file membership; inference applies only to previously unknown files.

Risk: L2 architecture change. The previous TypeScript scanner mixed evidence with C4 candidates, and candidate-at-a-time reconciliation replaced Code membership. The final flow collects complete language-neutral observations before any Markdown write, refreshes curated file membership in place, and creates singleton evidence only for unknown files.

Implementation: TypeScript and C# are grouped under src/scanner by domain and emit the same files/symbols/scopes/placements/relationships/diagnostics contract. Roslyn project membership supplies C# placement; TypeScript imports and directories supply TypeScript placement. The obsolete TypeScript candidate mapper, standalone TypeScript dump, and .NET trial were deleted. Shared naming moved out of the TypeScript domain.

Correction and review history: the cold simplicity review found that a TypeScript scope anchor bypassed singleton creation; the special path was deleted and its targeted re-review passed. The specification review found that an observed no-Code name could claim an unknown file; name matching is now limited to planned ghosts and is covered. The quality review found duplicate authored Code ownership and repeat creation of a parent-qualified empty C# project; container Code ownership was removed, generated duplicate artifacts were deleted, qualified lookup became symmetric with creation, and targeted re-review passed. The final full-context complexity review found no blocker, chose the current architecture, and confirmed the domain grouping and APIs reduce likely junior mistakes. Its two accepted reductions removed an unreachable summary branch and indexed placements once per observation.

Verification: bun run check passed (81 Node tests and 168 Bun tests). Focused scan/accept/watch tests passed. The .NET 10 C# suite passed 4 tests. Two production MassTransit scans were byte-identical (SHA-256 8510fdff833b35261e297f60cca445bb989c816fadc2cddfb870694dce801bfd) with 56 scopes, 5,427 files, 9,712 symbols, 5,427 placements, and 209 relationships; Git state was unchanged. The Bun adapter also parsed the complete MassTransit observation through the shared TypeScript validator.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced TypeScript C4 candidates with one validated atomic observation contract shared by TypeScript and Roslyn C#, then reconciled complete batches without changing curated multi-file ownership. Unknown files remain singleton evidence under import/directory/project placement, planned names match without acceptance, and repeated qualified C# scopes stay stable. Removed obsolete scanner implementations and trial artifacts, grouped production scanners by domain, and updated the authored architecture and scanner docs. Verified with bun run check (81 Node + 168 Bun tests), 4 C# tests, byte-identical repeated MassTransit scans over 5,427 files with unchanged target Git state, successful cold/specification/quality/full-context reviews, and clean targeted re-reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
