---
id: TASK-228.1
title: Load every scanner through one module contract
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:08'
updated_date: '2026-08-31 19:03'
labels: []
dependencies: []
references:
  - scan-observation
  - scan-lifecycle
  - typescript-scanner
  - c-scanner
  - scanner
modified_files:
  - src/scanner/observation.ts
  - packages/scanner/src/index.ts
  - packages/scanner/package.json
  - src/scanner/typescript/files.ts
  - plugins/scanners/typescript/src/files.ts
  - src/scanner/typescript/graph.ts
  - plugins/scanners/typescript/src/graph.ts
  - src/scanner/typescript/scan.ts
  - plugins/scanners/typescript/src/scan.ts
  - plugins/scanners/typescript/src/naming.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/typescript/package.json
  - src/scanner/csharp/adapter.ts
  - plugins/scanners/csharp/src/adapter.ts
  - src/scanner/csharp/Command.cs
  - plugins/scanners/csharp/dotnet/Command.cs
  - src/scanner/csharp/Contract.cs
  - plugins/scanners/csharp/dotnet/Contract.cs
  - src/scanner/csharp/Groma.CSharpScanner.csproj
  - plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj
  - src/scanner/csharp/Program.cs
  - plugins/scanners/csharp/dotnet/Program.cs
  - src/scanner/csharp/Scanner.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - src/scanner/csharp/packages.lock.json
  - plugins/scanners/csharp/dotnet/packages.lock.json
  - src/scanner/csharp/test/ContractTests.cs
  - plugins/scanners/csharp/dotnet/test/ContractTests.cs
  - src/scanner/csharp/test/Groma.CSharpScanner.Tests.csproj
  - plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj
  - src/scanner/csharp/test/ScannerTests.cs
  - plugins/scanners/csharp/dotnet/test/ScannerTests.cs
  - plugins/scanners/csharp/src/index.ts
  - plugins/scanners/csharp/package.json
  - src/scanner/registry.ts
  - src/scanner.ts
  - src/scan-reconciler.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/okf-writers.test.ts
  - test/accept.test.ts
  - package.json
  - tsconfig.json
  - biome.json
  - bun.lock
  - >-
    groma/observed/systems/groma/containers/scanner/components/scan-observation.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/c-scanner.md
  - groma/observed/systems/groma/containers/scanner/container.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/index.md
  - src/scanner/csharp/.gitignore
  - plugins/scanners/csharp/dotnet/.gitignore
parent_task_id: TASK-228
priority: high
type: feature
ordinal: 245000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Groma developer runs the normal scan command. The embedded TypeScript scanner and official optional scanners enter the scan and watch lifecycle through one small TypeScript module contract and one registry. Official scanner source is grouped by domain under plugins/scanners. The existing Markdown reconciliation remains the semantic authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The official TypeScript and C# scanner source is grouped under plugins/scanners/typescript and plugins/scanners/csharp.
- [x] #2 A public scanner contract exposes the minimum identity, watched-file matching, and complete-observation scan operations required by the current scan lifecycle.
- [x] #3 The TypeScript scanner is statically embedded through its official module entry point; optional scanners use the same entry-point shape.
- [x] #4 Scan and watch obtain scanners from one registry and contain no scanner-specific TypeScript or C# branches.
- [x] #5 Existing supported TypeScript and C# scanning behavior remains correct through the shared observation and reconciliation contracts.
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
1. Publish the existing ScanObservation validation and the minimal ScannerPlugin interface (id, matchesFile, scan) from the @groma/scanner workspace package.
2. Move the TypeScript and C# implementations into plugins/scanners/<language>, give each one a package entry point, and remove TypeScript scanner imports of Groma-private helpers.
3. Add one private Groma scanner registry that collects observations and answers watch-file matching; make scanRepository and watchScan depend only on those registry operations. Keep both current scanners registered in this slice so existing scan behavior remains intact; TASK-228.2 will add optional discovery.
4. Keep the cross-language evidence tests in the shared scanner suite, update their package imports plus repository TypeScript, Biome, Bun, and .NET paths, and remove task-local complexity warnings in the moved TypeScript scanner.
5. Update scanner author documentation and the observed Scanner architecture to the public contract, registry, and plugin paths; run focused and repository checks plus the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the public @groma/scanner workspace package, TypeScript and C# scanner packages, and a language-neutral registry used by scan and watch. Focused TypeScript, scanner evidence, CLI scan, and watch checks pass. The .NET SDK is not installed on this host, so the moved C# suite could not run here. The full repository check passed 91 Node tests and all scanner-related Bun tests; one unrelated concurrent Web watcher test timed out, then passed in 272 ms when rerun alone. The cold simplicity review and its targeted re-review passed after premature manifest fields were removed, the registry list made private, and two existing TypeScript scanner complexity warnings were eliminated.

Final verification: scanner evidence passes 7/7, scan/watch behavior passes 3/3 outside restricted filesystem watching, TypeScript passes, and Node passes 91/91. A complete earlier repository run passed Bun 214/214. After the final .gitignore relocation, the full concurrent Bun run passed 213/214; its unrelated Backlog directory-watch timeout passes alone in 12 ms. The specification review passed. The quality review confirmed observed evidence counts and C# package behavior, with only restricted-environment watcher failures. The full-context complexity review approved the contract, explicit registry, and domain grouping after moving the C# .gitignore and deleting obsolete generated output.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Grouped the TypeScript and C# scanners under plugins/scanners, introduced the minimal public @groma/scanner contract and one private registry for scan/watch, updated author documentation and observed architecture, and verified the shared behavior with scanner evidence, CLI/watch, type, Node, Bun, simplicity, specification, quality, and complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
