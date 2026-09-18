---
id: TASK-410.2
title: Outline C# sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:37'
updated_date: '2026-09-18 17:43'
labels: []
dependencies: []
references:
  - dotnet-scanner
  - program
  - csharp-src-index
modified_files:
  - plugins/scanners/csharp/dotnet/SourceOutline.cs
  - plugins/scanners/csharp/dotnet/Command.cs
  - plugins/scanners/csharp/src/adapter.ts
  - plugins/scanners/csharp/src/index.ts
  - test/fixtures/csharp-outline/groma/index.md
  - test/fixtures/csharp-outline/groma/project.md
  - test/fixtures/csharp-outline/groma/systems/shop/system.md
  - test/fixtures/csharp-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/csharp-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/csharp-outline/web/orders.ts
  - test/fixtures/csharp-outline/Orders/OrderService.cs
  - test/fixtures/csharp-outline/Orders/OrderService.Audit.cs
  - plugins/scanners/csharp/dotnet/test/OutlineTests.cs
  - test-bun/csharp-outline.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - plugins/scanners/csharp/src/process.ts
  - plugins/scanners/csharp/dotnet/Program.cs
  - test/fixtures/csharp-process/exits-at-once.mjs
  - test-bun/csharp-process.test.ts
parent_task_id: TASK-410
type: feature
ordinal: 458000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
C# components show only files. The C# worker already reads Roslyn syntax trees.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 C#-owned files show their classes, structs, records and interfaces with methods, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The C# scanner documentation describes the outline.
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
1. Roslyn worker: SourceOutline.cs parses each requested file with Roslyn syntax only (no project load, MSBuild or restore). Top-level means directly in the file or inside file-scoped or braced namespaces. Classes, structs, records, interfaces, enums and delegates are types; enums and delegates have no members, and nested types are not listed. Members are every method (including interface signatures and each overload), constructor (type name), finalizer (~Type) and operator in the type body, in source order. A type is an entry when the Code symbols contain its name; a member only when they contain Type.Member. Visibility follows the contract's C# row: any protected form is protected, file is private; with no modifier, top-level types are internal, interface members public and other members private.
2. Command.cs: the worker's --outline mode reads a JSON request {root, references} from standard input, decoded as UTF-8 (Program.cs), and prints CodeFile[] JSON; scanning is unchanged.
3. TypeScript adapter: readCSharpOutline(root, references, settings) runs the packaged worker with the settings' timeoutSeconds and writes the request to its standard input; the plugin index sets readCodeStructure to it.
4. Fixture test/fixtures/csharp-outline: a groma tree whose component Code interleaves two C# files (a partial class split over a file-scoped and a braced namespace) and a TypeScript file.
5. Tests: dotnet OutlineTests for declarations, lines, visibility and entry; packaged-scanner bun test (GROMA_TEST_CSHARP_PACKAGE) that runs core readCodeStructure with the C# and TypeScript scanners and checks Code order and entry.
6. docs/scanners/dotnet-csharp/index.md: Source outline section.
7. Verify: bun run test:csharp, package in an isolated worktree and run the gated test, isolated bun run check.

