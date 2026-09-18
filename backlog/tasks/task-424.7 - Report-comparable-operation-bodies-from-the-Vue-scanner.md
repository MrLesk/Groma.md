---
id: TASK-424.7
title: Report comparable operation bodies from the Vue scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 23:00'
labels: []
dependencies: []
references:
  - vue-src-index
  - operations
  - source-operations
  - src-evidence
modified_files:
  - plugins/scanners/vue/src/sfc.ts
  - plugins/scanners/vue/src/outline.ts
  - plugins/scanners/vue/src/tokens.ts
  - plugins/scanners/vue/src/operations.ts
  - plugins/scanners/vue/src/index.ts
  - test/fixtures/vue-duplicates/package.json
  - test/fixtures/vue-duplicates/tsconfig.json
  - test/fixtures/vue-duplicates/Readiness.vue
  - test/fixtures/vue-duplicates/Runner.vue
  - test/fixtures/vue-duplicates/Pricing.vue
  - test/fixtures/vue-duplicates/Quote.vue
  - test/fixtures/vue-duplicates/Callbacks.vue
  - test/fixtures/vue-duplicates/Checks.vue
  - test/fixtures/vue-duplicates/Totals.vue
  - test/fixtures/vue-duplicates/totals.ts
  - test-bun/vue-lint.test.ts
  - test/fixtures/vue-duplicates/Depth.vue
  - test/fixtures/vue-duplicates/Height.vue
  - test/fixtures/vue-duplicates/Head.vue
  - test/fixtures/vue-duplicates/Tail.vue
  - plugins/scanners/typescript-outline.ts
  - test-bun/vue-scanner.test.ts
  - docs/scanners/vue/index.md
  - plugins/scanners/typescript-operations.ts
  - plugins/scanners/typescript/src/source-tokens.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - plugins/scanners/javascript/src/evidence.ts
  - plugins/scanners/javascript/src/tokens.ts
  - test/fixtures/distinct-bodies/bodies.ts
  - test-bun/architecture-findings.test.ts
  - test/fixtures/javascript-parity/pick.js
  - test/fixtures/javascript-parity/pick.ts
  - test/fixtures/javascript-duplicates/callbacks.js
  - test-bun/javascript-scanner.test.ts
  - docs/scanners/typescript/index.md
  - docs/scanners/javascript/index.md
  - plugins/scanners/vue/src/evidence.ts
parent_task_id: TASK-424
type: feature
ordinal: 497000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in Vue single-file component because the Vue scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Vue scanner reports source ranges and binding-normalized tokens for Vue single-file component operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
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
1. plugins/scanners/vue/src/sfc.ts: one helper that parses a single-file component with the parser @vue/language-core exports and returns each script block as the file's own text with everything before the block blanked except line breaks, so offsets and lines are the .vue file's own; the outline module uses it too.
2. plugins/scanners/vue/src/tokens.ts: binding-normalized body tokens over the classic TypeScript AST, with the token spellings of the reference plugins/scanners/typescript/src/source-tokens.ts, so the same body in a Vue script and in a TypeScript file compares equal. Parameters, variables and binding names become slots in order; an operation's own name stays text, so recursive functions with different names are not identical; element access and call arguments keep their operands.
3. plugins/scanners/vue/src/operations.ts: the named operations of each script block per docs/architecture-findings.md: function declarations and named function expressions, methods with an identifier name in classes and object literals, and function literals assigned to a variable or an object-literal property. Anonymous callbacks, functions on an object literal passed directly as a call or new argument, and initializer code get no tokens, and the scanner never filters by body size. Each reported operation carries file, position, startLine, endLine and tokens in the .vue file's own lines.
4. Vue index.ts: merge those operations into the scan observation, keeping the fields the existing binding evidence already reports for the same operation.
5. Fixture test/fixtures/vue-duplicates: an identical pair whose locals are renamed, a near-duplicate pair, a file with anonymous callbacks only, and a small body. Tests run groma lint over it with the built package, and compare one body's tokens with the TypeScript scanner's tokens for the same code in a .ts file.
6. Document the compared operations in docs/scanners/vue/index.md, following the TypeScript page, including script setup and options-object methods.
7. Isolated bun run check, Vue build, specification and quality self-review.

