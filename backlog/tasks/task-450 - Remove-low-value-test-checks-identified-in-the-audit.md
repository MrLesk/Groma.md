---
id: TASK-450
title: Remove low-value test checks identified in the audit
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 10:01'
updated_date: '2026-09-20 10:06'
labels: []
dependencies: []
references:
  - instructions
  - src-core
  - src-list-window
modified_files:
  - test-bun/agent-instructions.test.ts
  - test-bun/source-coverage.test.ts
  - test-bun/list-window.test.ts
  - test-bun/plain-view.test.ts
type: chore
ordinal: 522000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The test audit found a documentation inventory test, an owner lookup case that only checks a heading, and repeated assertions of pagination prose. Remove those low-value checks while retaining the supported ownership, paging, and error behavior already covered by the surrounding tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The documentation inventory suite and redundant owner-heading case are removed.
- [x] #2 Pagination tests retain page boundaries, stable order, numeric ranges, next-command arguments, and invalid-option rejection without freezing surrounding prose or duplicating those checks.
- [x] #3 Only the four audited test files change; product behavior, fixtures, and unrelated workspace changes are preserved.
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
1. Delete test-bun/agent-instructions.test.ts: it checks a documentation inventory rather than supported domain behavior.
2. Remove the owner-heading case and its unused imports from test-bun/source-coverage.test.ts. Retain the existing plain-view owner-command test and the scanner ownership suites.
3. In test-bun/list-window.test.ts, retain the TASK-420 paging contract (range, total, continuation arguments, and invalid-option rejection) while replacing full prose comparisons with the minimum meaningful values. This changes assertions in existing cases and adds no test cases or new behavior.
4. In test-bun/plain-view.test.ts, remove repeated footer prose checks and the redundant drill-down content case. Keep page reassembly, draft bounds, relationship direction, and the exact owner command.
5. Record each changed file and its component reference immediately. Run the focused suites, then bun run check. Review the final diff for retained behavior coverage, unnecessary assertions, and unrelated changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed three low-value cases: the documentation inventory suite, the owner-heading case already covered by the exact owner command in plain-view, and the redundant drill-down text case. Removed repeated footer assertions from plain-view; list-window now checks only option identity, numeric paging values, and continuation arguments. No new cases, product changes, or fixtures. Focused verification: 16 tests passed across source-coverage, list-window, and plain-view; git diff --check passed. Implementer specification and quality review found the retained tests cover ownership, direction, page ordering, draft bounds, ranges, and continuation behavior without the removed prose checks. The first full check passed lint, types, and 16 Node tests; its Bun run had 588 passes, 36 skips, and 20 failures involving sandbox-denied local servers, FSEvents, and process checks. A full run with the required permissions is in progress.

Final verification: bun run check passed outside the sandbox, confirming the earlier server, watcher, and process failures were permission-related. Biome, scrollbar lint, and TypeScript checks passed; 16 Node tests and 608 Bun tests passed, 36 Bun tests were skipped by their existing environment/tool gates, zero failures. No retries, test skips, timeout changes, or unrelated source fixes were added. The final diff contains only the four audited test files (three cases removed, 46 net lines removed), plus this task record; earlier AGENTS.md edits and other workspace changes were preserved. Acceptance review: documentation inventory and owner-heading checks are gone; focused tests prove retained paging and owner-command behavior. Quality review: no new cases or test infrastructure, no copied implementation, and no production behavior changes. Existing contracts and documentation remain accurate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the documentation inventory suite, the redundant owner-heading case, and the duplicate drill-down text case. Reduced pagination assertions to meaningful range values, next-command arguments, and invalid-option identity. Existing ownership and page-order coverage remains. Focused suites passed (16 tests); bun run check passed with required permissions (16 Node and 608 Bun passes, 36 existing skips).
<!-- SECTION:FINAL_SUMMARY:END -->