Review-fix round (external reviews of cf8e7975):
8. Fix: the outline request travels on the worker's standard input instead of one argv string. A component with 2000 Code files (1.18 MB request) failed with E2BIG on macOS (probe). process.ts always pipes standard input and ends it with the optional input (empty for scans), ignoring a pipe error because a worker that exits early is reported on close; Program.cs reads standard input as UTF-8 whatever the locale. Regressions: packaged csharp-outline tests for a request beyond the command-line limit and for a non-ASCII root under LC_ALL=en_US.ISO8859-1; test-bun/csharp-process.test.ts for a worker that exits before reading a 2 MB input.
9. No C# change for top-level assigned lambdas: they are locals of the program's entry point, and the shared outline contract states that C# top-level statements are not listed.
10. Skip: accessors are compared but not outlined (optional; the shared contract excludes accessors from outlines and the compared-operations page lists them).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: the worker accepts --outline <json {root, references}> (Command.cs), and SourceOutline.cs parses each file with CSharpSyntaxTree.ParseText only (no project load, MSBuild or restore). It returns contract-shaped CodeFile JSON, computing entry from the reference symbols and omitting files without types. Top-level = directly in the file or in file-scoped or braced namespaces (recursive). Types are classes, structs, records, interfaces and enums; delegates and nested types are not listed. Members = BaseMethodDeclarationSyntax in the type body: methods and interface signatures, constructors (type name), finalizers (~Type), operators (operator +, implicit operator int). Visibility: public; any protected form is protected; internal; private or file is private. Without a modifier: top-level types internal, interface members public, other members private. The adapter's readCSharpOutline runs the packaged worker; the plugin index exposes readCodeStructure.
Decisions: a file type maps to private (the contract's file-scoped meaning). A partial part without a modifier reports the default internal, because one file's syntax cannot see the other part; this is documented. Top-level-statement local functions are not listed.
Verification: bun run test:csharp passed 14/14; OutlineTests covers names, lines, visibility, entry, partial parts and namespaces on test/fixtures/csharp-outline. In an isolated worktree, the packaged scanner (bun scripts/package-csharp-scanner.ts) passed test-bun/csharp-outline.test.ts: core readCodeStructure with the C# and TypeScript scanners returns the component's C#, TypeScript and C# files in Code order, and marks only the named partial part as an entry. csharp-lint and csharp-source-units also passed (3/3). The isolated bun run check passed: Biome clean, typecheck passed, node 16/16, bun 377 pass, 21 skipped, 0 failed.

Cold review fixes (coordinator decisions): top-level delegates are listed as types without members; a member is an entry only when the Code symbols contain Type.Member, so a linked type no longer marks its constructors; readCSharpOutline takes scanner settings, uses their timeoutSeconds and is the plugin's readCodeStructure (the unused worker parameter and the unreachable empty-references check were removed); renames CodeMember->CodeSymbol, NameOf->MemberName, fallback->defaultVisibility; the fixture's second partial part has no modifier and the test expects internal. The docs add delegates, the Type.Member entry rule, unlisted primary constructors, and that the outline parses without preprocessor symbols (#if DEBUG skipped, #else listed). Recorded follow-up (not done): pass the outline request on stdin instead of one argv string, because of the Windows command-line length limit.
Re-verification: bun run test:csharp passed 14/14. In an isolated worktree, the packaged scanner passed csharp-outline, csharp-lint and csharp-source-units (3/3). The isolated bun run check passed: Biome clean, typecheck passed, node 16/16, bun 378 pass, 24 skipped, 0 failed.

Review-fix round (external reviews of cf8e7975, then a cold review): the outline request now travels on standard input, completing the recorded follow-up. A 2000-file request (1.18 MB) had failed with E2BIG. process.ts pipes standard input for every run and ignores its pipe error, so a worker that exits before reading is rejected on close instead of crashing Groma with EPIPE. Program.cs decodes standard input as UTF-8, because Console.In follows the locale's encoding and broke a non-ASCII root under LC_ALL=en_US.ISO8859-1. Top-level assigned lambdas stay unlisted: they are entry-point locals, and the shared contract now states that C# top-level statements are not listed, so the C# page keeps its short mention. Skipped: renaming the Command.cs local to request (it would clash with the scan branch's request local, CS0136) and outlining accessors (optional; the contract excludes them).
Verification: each regression failed before its fix (E2BIG on a HEAD-built package, EPIPE crash without the listener, path not found under the ISO-8859-1 locale on the Console.In build). In an isolated worktree: bun run test:csharp 15/15; packaged csharp-outline (3), csharp-lint, csharp-source-units and csharp-process pass; bun run check passed (Biome clean apart from existing diagnostics in other files, typecheck, node 16/16, bun 516 pass, 34 skip, 0 fail). The packaged csharp-http test fails identically on a HEAD-built package (core ranking changed after TASK-416.6); TASK-416.6 handles it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
C# components now show a source outline: the C# scanner implements readCodeStructure through a Roslyn syntax-only worker mode (--outline), with no project load, restore or build. It lists top-level classes, structs, records, interfaces, enums and delegates, including those in namespaces, with their methods, interface signatures, constructors, finalizers and operators. Each has a name line and C# visibility (defaults included, file types private). A type is an entry by name, a member by Type.Member. docs/scanners/dotnet-csharp/index.md describes the outline and its limits (no preprocessor symbols; partial parts without a modifier report the default). Verified by dotnet OutlineTests (test:csharp 14/14), by the packaged-scanner test-bun/csharp-outline.test.ts, where core readCodeStructure returns the component's C#, TypeScript and C# files in Code order with only the linked partial part marked as entry, and by the isolated bun run check.

Review-fix round: the adapter sends the outline request on the worker's standard input, decoded as UTF-8, so components with more Code files than a command line holds are outlined, and a worker that exits early is reported instead of crashing Groma. Verified by packaged tests for a 1.3 MB request and a non-ASCII root under an ISO-8859-1 locale, a process test for early exit, test:csharp and the isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