Review round (Codex, Grok cold reviews at cf8e7975):
8. One shared module, plugins/scanners/typescript-operations.ts, holds the TypeScript-family compared-operation rule (which functions are compared, their name and range) and the body tokenizer. It reads nodes by syntax kind, so the TypeScript scanner passes its native SDK's SyntaxKind and the Vue and JavaScript scanners pass their classic compiler, like plugins/scanners/typescript-outline.ts. The TypeScript scanner and the Vue scanner use it; vue/src/tokens.ts and the rule copy in vue/src/operations.ts are deleted (Codex and Grok: the copy drifted).
9. Through the shared module, Vue gets the TASK-423 fixes: object literals inside parentheses, as, satisfies or ! before a call or new are callback arguments (Grok must-fix, operations.ts:20-26); postfix operators, grouping, typeof, void, delete and statement keywords are tokens (Codex must-fix, tokens.ts:145); constructors are compared.
10. Coordinator decision: template literal text, regular expression and bigint literals, ?., spread, this and super also become tokens, since the shared rule keeps literals and operators.
11. Red tests: the TypeScript distinct-bodies fixture gains pairs that differ only in those tokens; a Vue fixture with the same bodies and wrapped callback arguments expects only the constructor pair.
12. Vue and TypeScript pages updated; isolated bun run check and the Vue package build.

13. Extends step 10 (coordinator): try bodies also write catch and finally, with a red catch/finally pair in distinct-bodies.

Simplicity round (cold junior-maintainer review of the fix round):
14. Tokens: a #name stays as written like any undeclared name, so this.#a and this.#b differ; a destructured property name stays as written (k.name) and only the bound name becomes a slot, so the key of { a: { b } } is never a slot. Red pairs in distinct-bodies.
15. Vue: VueEvidence.operationId keeps an existing entry for the same id, so the compared operation and the binding evidence no longer depend on call order; test it.
16. Delete dead code (the operation !== root check for nested functions, the unary 'op' fallback), rename OperationCompiler to OperationSyntax, export only what other modules import, and let the shared module name every operation, (anonymous) for those it does not compare.
17. Vue page: keep the Vue-specific compared-operation parts and link the TypeScript page for the rest; delete the redundant Vue recursion/index token test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scan path: plugins/scanners/vue/src/sfc.ts parses a single-file component with the parser @vue/language-core exports and returns each script block inside the file's own text, with everything before it blanked except line breaks, so offsets, ranges and lines are the .vue file's own without mapping through Volar. plugins/scanners/vue/src/operations.ts reports every named operation of those blocks with position, startLine, endLine and tokens, and plugins/scanners/vue/src/tokens.ts is the classic-compiler port of the reference plugins/scanners/typescript/src/source-tokens.ts, including its type-skip list and its rule that an operation's own name is not a slot. addComparedOperations merges them into the scan by operation id, so the binding evidence for the same function keeps its fields and its invocations; ids matched in every fixture, and .ts files keep their TypeScript-scanner tokens (the Vue scanner adds none for them).
Which operations: function declarations and named function expressions (script and script setup), methods with an identifier name in classes and object literals such as an options object's methods, and function literals assigned to a variable or an object-literal property. Verified with a probe: setup() on the argument of defineComponent({...}) is an anonymous callback and gets no tokens, while methods nested under its methods property are compared. AC #1's 'very small bodies': the shared rule forbids scanners filtering by size, so every named body is reported and core applies the 8 and 24 token minimums; Checks.vue (4-token bodies) therefore produces no finding.
Verification: bun test --timeout 120000 test-bun/vue-lint.test.ts 3 pass. groma lint on test/fixtures/vue-duplicates with the built package exits 1 and prints 'price Pricing.vue:4' with 'quote Quote.vue:4' and 'not identical', and 'ready Readiness.vue:2' with 'run Runner.vue:2' and no 'not identical' (identical after renamed locals became slots); Callbacks.vue, Checks.vue, Depth.vue and Head.vue appear nowhere. Totals.vue's body tokens equal the TypeScript scanner's tokens for the same body in totals.ts, with startLine 2 and endLine 8. Depth.vue keeps the name 'depth' in its tokens and differs from Height.vue; Head.vue keeps its slice bounds 0 and 2 and differs from Tail.vue. bun test test-bun/vue-scanner.test.ts, angular-scanner, react-scanner and code-outline: 33 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 439 pass, 25 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded there with the tokenizer bundled.
Not changed: docs/architecture-findings.md still lists only the TypeScript scanner's page, as the other language lanes left it; the parent TASK-424 owns that list. A back-reference comment in plugins/scanners/typescript/src/source-tokens.ts would pair with the one in the Vue port, but that file's package is being changed by another task, so it is proposed, not applied.

