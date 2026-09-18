---
id: TASK-424
title: Compare duplicate logic across every official scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 14:33'
labels: []
dependencies: []
references:
  - src-architecture-findings
  - organisms-details
  - screen
  - scanner-src-index
modified_files:
  - docs/architecture-findings.md
  - src/architecture-findings.ts
  - src/viewers/web/organisms/code-lists.ts
  - src/viewers/tui/panes/details.ts
  - test-bun/architecture-findings.test.ts
  - docs/scanners/creating-a-plugin.md
  - packages/scanner/src/index.ts
type: feature
ordinal: 490000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma lint` compares operations only when a scanner reports each operation's source range and binding-normalized body tokens (`docs/architecture-findings.md`). Only the TypeScript scanner does, so duplicate logic in Java, C#, Go, Rust, Python, PHP and Vue files is never found, and an empty lint result says nothing about those languages. Each scanner already parses these files; the tokens replace local names with slots and keep operators, literals, property names and unresolved identifiers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every official scanner that reads operation bodies reports their source ranges and binding-normalized tokens under the shared contract.
- [x] #2 groma lint reports duplicate and near-duplicate logic within each supported language using the same core comparison.
- [x] #3 Architecture findings documentation lists the languages covered.
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
1. List the covered languages in docs/architecture-findings.md, each linking its scanner page's Compared operations section, and state that whether a named function literal is compared differs by language.
2. Attach groma lint copies to outline rows by file and containing line range instead of by operation name, so qualified names match, and update the web code list and the terminal details pane.
3. Cover the fix with a focused test whose fixture operations carry qualified names.
4. Point scanner authors at the shared rule from docs/scanners/creating-a-plugin.md and from the ScanOperation tokens comment.
5. Verify the change in a detached worktree with bun run check, plus the per-language duplicate suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parent work after the seven language subtasks.

Documentation (AC #3). docs/architecture-findings.md now lists the covered languages, each linking its own scanner page's Compared operations section: TypeScript, Vue, Java, C#, Go, Rust, Python and PHP. The shared rule stays in that one page; the list states that whether a function literal assigned to a name is compared differs by language (TypeScript, Go and Vue compare them, while C#, Python and PHP treat every closure or lambda as an anonymous callback) and sends the reader to the per-language page for its own exceptions. docs/scanners/creating-a-plugin.md and the ScanOperation tokens comment in packages/scanner/src/index.ts now point at that rule, so a scanner author neither tokenizes anonymous callbacks nor filters a body by size.

Copy attachment defect (part of AC #2). src/architecture-findings.ts joined a code row to a finding instance by operation name, so a scanner that qualifies names never matched and the web code list and the terminal details pane showed no copies for it. copiesOf now takes only file and line and joins through holdsLine, the instance whose reported source range holds the row's line; both consumers (src/viewers/web/organisms/code-lists.ts, src/viewers/tui/panes/details.ts) pass the row's own line. test-bun/architecture-findings.test.ts covers it with operations named Launch::isReady and Run::canStart whose row line sits inside the reported range, and asserts a line outside every range has no copies.

Reproduction and fix evidence. A probe over the php-duplicates fixture (scanRepository, loadAnnotatedArchitecture, readCodeStructure, copiesOf) reported two findings whose instances are Billing\\invoiceTotal invoice.php:4-12 with Billing\\Quote::__construct quote.php:8-16, and Launch\\isReady readiness.php:4-13 with Launch\\Schedule::canStart scheduling.php:6-15. The previous name join attached copies to 0 of those code rows; the range join attaches them to all 4.

AC #1 evidence. Operations carry startLine, endLine and tokens from the TypeScript (plugins/scanners/typescript/src/source-operations.ts), Vue, Java, C#, Go, Rust, Python and PHP scanners. Subtask tests: 'Java reports tokens and ranges for named bodies only, normalizing local names' (test-bun/java-duplicates.test.ts), 'Go attaches source ranges and binding-normalized tokens only to named operations' (test-bun/go-scanner.test.ts), 'the Vue scanner and the TypeScript scanner report the same tokens for one body' (test-bun/vue-scanner.test.ts), ComparedOperationTests (plugins/scanners/csharp/dotnet/test), and the PHP case in 'packaged PHP discovers source without Composer and reports exact syntax evidence without execution' (test-bun/php-scanner.test.ts), which asserts tokens on a small named body and none on a nested closure. The Angular and React scanners add template and hook evidence to the TypeScript scanner's observation (docs/scanners/angular/index.md) and read no operation bodies of their own, so they report no tokens.

AC #2 evidence. Each language reaches the same core comparison through src/cli.ts lint over a fixture: 'groma lint reports identical and near-duplicate Java bodies across renamed local names', 'groma lint reports identical and near-duplicate C# bodies, but not callbacks or small near-duplicates', 'groma lint reports identical and near-duplicate Go bodies across renamed local names', 'lint finds identical and near-duplicate Rust functions but never closures or constant initializers', 'lint finds identical and near-duplicate Python functions but never callbacks or initialization code', 'lint finds identical and near-duplicate PHP functions and methods but never closures', and 'groma lint reports identical and near-duplicate Vue bodies, but not callbacks or small bodies'. TypeScript is covered by test-bun/architecture-findings.test.ts and test-bun/lint-command.test.ts.

Verification. Detached worktree at b3d62477 holding only this change: bun run check exited 0 (node 16 pass, bun 458 pass, 28 skip, 0 fail). The opt-in native suites ran in the same worktree: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 8 pass, 0 fail; bun plugins/scanners/rust/build.ts then GROMA_TEST_RUST bun test test-bun/rust-scanner.test.ts 6 pass, 0 fail; bun scripts/package-csharp-scanner.ts then GROMA_TEST_CSHARP_PACKAGE bun test test-bun/csharp-lint.test.ts 1 pass, 0 fail. The C# suite first failed against a package built before the C# token work, which reported no duplicates; rebuilding the package from the current source resolved it.

Closing review round: three corrections to the range join.

Only an operation row asks for copies. A type row can hold its first method's start line, which is the shape Go reports for a foreign type's entry and Java's compact source reports at line 1, so one copy appeared twice, once under a declaration with no body. src/viewers/web/organisms/code-lists.ts and src/viewers/tui/panes/details.ts now request copies only when declaration.kind is 'function'; member rows are unchanged. Checked at both call sites; no automated consumer test covers it, because neither viewer has a rendering harness in the suite for a type row whose line equals a method start.

copiesOf takes the innermost holder. Nested compared operations are real in Python, Rust, Java and C#, and every holder used to contribute, so copies of different operations merged and 'similar' was OR-ed. operationAt now picks the single instance with the smallest endLine minus startLine and returns that finding's copies and its own match only. test-bun/architecture-findings.test.ts covers it with an exact outer pair over lines 1 to 40 and a similar nested pair over 10 to 20: the row at line 12 sees only the nested copy and reads as similar, the row at line 5 only the enclosing copy and reads as exact.

The dedupe key keeps the operation name, so two operations starting on one line, such as a C# get and set pair, do not collapse. The renamed test also checks a row at an operation's own start line, the range comment uses PHP's member form Shop\OrderService::store, and the per-language sentence in docs/architecture-findings.md now covers all eight listed languages, with Java and Rust in the group that compares no closure or lambda.

JavaScript and Swift are not in the covered list. Neither scanner exists in the committed repository: git ls-files reports nothing tracked under plugins/scanners/swift, plugins/scanners/javascript, docs/scanners/swift or docs/scanners/javascript, and the committed src/scanner/modules/official-catalog.ts lists ten official scanners without them. Both are uncommitted work in other lanes (TASK-431 and TASK-418), which own their pages and their own entry in this list.

Verification of this round: detached worktree at 21e9e02c holding only this change, bun run check exited 0 (bun 462 pass, 30 skip, 0 fail). The php-duplicates probe still attaches copies to all four code rows, where the previous name join attached none.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every official language scanner (TypeScript, Vue, Java, C#, Go, Rust, Python, PHP) reports operation source ranges and binding-normalized tokens, and groma lint compares them through one core comparison; docs/architecture-findings.md now lists those languages with a link to each scanner page's Compared operations section and notes that comparing a function literal assigned to a name is a per-language decision. The parent also fixed the code listing: copies attached to a row by operation name, so a scanner that qualifies names (PHP's Launch\\isReady) showed none; copiesOf now joins by file and containing source range, with the web code list, the terminal details pane and a focused qualified-name test following. Verified in a detached worktree holding only this change: bun run check exited 0 (node 16 pass, bun 458 pass, 0 fail), the opt-in Go, Rust and C# suites passed after building their workers, and a probe over the php-duplicates fixture showed the old name join attaching copies to 0 rows where the range join attaches them to all 4.
<!-- SECTION:FINAL_SUMMARY:END -->
