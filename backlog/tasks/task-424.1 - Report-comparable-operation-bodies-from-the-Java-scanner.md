---
id: TASK-424.1
title: Report comparable operation bodies from the Java scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 17:58'
labels: []
dependencies: []
references:
  - java-src-index
modified_files:
  - plugins/scanners/java/java/md/groma/scanner/Tokens.java
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - test/fixtures/java-duplicates/pom.xml
  - test/fixtures/java-duplicates/src/main/java/duplicates/Copy.java
  - test/fixtures/java-duplicates/src/main/java/duplicates/Forms.java
  - test/fixtures/java-duplicates/src/main/java/duplicates/Ready.java
  - test-bun/java-duplicates.test.ts
  - docs/scanners/java/index.md
parent_task_id: TASK-424
type: feature
ordinal: 491000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in Java because the Java scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Java scanner reports source ranges and binding-normalized tokens for Java operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
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
1. New plugins/scanners/java/java/md/groma/scanner/Tokens.java: a TreeScanner that turns one method or constructor body into binding-normalized tokens. Parameters and every name declared inside the body (locals, for and catch variables, try resources, patterns) become slots in declaration order; fields, types, method names, the operation's own name and unresolved identifiers stay as written. It keeps operators, literals, member names (.name, ::name), call, new, index with its operands, and control keywords.
2. Declarations.java: a method with a body reports startLine, endLine and tokens unless it is declared inside an anonymous class (anonymous class bodies and enum constant bodies). Lambdas, initializer blocks and field initializers keep reporting no tokens, so core's two minimum sizes stay in core.
3. Fixture test/fixtures/java-duplicates (Maven project): identical and near-duplicate methods across two classes, renamed locals, a recursive method pair with different names, index bounds, an empty method, a local class method, and anonymous callbacks and initializers without tokens.
4. test-bun/java-duplicates.test.ts: worker-level assertions on which operations carry tokens, their ranges and the token equalities, plus a groma lint run through the packaged scanner asserting the identical and near-duplicate findings.
5. docs/scanners/java/index.md: Compared operations section following the TypeScript page's shape.
6. Rebuild the Java package, run the tests and bun run check in an isolated worktree.

Review-fix round (external cold reviews of HEAD cf8e7975):
7. Fix: names were slotted by lexical scopes that only blocks opened, so a for-loop variable, a catch parameter or a pattern binding kept its slot after its lifetime ended, and a later field of the same name took that slot (for (int left ...) {} return left + 1 matched the same method using field right). Tokens.java becomes a TreePathScanner that gives each variable declared in the body one slot keyed by the compiler's binding (Trees.getElement), so a reference is a slot exactly when it binds to a declaration in the body; the hand-kept scope stack goes away.
8. Fix: grouping parentheses were dropped, so (a + b) * c and a + b * c had the same tokens. Parentheses inside an expression are kept as ( and ); those a statement or switch places around its condition or selector stay out.
9. Verified without a change: postfix ++ and -- already keep their operator after the operand, so n++ and n-- differ.
10. Regression cases in test/fixtures/java-duplicates and test-bun/java-duplicates.test.ts; the docs state the binding rule and the grouping.

11. Final approach after the review-fix round (supersedes the slot rule in step 1 and the wording of step 8): Tokens.java is a TreePathScanner over the attributed trees. Each variable declared in the body, parameters included, gets the next slot keyed by its javac binding (Trees.getElement); an identifier is that slot when it binds to such a declaration and stays as written otherwise, so lifetimes follow the compiler rather than a scope stack. Parentheses inside an expression are kept as ( and ); parentheses directly under a statement, a declaration or a switch selector wrap a whole expression and are left out.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. Tokens.java is a TreeScanner over the authored parse trees (compiler-inserted members such as a default constructor are skipped): parameters and every name declared inside the body become slots in declaration order, while field, type and method names, including the operation's own name, stay as written. It emits literals, operators (binary, unary with postfix order, assignment and compound assignment), '.member' and '::member', 'call', 'new', 'class', 'fn' for nested methods and lambdas, primitive type names, and one keyword per control construct, with 'index' followed by both array operands. Declarations.java attaches startLine, endLine and tokens to every method and constructor with a body unless an enclosing class is anonymous; lambdas, initializer blocks and field initializers still report no tokens, and no body is dropped for size.