Cold review corrections (coordinator decisions), applied: skipType now also skips a type reference, matching the reference rule that its isHeritageClauseElement covers expressions with type arguments and type references; without it a body using 'as Payload' kept the type name in a Vue script but not in a TypeScript module. The shared Totals.vue and totals.ts body now contains that assertion, so the cross-scanner token test guards the drift: it fails with an extra 'Payload' token before the fix and passes after it. Also: the compared operation replaces its map entry, since one function has one id and the fields are the same set (the dead spread merge and its comment are gone); comparedOperations is local; and the Vue page points at the TypeScript page's list of named operations not compared yet.
Verification after corrections: bun test --timeout 120000 test-bun/vue-lint.test.ts test-bun/vue-scanner.test.ts 11 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 442 pass, 25 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded there.

Review round (Codex and Grok cold reviews at cf8e7975, coordinator additions). Verified before the change: in Vue, x++ and x-- bodies were identical copies (Codex, tokens.ts:145), and setup() inside defineComponent-style calls wrapped in parentheses, as, satisfies or ! was compared (Grok, operations.ts:20-26); the Vue copy also lacked constructors, and the three TypeScript-family copies (TypeScript, Vue, JavaScript) had already drifted.
Change: plugins/scanners/typescript-operations.ts is the one TypeScript-family rule and tokenizer. typeScriptOperations(compiler) returns executable and comparedOperation; it reads nodes by syntax kind, so the TypeScript scanner passes its native SDK's SyntaxKind and the Vue and JavaScript scanners pass their classic compiler. Deleted plugins/scanners/typescript/src/source-tokens.ts, plugins/scanners/vue/src/tokens.ts and plugins/scanners/javascript/src/tokens.ts, and the rule copies in source-operations.ts, vue/src/operations.ts and javascript/src/evidence.ts. The JavaScript switch lands here, not in TASK-418: the TypeScript scanner gains the index token, so the javascript-parity test fails unless both switch together.
New tokens (coordinator decisions): template literal text, bigint and regular expression literals, ?., spread ..., this, super, index before an element access, and else before an else branch.
Evidence: a probe over the repository's own 310 TypeScript files gives identical compared operations (names, ranges, tokens; 2363 operations) with the native SDK, TypeScript 5.9.3 (Vue) and 6.0.3 (JavaScript); with the new kinds disabled, the shared tokenizer matched the previous TypeScript tokenizer on all 2381 operations. Red tests, each failing at 823874db with only the tests and fixtures applied: distinct-bodies gains pairs that differ only in template text, a regex, ?., spread, an index, and this versus super; the vue-duplicates Totals parity body gains postfix, grouping, typeof, else, an index and a constructor, and Callbacks.vue gains the four wrapped call-argument spellings; javascript-parity gains the same constructs and javascript-duplicates a parenthesized call-argument callback pair.
Checks: bun run check in an isolated worktree at 823874db plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; node 16 pass; bun 520 pass, 35 skip, 0 fail); bun plugins/scanners/vue/build.ts and bun plugins/scanners/javascript/build.ts succeed there. Docs: TypeScript, Vue and JavaScript pages list constructors as compared, the wrapped callback arguments, and (TypeScript page) the tokens that stay.

Coordinator addition: try bodies write catch and finally (CatchClause kind, and finally before the finally block, like else before an else branch). Red pair in distinct-bodies: a catch body and a finally body were identical copies at 823874db. The TypeScript page lists both keywords. Cross-compiler probe still 0 mismatches. Follow-ups, not in this task: statement labels and rest parameters (...args) write no tokens.

