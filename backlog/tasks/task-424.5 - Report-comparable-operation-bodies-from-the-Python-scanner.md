---
id: TASK-424.5
title: Report comparable operation bodies from the Python scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 22:57'
labels: []
dependencies: []
references:
  - runtime
modified_files:
  - plugins/scanners/python/worker/scan.py
  - test/fixtures/python-duplicated-logic/readiness.py.fixture
  - test/fixtures/python-duplicated-logic/scheduling.py.fixture
  - test/fixtures/python-duplicated-logic/invoice.py.fixture
  - test/fixtures/python-duplicated-logic/quote.py.fixture
  - test/fixtures/python-duplicated-logic/callbacks.py.fixture
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
  - test/fixtures/python-duplicated-logic/distinct.py.fixture
parent_task_id: TASK-424
type: feature
ordinal: 495000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in Python because the Python scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Python scanner reports source ranges and binding-normalized tokens for Python operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
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
1. In plugins/scanners/python/worker/scan.py, give every def and async def operation (functions, methods including __init__, nested defs) startLine (def line), endLine and binding-normalized body tokens. Lambdas, generator bodies, module and class-body code stay non-operations, so they are never compared; Python cannot write a def inside a dict literal, so the call-argument rule needs no extra code. No size filter: core applies both minimums.
2. Tokens: parameters and names the function binds (assignment, loop, with, except, import, walrus, comprehension, nested def or class names, match captures, minus global and nonlocal) become slots numbered by first appearance; nested def, lambda and class bodies open a scope whose free names resolve through the enclosing ones. Keep operators, literals (repr), attribute names (.name), keyword argument names (k.name) and unresolved identifiers; add control keywords and call markers. Skip docstrings, decorators, defaults and annotations.
3. Fixture test/fixtures/python-duplicated-logic (.py.fixture files): an exact pair with renamed locals, a separate near-duplicate pair of at least 24 tokens, and identical lambdas in dict call arguments plus identical module and class-body code that must not be reported.
4. Bun test in test-bun/python-scanner.test.ts: build the package, add it to a temp repository, run groma lint, assert the exact group, the not-identical group, and no callback or initializer lines.
5. Update docs/scanners/python/index.md with a Compared operations section following the TypeScript page shape and drop the stale no-tokens statement.
6. Run bun run check in an isolated worktree; self spec and quality review.

Review-fix round (Codex u05 findings, orchestrator grouping check):
7. Fix: slice positions (items[:n] equalled items[n:]): a slice emits ':' between its lower and upper bound and before a step.
8. Fix: nested def/class names, import aliases, except and match captures take their slot where they are bound, so an outer call to nested a() no longer equals a call to nested b().
9. Fix: a function-local import emits 'import' and the imported module and member (from math import floor gives math.floor); only the local alias is a slot.
10. Fix (verified, orchestrator asked): grouping was lost because binary operators were emitted between operands; operators now come before their operands, and and/or and comparison chains repeat their operator per joined operand, so (a+b)*c differs from a+b*c.
11. Regression: add the colliding pairs to test/fixtures/python-duplicated-logic so the existing lint test fails without the fix; update the Python scanner page.
12. Report, not fix: flat token streams in every scanner have no end markers (blocks, else, call arguments, containers, dict ** entries), a shared-contract question for the orchestrator.

13. Orchestrator decision (apply step, each with a failing-first lint fixture pair): an else block of if, for, while and try emits 'else'; a dictionary unpacking emits '**' in its key position, with keys and values interleaved; a subscript gets a marker so a[b] differs from the tuple a, b (marker to be confirmed: the TypeScript reference emits nothing for element access).
14. Out of scope by orchestrator decision: call-argument boundaries (f(g(a), b) equals f(g(a, b))) are a cross-scanner follow-up the orchestrator records for the owner.

15. Subscript marker confirmed by the orchestrator: 'index', as the Java tokenizer writes for element access, so a[b] gives index $0 $1.

16. Cold review replaced item 10: tokens stay infix, and an operand of a binary, unary, boolean or comparison operator that is itself a binary, boolean or comparison expression is wrapped in ( and ); chains such as a < b <= c stay one run. Item 13's subscript marker is 'index' (item 15).

