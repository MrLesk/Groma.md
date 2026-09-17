---
id: TASK-424.5
title: Report comparable operation bodies from the Python scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:40'
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker: plugins/scanners/python/worker/scan.py runs in bundled Pyodide 314.0.7 (CPython 3.14 stdlib ast); no system Python, no project tools. Every def and async def operation now carries startLine (def line, decorators excluded, same as position), endLine and tokens; lambdas, generator bodies and module or class-body code remain non-operations. A def cannot sit in a dict literal, so the call-argument rule needs no code. No size filter (core owns both minimums).
Token decisions: slots follow first appearance; a scope's locals are parameters plus every binding outside nested scopes (Name store or del, import alias, def or class name, except or match capture) minus global and nonlocal. Nested def, lambda and class bodies open scopes (fn or class token) whose free names resolve outward. Comprehension variables count as the enclosing function's locals. Docstrings (Python's comment equivalent), decorators, defaults and annotations are not tokens, including on nested defs. Literals use repr. Tokens appear before their children (call, operators, .attr, k.name).
Owner ref: scan.py has no owning element; runtime (owns worker/runtime.ts, which runs scan.py) was added as the closest element.
Verification: bun test test-bun/python-scanner.test.ts 5 pass; the new lint test builds the package, runs groma lint on test/fixtures/python-duplicated-logic and gets exactly [invoice.py:1, quote.py:1 not identical] and [readiness.py:1, scheduling.py:1 identical]; the excluded lambdas (11 tokens each) and initializer loops (13 tokens) would otherwise form groups. Tokenizing all 66,761 functions of the CPython 3.14 standard library raised no errors (about 6 s locally). Isolated bun run check passed (Biome, typecheck, node 16 pass, bun 372 pass, 17 skip, 0 fail).

Cold review: no blocking findings. Applied the optional ones without behavior change: the page and local_names docstring now say a function does not bind names it declares global or nonlocal; local_names names the two simplifications (comprehension variables share the function scope; class-body names are visible to nested methods); renamed BodyTokens.scope to enter, scopes to bindings, merged OPERATORS and KEYWORDS into NODE_TOKENS with node_token(); children() no longer skips ctx and local_names reuses it; the page states lambdas (including those in a dictionary passed to a call or decorator) are never compared and that a function's tokens include nested functions, lambdas, classes and generator expressions. Accepted as documented: Python lambdas are never compared, even when assigned to a name. Re-verification: token probe output unchanged; bun test test-bun/python-scanner.test.ts 5 pass; isolated bun run check passed (node 16 pass, bun 374 pass, 17 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Python scanner now gives every def and async def operation a source range (def line to body end) and binding-normalized body tokens, so groma lint finds duplicate and near-duplicate Python logic through the shared core comparison. Parameters and bound names become slots; operators, literals, attribute and keyword names and unresolved identifiers stay; docstrings, decorators, defaults and annotations are left out. Lambdas and module or class-body code are never operations, so they are never compared; core applies the size minimums. docs/scanners/python/index.md gains a Compared operations section. Verified by a new lint test on test/fixtures/python-duplicated-logic (exact renamed pair, not-identical pair, no lambda or initializer findings), tokenizing the whole CPython 3.14 standard library without errors, and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