Cold review of this round, applied: the module header states that kind numbers differ between compilers, so kinds are looked up by name in the SyntaxKind the caller passes and a scanner must pass the compiler that parsed its nodes; docs/scanners/javascript/index.md replaces its copied compared and not-compared lists with the pointer to the TypeScript page the Vue page uses; the two Vue paragraphs are reflowed. Behavior note: a JavaScript constructor is now an operation, so it owns the calls and HTTP requests inside it (they belonged to the module operation before); no derived relationship row changes, because core joins operations to components by file.

Re-verification after the cold review: bun run check in an isolated worktree at 7fdc0446 plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; node 16 pass; bun 520 pass, 35 skip, 0 fail); the Vue and JavaScript packages build there.

Simplicity round (cold junior-maintainer review of the fix round), applied: a #name is a token like any other name, so this.#items and this.#jobs no longer compare alike; an object destructuring pattern writes each property name it reads (k.name, as an object literal key) and binds only the bound names, so const { amount, currency } = props no longer equals const { grams, unit } = props and the key of { a: { b } } is never a slot; VueEvidence.operationId keeps an entry already recorded for the same function, so the compared body survives whichever of addComparedOperations and the binding evidence runs first; the nested-function check against the root and the unary 'op' fallback, both unreachable, are gone; OperationCompiler is renamed OperationSyntax and nothing the other modules do not import is exported; operationFields names every operation, (anonymous) for those not compared, so the TypeScript and JavaScript scanners no longer repeat that default; the Vue page keeps its component-specific rules and points at the TypeScript page for the rest; the Vue recursion and index token test, now covered by the shared tokenizer's tests, is deleted. Red tests: a #name pair and a nested destructuring pair in distinct-bodies, and a Vue test that records compared bodies before the template bindings; both fail at 903e1b2f without the source change. The comment update in test-bun/architecture-findings.test.ts landed in 903e1b2f with another lane's edit of that file. Verification: the cross-compiler probe still gives identical compared operations (2414 on 314 files); bun run check in an isolated worktree at 903e1b2f plus this round's files exit 0 (biome: pre-existing items only; tsc clean; bun 588 pass, 35 skip, 0 fail); the Vue and JavaScript packages build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma lint now finds duplicate logic in Vue single-file components. The Vue scanner parses each component's script blocks with the parser @vue/language-core exports (plugins/scanners/vue/src/sfc.ts, shared with the outline), reports every named operation with the lines it occupies in the .vue file (plugins/scanners/vue/src/operations.ts), and tokenizes its body with a classic-compiler port of the reference tokenizer (plugins/scanners/vue/src/tokens.ts), so local names become slots while operators, literals, property names and undeclared names, including a recursive call's own name and index bounds, stay as written. Anonymous callbacks, functions on an object literal passed directly to a call, and initializer code get no tokens, and no body is filtered by size. Verified with test/fixtures/vue-duplicates and test-bun/vue-lint.test.ts: groma lint with the built package reports the renamed-locals pair as identical copies and the threshold-changed pair as not identical, and reports nothing for callbacks, small bodies, the recursive pair or the indexed pair; one body's tokens, including an 'as' assertion, equal the TypeScript scanner's tokens for the same body in a module. Isolated bun run check exit 0 and the Vue package build both passed. Documented in docs/scanners/vue/index.md.

Review round: after external cold reviews, the TypeScript, Vue and JavaScript scanners share one compared-operation rule and tokenizer, plugins/scanners/typescript-operations.ts, which each scanner calls with the compiler that parsed its nodes; the three tokenizer copies and rule copies are gone. Through it, Vue no longer compares callbacks on an object literal wrapped in parentheses, as, satisfies or ! before a call, compares constructors, and keeps postfix operators, grouping, typeof, else, catch, finally, index, template text, regular expressions, ?., spread, this and super in body tokens, so such bodies are no longer reported as identical copies. Verified by red tests on the distinct-bodies, vue-duplicates and javascript fixtures, a probe showing identical compared operations across the native SDK, TypeScript 5.9.3 and 6.0.3 on the repository's own sources, bun run check in an isolated worktree, and the Vue and JavaScript package builds.

Simplicity round: #name members and destructured property names now stay in body tokens, the Vue compared body no longer depends on evidence order, and dead code, duplicated defaults and unused exports are gone, verified by new red tests and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
