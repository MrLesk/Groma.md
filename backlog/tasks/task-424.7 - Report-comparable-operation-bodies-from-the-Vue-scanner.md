---
id: TASK-424.7
title: Report comparable operation bodies from the Vue scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 22:46'
labels: []
dependencies: []
references:
  - vue-src-index
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scan path: plugins/scanners/vue/src/sfc.ts parses a single-file component with the parser @vue/language-core exports and returns each script block inside the file's own text, with everything before it blanked except line breaks, so offsets, ranges and lines are the .vue file's own without mapping through Volar. plugins/scanners/vue/src/operations.ts reports every named operation of those blocks with position, startLine, endLine and tokens, and plugins/scanners/vue/src/tokens.ts is the classic-compiler port of the reference plugins/scanners/typescript/src/source-tokens.ts, including its type-skip list and its rule that an operation's own name is not a slot. addComparedOperations merges them into the scan by operation id, so the binding evidence for the same function keeps its fields and its invocations; ids matched in every fixture, and .ts files keep their TypeScript-scanner tokens (the Vue scanner adds none for them).
Which operations: function declarations and named function expressions (script and script setup), methods with an identifier name in classes and object literals such as an options object's methods, and function literals assigned to a variable or an object-literal property. Verified with a probe: setup() on the argument of defineComponent({...}) is an anonymous callback and gets no tokens, while methods nested under its methods property are compared. AC #1's 'very small bodies': the shared rule forbids scanners filtering by size, so every named body is reported and core applies the 8 and 24 token minimums; Checks.vue (4-token bodies) therefore produces no finding.
Verification: bun test --timeout 120000 test-bun/vue-lint.test.ts 3 pass. groma lint on test/fixtures/vue-duplicates with the built package exits 1 and prints 'price Pricing.vue:4' with 'quote Quote.vue:4' and 'not identical', and 'ready Readiness.vue:2' with 'run Runner.vue:2' and no 'not identical' (identical after renamed locals became slots); Callbacks.vue, Checks.vue, Depth.vue and Head.vue appear nowhere. Totals.vue's body tokens equal the TypeScript scanner's tokens for the same body in totals.ts, with startLine 2 and endLine 8. Depth.vue keeps the name 'depth' in its tokens and differs from Height.vue; Head.vue keeps its slice bounds 0 and 2 and differs from Tail.vue. bun test test-bun/vue-scanner.test.ts, angular-scanner, react-scanner and code-outline: 33 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 439 pass, 25 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded there with the tokenizer bundled.
Not changed: docs/architecture-findings.md still lists only the TypeScript scanner's page, as the other language lanes left it; the parent TASK-424 owns that list. A back-reference comment in plugins/scanners/typescript/src/source-tokens.ts would pair with the one in the Vue port, but that file's package is being changed by another task, so it is proposed, not applied.

Cold review corrections (coordinator decisions), applied: skipType now also skips a type reference, matching the reference rule that its isHeritageClauseElement covers expressions with type arguments and type references; without it a body using 'as Payload' kept the type name in a Vue script but not in a TypeScript module. The shared Totals.vue and totals.ts body now contains that assertion, so the cross-scanner token test guards the drift: it fails with an extra 'Payload' token before the fix and passes after it. Also: the compared operation replaces its map entry, since one function has one id and the fields are the same set (the dead spread merge and its comment are gone); comparedOperations is local; and the Vue page points at the TypeScript page's list of named operations not compared yet.
Verification after corrections: bun test --timeout 120000 test-bun/vue-lint.test.ts test-bun/vue-scanner.test.ts 11 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 442 pass, 25 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma lint now finds duplicate logic in Vue single-file components. The Vue scanner parses each component's script blocks with the parser @vue/language-core exports (plugins/scanners/vue/src/sfc.ts, shared with the outline), reports every named operation with the lines it occupies in the .vue file (plugins/scanners/vue/src/operations.ts), and tokenizes its body with a classic-compiler port of the reference tokenizer (plugins/scanners/vue/src/tokens.ts), so local names become slots while operators, literals, property names and undeclared names, including a recursive call's own name and index bounds, stay as written. Anonymous callbacks, functions on an object literal passed directly to a call, and initializer code get no tokens, and no body is filtered by size. Verified with test/fixtures/vue-duplicates and test-bun/vue-lint.test.ts: groma lint with the built package reports the renamed-locals pair as identical copies and the threshold-changed pair as not identical, and reports nothing for callbacks, small bodies, the recursive pair or the indexed pair; one body's tokens, including an 'as' assertion, equal the TypeScript scanner's tokens for the same body in a module. Isolated bun run check exit 0 and the Vue package build both passed. Documented in docs/scanners/vue/index.md.
<!-- SECTION:FINAL_SUMMARY:END -->