17. Simplicity round: extract segmentLabel(segment) from the test's route renderer and drop its unreachable optional-parameter branch (the Python scanner reports no optional parameter), so Biome reports no cognitive-complexity warning in test-bun/python-scanner.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker: plugins/scanners/python/worker/scan.py runs in bundled Pyodide 314.0.7 (CPython 3.14 stdlib ast); no system Python, no project tools. Every def and async def operation now carries startLine (def line, decorators excluded, same as position), endLine and tokens; lambdas, generator bodies and module or class-body code remain non-operations. A def cannot sit in a dict literal, so the call-argument rule needs no code. No size filter (core owns both minimums).
Token decisions: slots follow first appearance; a scope's locals are parameters plus every binding outside nested scopes (Name store or del, import alias, def or class name, except or match capture) minus global and nonlocal. Nested def, lambda and class bodies open scopes (fn or class token) whose free names resolve outward. Comprehension variables count as the enclosing function's locals. Docstrings (Python's comment equivalent), decorators, defaults and annotations are not tokens, including on nested defs. Literals use repr. Tokens appear before their children (call, operators, .attr, k.name).
Owner ref: scan.py has no owning element; runtime (owns worker/runtime.ts, which runs scan.py) was added as the closest element.
Verification: bun test test-bun/python-scanner.test.ts 5 pass; the new lint test builds the package, runs groma lint on test/fixtures/python-duplicated-logic and gets exactly [invoice.py:1, quote.py:1 not identical] and [readiness.py:1, scheduling.py:1 identical]; the excluded lambdas (11 tokens each) and initializer loops (13 tokens) would otherwise form groups. Tokenizing all 66,761 functions of the CPython 3.14 standard library raised no errors (about 6 s locally). Isolated bun run check passed (Biome, typecheck, node 16 pass, bun 372 pass, 17 skip, 0 fail).

Cold review: no blocking findings. Applied the optional ones without behavior change: the page and local_names docstring now say a function does not bind names it declares global or nonlocal; local_names names the two simplifications (comprehension variables share the function scope; class-body names are visible to nested methods); renamed BodyTokens.scope to enter, scopes to bindings, merged OPERATORS and KEYWORDS into NODE_TOKENS with node_token(); children() no longer skips ctx and local_names reuses it; the page states lambdas (including those in a dictionary passed to a call or decorator) are never compared and that a function's tokens include nested functions, lambdas, classes and generator expressions. Accepted as documented: Python lambdas are never compared, even when assigned to a name. Re-verification: token probe output unchanged; bun test test-bun/python-scanner.test.ts 5 pass; isolated bun run check passed (node 16 pass, bun 374 pass, 17 skip, 0 fail).

Review-fix round (Codex u05 findings, orchestrator grouping check, cold review): verified with an in-memory probe that items[:n] equalled items[n:], that outer calls to nested a() and b() matched, that from math import floor matched ceil, and that (a+b)*c equalled a+b*c. Fixes in plugins/scanners/python/worker/scan.py: bound_names() gives a def, class, import alias, except or match name its slot where it is bound (local_names reuses it); a function-local import writes 'import' plus the imported module and member (math.floor, ..shop.cart), only the alias is a slot; parts() lists a node's children in source order with markers: an operand of a binary, unary, boolean or comparison operator that is itself a binary, boolean or comparison expression is wrapped in ( ), a slice separates bounds with ':', a dictionary unpacking writes '**' in its key position with keys and values paired, and an else block of if, for, while or try starts with 'else'; a subscript writes 'index' (the Java tokenizer's word). children() filters parts(), so local_names and the tokens share one traversal.
Cold review: the first encoding (operators before operands) created new exact copies for chains and containers ([a, b] + [c] versus [a] + [b, c]); per the orchestrator's decision it was replaced by infix with parentheses around nested operator expressions. Unary operators are also parents so -a ** b stays different from (-a) ** b (pair negated_power / power_of_negated is red without that rule).
Orchestrator decisions: else, dictionary ** and index were added (the TypeScript reference writes no else or element-access marker; relayed to the TypeScript lane). Call-argument boundaries (f(g(a), b) equals f(g(a, b)), also f(a) + b equals f(a + b)) stay unmarked: a cross-scanner follow-up the orchestrator records for the owner. Known remaining, also present before: a conditional, walrus, lambda or await operand is not wrapped, so (a if b else c) + d equals a if b else c + d.
Verification: test/fixtures/python-duplicated-logic/distinct.py.fixture holds 15 pairs; the lint test failed with every pair reported before each code change and passes after; tokenizing all 66,761 CPython 3.14 standard-library functions raised no errors; bun test test-bun/python-scanner.test.ts 8 pass; isolated bun run check passed (Biome, typecheck, node 16 pass, bun 520 pass, 35 skip, 0 fail).

Simplicity round: the test's route renderer moved its per-segment branches into segmentLabel(segment) and dropped the optional-parameter suffix, which the Python scanner never reports; Biome now reports no cognitive-complexity warning for test-bun/python-scanner.test.ts (repository warnings 2 to 1 at HEAD d58953d2). Isolated bun run check passed (node 16 pass, bun 589 pass, 35 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Python scanner now gives every def and async def operation a source range (def line to body end) and binding-normalized body tokens, so groma lint finds duplicate and near-duplicate Python logic through the shared core comparison. Parameters and bound names become slots; operators, literals, attribute and keyword names and unresolved identifiers stay; docstrings, decorators, defaults and annotations are left out. Lambdas and module or class-body code are never operations, so they are never compared; core applies the size minimums. docs/scanners/python/index.md gains a Compared operations section. Verified by a new lint test on test/fixtures/python-duplicated-logic (exact renamed pair, not-identical pair, no lambda or initializer findings), tokenizing the whole CPython 3.14 standard library without errors, and an isolated bun run check.

Review-fix round: body tokens now keep structure that different logic used to share. A def, class, import, except or match name takes its slot where it is bound; a function-local import keeps the imported module and member; nested binary, boolean and comparison operands are wrapped in parentheses; slices, subscripts (index), dictionary unpacking (**) and else blocks keep their positions. Fifteen previously colliding pairs in test/fixtures/python-duplicated-logic/distinct.py.fixture are no longer reported by groma lint; call-argument boundaries remain a cross-scanner follow-up.

Simplicity round: the Python test's segment renderer is a small segmentLabel helper, clearing its Biome complexity warning.
<!-- SECTION:FINAL_SUMMARY:END -->
