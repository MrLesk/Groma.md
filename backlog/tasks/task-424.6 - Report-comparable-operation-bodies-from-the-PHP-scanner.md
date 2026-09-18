---
id: TASK-424.6
title: Report comparable operation bodies from the PHP scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 23:13'
labels: []
dependencies: []
references:
  - evidence
  - src-tokens
modified_files:
  - plugins/scanners/php/src/syntax.ts
  - plugins/scanners/php/src/tokens.ts
  - plugins/scanners/php/src/evidence.ts
  - test/fixtures/php-duplicates/readiness.php
  - test/fixtures/php-duplicates/scheduling.php
  - test/fixtures/php-duplicates/invoice.php
  - test/fixtures/php-duplicates/quote.php
  - test/fixtures/php-duplicates/callbacks.php
  - test-bun/php-scanner.test.ts
  - docs/scanners/php/index.md
  - test/fixtures/php-duplicates/prices.php
parent_task_id: TASK-424
type: feature
ordinal: 496000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in PHP because the PHP scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The PHP scanner reports source ranges and binding-normalized tokens for PHP operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
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
1. Parsing stays on the bundled php-parser 3.7.0 AST (JavaScript, no PHP or Composer).
2. Move the shared AST helpers (syntax guard, name, children) from plugins/scanners/php/src/evidence.ts to plugins/scanners/php/src/syntax.ts so evidence and tokens share them.
3. Add plugins/scanners/php/src/tokens.ts: binding-normalized tokens for one function or method, from parameter names and defaults and the body. Parameters and local variables become slots in first-appearance order (PHP has function scope). $this, superglobals, names declared global and static properties keep their names. Nested closures and named functions start an isolated scope (closure use variables share the outer slot); arrow functions inherit the enclosing scope. Operators, casts, literals, property, method and static member names, named argument names and unresolved names remain. Signature types and attributes are not walked.
4. In evidence.ts attach startLine, endLine and tokens only to function and method operations (constructors included). Closures and arrow functions keep their operations without tokens. PHP array members can only be closures or arrow functions, so the call-argument exclusion needs no extra rule; top-level and initializer code are not operations. No size filter: core applies both minimums.
5. Fixture test/fixtures/php-duplicates: an exact pair with renamed locals (function vs method), a near-duplicate pair including a constructor, and identical closures and array-member arrow functions in top-level code that must not be reported.
6. test-bun/php-scanner.test.ts: run groma lint on the fixture through the packaged scanner and assert exactly the two findings; assert a small named body still carries tokens and an arrow function carries none.
7. docs/scanners/php/index.md: add a Compared operations section in the TypeScript page's shape.
8. Run bun run check in an isolated worktree.

Review round (external cold reviews at cf8e7975):
9. Fix (Codex must-fix, tokens.ts:102): a variable the parser marks by reference, such as the value of foreach ($items as &$item), emits & before its slot, so reference iteration no longer matches value iteration.
10. Fix (lane brief check, reproduced): grouping parentheses were dropped, so ($x + $y) * $z and $x + $y * $z had identical tokens; an expression the parser marks parenthesized is wrapped in ( and ) tokens.
11. Verified unaffected: postfix ++ and -- already emit their operator after the operand.
12. Fix (Grok-all docs finding): the PHP page no longer calls skipping assigned closures a PHP exception; it points at the shared language split.
13. Regression tests: the php-duplicates lint fixture gains a by-reference/by-value foreach pair and a grouped/ungrouped expression pair that must not be reported.

