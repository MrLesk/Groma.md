---
id: TASK-483
title: Qualify and improve the Python scanner on public repositories
status: Done
assignee:
  - '@codex'
created_date: '2026-09-22 20:07'
updated_date: '2026-09-22 20:31'
labels: []
dependencies: []
references:
  - scanner-src-index
  - scanner-registry
modified_files:
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/python/worker/entries.py
  - plugins/scanners/python/worker/sources.py
  - test-bun/python-scanner.test.ts
  - packages/scanner/src/index.ts
  - src/scanner/registry.ts
  - plugins/scanners/python/src/index.ts
  - plugins/scanners/python/worker/routes.py
  - docs/scanners/python/index.md
  - docs/scanners/creating-a-plugin.md
type: task
ordinal: 564000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Python scanner has been qualified on a limited set of projects. Alex requested a repository-by-repository exercise to expose real edge cases, diagnose scanner defects, and improve the existing supported behavior before moving to another language.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Python repositories are scanned at recorded commits, and each result is classified with concrete evidence.
- [x] #2 Verified defects in the Python scanner supported flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Python scanner changes.
- [x] #4 Temporary repository clones are removed after Python scanner qualification and the results are reported to Alex before work starts on another scanner.
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
1. Build the current Python scanner package and have ten read-only agents scan ten pinned public repositories in separate temporary clones. Record exact commits, commands, outcomes, and minimal reproductions.
2. For each verified failure in the documented supported flow, inspect existing coverage, state the rule and concrete wrong result, then make the smallest scanner fix and focused test that closes a real gap.
3. Re-run affected repository scans and bun run check. Review the changed flow and simplify task-scoped code. Run the required full-context complexity review, clean up the temporary clones, report the Python result, and pause before another scanner.

Evidence-backed additions: also examine observed limits for Flask factory routes, Django mixed URL tables, FastAPI configured prefixes, source membership, and shared exclusions. Add support only where the checked-out source proves the result; do not infer C4 ownership from imports alone.
Test decisions before editing: (a) Pydantic top-level await: source syntax/scope validation must accept valid Python; current compile rejects Pyodide module and fails the entire scan; existing syntax test covers invalid source only, so add one valid-await case. (b) Click script collision: project.scripts must identify its declared local module; an unrelated same-suffix module makes its entry disappear; current entry tests do not cover nested-project collisions, so add one focused case. (c) HTTPX local import closure: entry source units include resolvable local imports; repeated star imports overwrite one another; existing tests do not cover repeated star imports, so add one source-unit case. Additional test decisions will be recorded before related edits.

Shared exclusion test decision: docs/scanners/python says configured exclusions remove source from the scan. A repository with one valid file and one excluded invalid template currently fails before post-scan filtering. Existing tests check full exclusion and Python default exclusions but not partial shared exclusion. Add one end-to-end config test. The generic ScannerPlugin scan contract will accept an optional exclusion predicate for all languages; Python will apply it before parsing, while the registry will continue its language-neutral evidence filtering.

Flask test decision: Flask routes registered by app.add_url_rule(path, view_func=handler) are visible user endpoints, and Flask source uses this call. The current route recognizer only handles add_route/add_api_route, so it omits a concrete endpoint; existing HTTP fixture does not cover this method. Add a focused route case, then map its documented arguments to the existing endpoint fact. Factory-local app support will require source-local binding evidence; do not infer a router from a name alone.

Factory route test decision: Flask tutorial creates and returns app inside create_app, then decorates hello with @app.route. The current source resolver marks local app as shadowed and drops /hello; no existing test covers a factory-local app. Recognize a direct, singly bound local Flask app and its Name uses in that function, then reuse the existing router fact flow. Do not interpret this as C4 containment.

Full-context review regression: a nested function can bind its own app parameter; mapping every same-spelled Name in the factory to the outer Flask app reports a false /wrong endpoint. The accepted rule is that local factory app facts require the same Python binding, not just the same text. Existing factory test covers the positive case but not shadowing, so add one negative case and keep decorator evaluation in the enclosing scope.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification review: ten pinned public Python repositories were scanned; Click script, Pydantic top-level await, Flask factory/add_url_rule, HTTPX module imports, and shared partial exclusion were reproduced and fixed. Python scanner emits source and HTTP evidence; core still owns C4 placement. Quality review: traced registry -> Python inventory -> worker -> entries/routes -> observation; focused tests detect the wrong results and are not tied to prose. Unknown configured FastAPI prefixes and computed Django includes remain conservative because the current source does not prove concrete paths. Cold simplicity review found only a redundant pre-exclusion scan in one test; removed it. Full check passed before that test-only deletion: 664 pass, 38 skip.

Pinned repository evidence (baseline -> final): Click 3cbaa76b6014be7427d1ab06b4af40f01e7c278e, script collision fixed; Flask d73fa1cdcbd8b1465c151db8924ba58b1dd14e35, factory /hello detected; HTTPX b5addb64f0161ff6bfe94c124ef76f6a1fba5254, entry closure now includes _api.py, _client.py and _main.py; Requests 611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60, scan passed; Rich 9d8f9a372cc5916fd4781fec207ced7ddac2f08f, scan passed; pytest 6a9ba0f02f827a54cff6ab4da0dddecd65444ff6, scan passed; Pydantic 915896d163835a57fd7987180087409a3229bd71, whole-scan top-level-await failure fixed; Poetry 94b6e35b9091991887aa54feeb3771a86d3bd692, scan passed; FastAPI full-stack cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7, scan passed with conservative configured-prefix blockers; Django boilerplate 340e19b11249b87c4d89afad423a447f279c4a1c, baseline invalid template source remains invalid but shared exclusion now permits successful scan of remaining files. All ten final scans exited successfully; Django used exclude /backend/users/tasks.py. Final bun run check: 664 passed, 38 skipped, 0 failed. Full-context review found nested-function app shadowing; fixed and regression-tested. Remaining placement questions (Requests helper, pytest/Poetry CLI aliases) concern generic core C4 policy and were not changed during this scanner task.

Final verification after the nested-scope fix: bun run check passed (664 tests passed, 38 skipped, 0 failed). Rebuilt scanner still reports Flask tutorial /hello. All ten temporary clones and the temporary scanner package were removed from /tmp/groma-python-483; nonexistence verified. Python report delivered to Alex; work paused before another scanner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified ten pinned Python repositories, fixed proven scan failures and route/source evidence gaps, and documented conservative limits. Verified with focused repository reruns and bun run check (664 pass, 38 skip); removed temporary clones and reported the Python result.
<!-- SECTION:FINAL_SUMMARY:END -->
