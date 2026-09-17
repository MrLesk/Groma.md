---
id: TASK-424.3
title: Report comparable operation bodies from the Go scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:41'
labels: []
dependencies: []
references:
  - worker-main
  - tokens
modified_files:
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/tokens.go
  - plugins/scanners/go/worker/evidence.go
  - test/fixtures/go-duplicates/go.mod
  - test/fixtures/go-duplicates/ready.go
  - test/fixtures/go-duplicates/copy.go
  - test/fixtures/go-duplicates/forms.go
  - test-bun/go-scanner.test.ts
  - docs/scanners/go/index.md
parent_task_id: TASK-424
type: feature
ordinal: 493000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in Go because the Go scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Go scanner reports source ranges and binding-normalized tokens for Go operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
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
1. Go worker tokens.go: operationTokens(info, FuncDecl or FuncLit) returns binding-normalized tokens, never nil. Receiver, parameters and named results are bound to slots in declaration order; every other name declared inside the operation becomes a slot in order of first use, keyed by the go/types declaration position (the type-switch variable is bound at its header). Package-level names (including the operation's own name), fields, methods, builtins and unresolved names keep their text. Operators, literals, selector names, keywords, slice bounds and nested function literals ('fn' plus body) are kept.
2. evidence.go: named operations under docs/architecture-findings.md#compared-operations get startLine, endLine and tokens: functions and methods with a body except package init functions; function literals assigned to a named variable (var, :=, =) or written as a keyed element of a composite literal that is not directly a call argument (alone or behind &). Those literals take the variable name or key source text. Other literals stay 'closure' without tokens; package variable initializers get none. No scanner size filter.
3. contract.go: operation gains startLine, endLine and tokens with omitzero.
4. Fixture test/fixtures/go-duplicates: identical pair with renamed locals, near-duplicate pair, operation forms, recursive and slice cases.
5. test-bun/go-scanner.test.ts (GROMA_TEST_GO): scanner test for compared forms, ranges, empty body, renamed-local equality and distinct package names and slice bounds; groma lint CLI test for identical and near-duplicate pairs.
6. docs/scanners/go/index.md: Compared operations section.
7. Verify with Go tests, go vet and the isolated bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. Go worker: tokens.go tokenizes bodies with go/types bindings (locals keyed by declaration position, receiver/params/named results bound first, type-switch variable bound at its header position); evidence.go attaches startLine/endLine/tokens to functions and methods (not package init functions) and to function literals assigned to a named variable (var, :=, =) or keyed in a composite literal that is not directly a call argument (alone or behind &); those literals are named after the variable or key, others stay 'closure' without tokens; package variable initializers get none. contract.go uses omitzero so an empty named body reports tokens [] with its range. No scanner size filter; core applies the minimums.
Decisions to confirm in review: (a) the shared rule counts literals assigned to named variables and keyed composite-literal values as named operations, so Go compares those rather than excluding every function literal; (b) func init() is treated as initializer code; (c) &T{...} as an argument counts as passed directly.
Verification: GROMA_TEST_GO=go bun test test-bun/go-scanner.test.ts, 4 pass. New scanner test proves which forms carry tokens, an empty body reports [], ranges match source lines, and renamed params/results/range/type-switch variables give equal tokens. New CLI test runs groma lint with the Go scanner configured to a temp-built worker and finds the identical pair (ReadyToRun/CanStart, renamed locals) and the near-duplicate pair (Completion/Progress, not identical). go vet passes. Isolated worktree at HEAD plus only this task's files: GROMA_TEST_GO bun run check passed (Biome: 1 pre-existing warning in files not touched; tsc; node 16 pass; bun 375 pass, 15 skip, 0 fail).
Notes: the scan watcher created an untracked singleton component 'tokens' (groma/.../components/tokens.md) for the new worker file; it is referenced but not curated here. docs/architecture-findings.md still names only the TypeScript page for compared operations (parent TASK-424 AC#3).

Cold review fixes: (1) the FuncDecl's own name was a slot because its declaration lies inside the operation range, so recursive Fact and Factorial were identical; package-scope objects now keep their text. (2) Slice bounds were dropped, so s[:n] and s[n:] were identical; slices now emit X, low, ':', high and the third index. Fixture cases Fact/Factorial and Head/Tail were added and failed before the fix. Accepted cleanups: operationTokens(info, node) signature, non-nil result comment, dropped always-true type-switch length checks, expressionKeyword rename, argumentLiterals rename, doc wording for keyed elements and slot order. The coordinator confirmed the three judgment calls (shared-rule named literals, init as initializer code, &T{...} passed directly) and will curate the watcher-made 'tokens' component separately.
Re-verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 4 pass (26 expects); go vet passes; isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 pre-existing warning in untouched files; node 16 pass; bun 378 pass, 15 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now reports source ranges and binding-normalized body tokens for named operations: functions, methods, and function literals assigned to a named variable or keyed in a non-argument composite literal. Anonymous literals, package variable initializers and init functions get none, and core applies the size minimums. A go/types-backed tokenizer (plugins/scanners/go/worker/tokens.go) turns names declared inside the operation into slots and keeps package-level names, fields, operators, literals and slice bounds. docs/scanners/go/index.md lists the compared operations. Verified with new Go fixture tests (which forms are compared, renamed-local equality, distinct recursive names and slice bounds) and a groma lint CLI test that finds the identical and near-duplicate pairs, plus an isolated GROMA_TEST_GO bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