Verification:
- bun test test-bun/java-duplicates.test.ts (2 pass): worker level over test/fixtures/java-duplicates asserts that only the lambda, the anonymous class method, both initializer blocks and both field initializers lack tokens, that a local class method has them, canStart's range, an empty body reporting [] with its range, readyToRun and canStart matching across renamed locals, and factorial/fact and tail/head differing through the operation's own name and index bounds; the lint test builds the package, adds it to an empty project and asserts groma lint exits 1 with the identical canStart/readyToRun finding and the near-duplicate progress/completion finding marked not identical.
- Real sample: groma lint on the callforpapers clone (packaged scanner, no Java tooling on PATH) now reports Java duplicates, 291 of 373 output lines naming .java files; it reported none before.
- Isolated worktree at fb4ea929 with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 438 pass, 0 fail).
Note on AC #1: the shared rule keeps both minimum sizes in core, so the scanner reports every named body regardless of size; 'omitting very small bodies' is core's part.

Cold review fixes: an unqualified call now keeps its method name, so a local named like the callee cannot make two unrelated bodies identical (fixture pair helped/othered proves it); the index-bounds claim is now real, with tail returning data[size - 1] and head returning data[0]; only the declaring class decides whether a method is an anonymous callback, so a named local class inside an anonymous body keeps tokens; the operator and keyword tables are explicit Map.entry rows; the emit alias is gone and slots is nextSlot; the docs drop the repeated size rule, say names declared in the body including a local class's fields, and state that declared types are tokens, so int against long or List against ArrayList is not identical; the third identical pair (names/labels) left the fixture.

Re-verification: bun test test-bun/java-duplicates.test.ts 2 pass (12 assertions). Isolated worktree at ee8c154c with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 441 pass, 0 fail).

Review-fix round (external cold reviews of HEAD cf8e7975): slots were kept by name in a scope stack that only blocks, classes, methods and lambdas opened, so a for-loop variable, a catch parameter or a pattern binding outlived its lifetime and a later field of the same name took its slot (for (int left ...) {} return left + 1 matched the same method using field right). Tokens.java now extends TreePathScanner and keys each slot by the declaration's javac binding (Declarations passes the method's TreePath and Trees), which deletes the scope stack; a declaration without a binding keeps its slot token but no reference can reach it, since a null key would give every unresolved identifier that slot. Grouping parentheses were dropped, so (a + b) * c equaled a + b * c; parentheses inside an expression now emit ( and ), while those directly under a statement, a declaration or a switch selector are left out so conditions gain no tokens. Postfix ++ and -- were already kept after the operand, so nothing changed there. Cold review of this fix: class comment states the trees must be attributed, the null-binding guard is commented, the list overload is declareParameters, and the parentheses comment names statements, declarations and switch selectors; the reviewer compared 7,919 callforpapers bodies with no binding anomaly, tokens identical to the previous worker once parentheses are ignored.
Verification: probes with the rebuilt worker showed loop, catch and pattern bindings ending with their lifetimes, flow-scoped bindings, locals of unresolved types, var, lambdas passed to unresolved calls, local class fields, old-style switch locals and try resources all binding. test-bun/java-duplicates.test.ts adds afterLoop (field left against field right after a loop variable of the same name) and combine ((a + b) * c against a + b * c); each assertion fails on the previous worker. Isolated worktree at HEAD with only this task's changes: bun run check exit 0 (Biome: only existing warnings; tsc; node 16 pass; bun 520 pass, 35 env-gated skips, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Java scanner now reports a source range and binding-normalized body tokens for every method and constructor with a body, including the methods of a local class, so groma lint and scan findings compare Java logic. A new Tokens reader walks the authored parse trees: parameters and names declared in the body become slots in declaration order, while field, type and method names, a called name a local shadows, and the operation's own name stay as written, along with literals, operators, member and method-reference names, array index operands and control keywords. Lambdas, the methods of an anonymous class body, initializer blocks and field initializers carry no tokens, and no named body is dropped for size because core owns both minimums. Verified by test-bun/java-duplicates.test.ts over test/fixtures/java-duplicates (worker-level tokens, ranges and the identical, renamed, recursive, shadowed-call and index-bound cases, plus a groma lint run through the packaged scanner reporting the identical and near-duplicate pairs), by groma lint on the callforpapers clone where 291 of 373 output lines now name Java files, and by bun run check in an isolated worktree. The Java scanner page documents which operations are compared.

Review-fix round: a name is now a slot exactly where javac binds it to a variable declared in the body, so a loop, catch or pattern variable no longer lends its slot to a later field of the same name, and parentheses that group operands inside an expression are tokens, so (a + b) * c no longer equals a + b * c. Postfix operators were already kept. Verified by new cases in test-bun/java-duplicates.test.ts that fail on the previous worker, and bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