Simplicity round: tokens.ts imports Fields from syntax.ts instead of redeclaring it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parsing: the bundled php-parser 3.7.0 JavaScript AST; no PHP, Composer or project tools run.
Implementation: plugins/scanners/php/src/tokens.ts tokenizes one function or method; evidence.ts attaches startLine, endLine and tokens only to operations with a declared name (functions and methods, constructors included). AST helpers moved to syntax.ts so evidence and tokens share them without a circular import. No size filter in the scanner: core applies both minimums; the php-source test asserts a small named body still carries tokens.
Decisions: closures and arrow functions stay anonymous even when assigned to a variable (orchestrator instruction; same as the Python lane's lambdas). PHP array members can only be closures or arrow functions, so the call-argument exclusion needs no extra rule. Parameter defaults are walked as part of the body, as in the TypeScript reference. $this, superglobals, global-declared names and static properties keep their names.
Verification: bun test test-bun/php-scanner.test.ts, 4 pass; the lint test reports exactly readiness.php:4 = scheduling.php:6 (identical, renamed locals) and invoice.php:4 ~ quote.php:8 (constructor, not identical). A manual tokenization of callbacks.php confirmed its closures (19 tokens) and array-member arrow functions (13 tokens) would be exact copies if tokenized, so their absence is meaningful. bun run check in an isolated worktree with only this task's changes: exit 0 (Biome: only pre-existing findings in build.ts, vue-scanner.test.ts, iso-map.test.ts; tsc clean; node 16 pass; bun 374 pass, 17 skip, 0 fail).

Cold review applied: removed the selfreference, parentreference, staticreference and nullkeyword emitters (the default path emits the kind); renamed silent to wrappers, members to memberOperators, global to globalStatement, syntax to isSyntax, body to comparable; completed the nested-scope comment; rewrote the docs section as compared and not-compared lists naming closures and arrow functions as the PHP exception; callbacks.php now holds two identical closures assigned to variables. Dropped grouping parentheses and lost block boundaries were left unchanged as a cross-scanner follow-up shared with the TypeScript scanner.
Re-verification: bun test test-bun/php-scanner.test.ts 4 pass; isolated bun run check exit 0 (tsc clean, node 16 pass, bun 375 pass, 20 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Review round (external cold reviews at cf8e7975): reproduced with an operationTokens probe that foreach ($items as &$item) and the by-value loop gave identical tokens, and that ($x + $y) * $z and $x + $y * $z did too (php-parser marks the source group with parenthesizedExpression). The variable emitter now emits & before a variable the parser marks byref, and walk wraps a parenthesized expression in ( and ) tokens; syntactic parentheses of if, while and call arguments are not marked and emit nothing. Postfix ++ and -- already emitted their operator (verified, unchanged). Regression: test/fixtures/php-duplicates/prices.php holds a by-reference/by-value foreach pair and a grouped/ungrouped pair; without the fix groma lint reported both as identical, with it the exact finding list is unchanged. The PHP page no longer calls the closure rule a PHP exception and states that grouping parentheses and the foreach & remain. Verification: bun test test-bun/php-scanner.test.ts 5 pass; isolated bun run check exit 0 (tsc clean; node 16 pass; bun 513 pass, 32 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Cold review of the review-round fix applied: closure use imports are now walked as variables in the enclosing scope before the closure's scope opens, so the variable emitter pushes & plus the slot and the imports map reads find(outer, name); use (&$a, $b) and use ($a, &$b) no longer tokenize alike (previously no import emitted any token). prices.php gained that pair (collectTotals, collectTaxes); without the change lint reported them identical. The PHP page says every source parenthesis around an expression stays and names the foreach and use &. Follow-ups recorded, not fixed: by-reference parameters (function f(array &$a) { $a[] = 1; } matches its by-value version, because no scanner compares signatures), and lost block boundaries (if ($x) { f(); } g(); matches if ($x) { f(); g(); }), a cross-scanner follow-up the coordinator records for the owner. Verification: bun test test-bun/php-scanner.test.ts 5 pass; isolated bun run check at d007cb75 exit 0 (tsc clean; node 16 pass; bun 516 pass, 32 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Simplicity round: tokens.ts now imports Fields from syntax.ts instead of redeclaring it; no behavior change. bun test test-bun/php-scanner.test.ts 5 pass; isolated bun run check at d04c2b21 exit 0 (tsc clean; node 16 pass; bun 594 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The PHP scanner now reports startLine, endLine and binding-normalized body tokens for named functions and methods, constructors included, so groma lint finds duplicate PHP logic. Closures and arrow functions are never compared: PHP is one of the languages whose scanner treats every closure and arrow function as an anonymous callback under the shared rule. Tokenization (plugins/scanners/php/src/tokens.ts) turns parameters and local variables into slots and keeps operators, literals, member names and unresolved names; core applies the size minimums. The PHP scanner page lists compared and excluded operations. Verified by a packaged-scanner groma lint test on test/fixtures/php-duplicates (one identical pair with renamed locals, one near-duplicate constructor, identical closures and arrow functions absent) and an isolated bun run check (exit 0).

Review round: tokens now keep the & of a by-reference foreach variable and of a by-reference closure import (imports are emitted as slots in the enclosing scope), and every source parenthesis around an expression, so bodies that differ only there are no longer identical copies; postfix ++ and -- were already kept. The PHP page describes these tokens and no longer calls the closure rule an exception. test/fixtures/php-duplicates/prices.php holds the three pairs, which lint reported as identical before the change; verified by bun test test-bun/php-scanner.test.ts and an isolated bun run check (exit 0).

Simplicity round: the tokenizer reuses the shared Fields type.
<!-- SECTION:FINAL_SUMMARY:END -->
