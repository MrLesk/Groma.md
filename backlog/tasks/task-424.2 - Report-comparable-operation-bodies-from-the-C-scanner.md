---
id: TASK-424.2
title: Report comparable operation bodies from the C# scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:42'
labels: []
dependencies: []
references:
  - dotnet-scanner
  - program
modified_files:
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/OperationTokens.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - test/fixtures/csharp-duplicates/Scheduling.csproj
  - test/fixtures/csharp-duplicates/Readiness.cs
  - test/fixtures/csharp-duplicates/Runner.cs
  - test/fixtures/csharp-duplicates/Callbacks.cs
  - test/fixtures/csharp-duplicates/Pricing.cs
  - test/fixtures/csharp-duplicates/Quote.cs
  - test/fixtures/csharp-duplicates/Checks.cs
  - plugins/scanners/csharp/dotnet/test/ScannerFixture.cs
  - plugins/scanners/csharp/dotnet/test/ComparedOperationTests.cs
  - test-bun/csharp-lint.test.ts
  - docs/scanners/dotnet-csharp/index.md
parent_task_id: TASK-424
type: feature
ordinal: 492000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in C# because the C# scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The C# scanner reports source ranges and binding-normalized tokens for C# operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
- [x] #2 Independent fixtures show identical and near-duplicate bodies found by groma lint, and renamed local names still matching.
- [x] #3 The scanner documentation states which operations are compared.
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
1. Roslyn worker: add optional StartLine, EndLine and Tokens to the C# ScanOperation record (JSON omits nulls; the TypeScript contract parser already validates them).
2. New OperationTokens.cs: walk the lexical tokens of an operation's parameter list, constructor initializer and body. A name bound to a parameter, local, range variable, label or local function becomes a slot $n in first-seen order; a member-access name becomes .Name; other identifiers (types included), keywords, literals and operators keep their text; grouping and separating punctuation is dropped and an argument-list parenthesis becomes call. No size filtering (core owns both minimums).
3. OperationEvidence.Declared attaches the range and tokens to every non-anonymous operation the worker already reports: methods, constructors, finalizers, operators, accessors, expression-bodied property/indexer getters and local functions. Lambdas, anonymous methods and top-level statements get none; initializers are not operations.
4. Fixture test/fixtures/csharp-duplicates: one project with renamed exact copies, a separate near-duplicate pair, a small near-duplicate pair, and a field lambda with the exact copies' body.
5. Tests: dotnet ComparedOperationTests (ScannerFixture takes the fixture name) for which operations carry tokens, renamed locals matching and unfiltered small bodies; packaged-scanner bun test test-bun/csharp-lint.test.ts (GROMA_TEST_CSHARP_PACKAGE, like csharp-source-units) that runs groma lint on the fixture.
6. docs/scanners/dotnet-csharp/index.md: add a Compared operations section in the TypeScript page's shape.
7. Verify: bun run test:csharp, package the scanner in an isolated worktree and run the gated lint test, isolated bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: the Roslyn worker's ScanOperation carries optional StartLine/EndLine/Tokens. OperationEvidence.Declared adds the node's inclusive line range and OperationTokens.Of for every non-anonymous operation it already reports (methods, constructors, finalizers, operators, accessors, expression-bodied getters, local functions). Lambdas and anonymous methods get none, even when assigned to a variable or field. Top-level statements get none, and initializers are not operations. No size filtering in the scanner.
Tokens: lexical tokens of the parameter list, constructor initializer and body. Parameters, locals, range variables, labels and local functions become slots in first-seen order. Member-access names become .Name. Other identifiers (types included), keywords, literals and operators keep their text. Braces, parentheses, brackets, commas, semicolons and dots are dropped, and an argument-list parenthesis becomes call.
Decision: declared parameter and local types remain tokens, so copies that differ only in types are not identical. Documented in docs/scanners/dotnet-csharp/index.md.
Correction: docs/scanners/dotnet-csharp/index.md first had an uncommitted TASK-422 change, so it was edited only after TASK-422 committed.
Verification: bun run test:csharp passed 12/12, including ComparedOperationTests: named operations carry tokens and ranges, only the lambda and the top-level code lack them, renamed copies have equal tokens, the near copy differs in exactly two literals, and a small body is still reported. The scanner was packaged with bun scripts/package-csharp-scanner.ts in an isolated worktree. GROMA_TEST_CSHARP_PACKAGE=<package> bun test test-bun/csharp-lint.test.ts test-bun/csharp-source-units.test.ts passed 2/2: groma lint reports Readiness.CanStart/Runner.ReadyToRun as identical, and Pricing.Total/Quote.Estimate as not identical. It does not report Callbacks.cs (lambda initializer) or Checks.cs (12-token near copies below core's 24-token minimum). The isolated bun run check passed: Biome clean, typecheck passed, node 16/16, bun 371 pass, 18 skipped, 0 failed.

Cold review fixes: (1) a named-argument label is kept as text rather than resolved to the callee's parameter slot, so Send(to: a, from: 1) and Send(from: a, to: 1) differ; (2) the C# page now lists assigned lambdas and anonymous methods under 'These named operations are not compared' and states that local functions among top-level statements are compared; (3) the OperationTokens summary covers range variables, labels, local functions, why punctuation is dropped, lost grouping and call; (4) a recursive local function's own name was a slot, which made different recursions identical; it now stays text, like a method name; (5-9) catch-all arm comment, slots keyed on OriginalDefinition, renames (ScanOperationOf, NameToken, OtherToken, cancellationToken), removed a redundant assertion, ScannerFixture layout comment. The new ArgumentLabelsAndTheOperationsOwnNameStayText test fails without fix 1 and without fix 4.
Re-verification: bun run test:csharp passed 13/13. The packaged scanner, rebuilt in an isolated worktree, passed test-bun/csharp-lint.test.ts and csharp-source-units.test.ts 2/2. The isolated bun run check passed: Biome clean, typecheck passed, node 16/16, bun 374 pass, 20 skipped, 0 failed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The C# Roslyn worker now reports inclusive line ranges and binding-normalized body tokens for implemented methods, constructors, finalizers, operators, accessors and local functions, so groma lint finds duplicate and near-duplicate C# logic. Lambdas, anonymous methods and top-level statements carry none; initializers are not operations, and core applies the size minimums. Parameters, locals and other local-scoped names become slots. Argument labels and an operation's own name stay text. Grouping punctuation is dropped, and an argument list becomes call. docs/scanners/dotnet-csharp/index.md documents which operations are compared. Verified by dotnet ComparedOperationTests (13/13 in test:csharp), by the packaged-scanner test-bun/csharp-lint.test.ts, which runs groma lint on test/fixtures/csharp-duplicates (identical renamed copies and a near-duplicate are reported; a lambda copy and small near copies are not), and by the isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
