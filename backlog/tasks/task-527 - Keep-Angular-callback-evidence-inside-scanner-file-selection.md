---
id: TASK-527
title: Keep Angular callback evidence inside scanner file selection
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 15:37'
updated_date: '2026-09-26 15:42'
labels: []
dependencies: []
references:
  - angular-src-index
modified_files:
  - test-bun/angular-scanner.test.ts
  - plugins/scanners/angular/src/scan.ts
priority: medium
type: bug
ordinal: 612000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 0.5 review found that Angular adds an imported output provider back to its observation even when the include list omits it. The watcher correctly ignores that file, leaving evidence outside configured scanner scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Omitting emitter.ts from the angular-output fixture include list leaves it out of files, operations and callback relationships.
- [x] #2 Selecting the emitter still produces its callback evidence and watches its changes.
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
1. Limit Angular callback directive candidates to the scanner-readable files before collecting output evidence. 2. Extend the Angular scanner tests with the existing output fixture through createScannerRegistry and an explicit include list. Test authority: TASK-519.4 include/watch contract and the approved review fix. Wrong result: emitter.ts appears in evidence while watchesFile returns false. Existing output tests select both endpoints and exclusion coverage uses independent files; test the omitted emitter and then selected emitter in the same supported fixture. 3. Prove the regression before fixing, run focused checks, then the repository check. This restores source evidence boundaries, without changing OKF storage or C4 meaning.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: scanProject filters directive candidates by the supplied readable set before template bindings create operations. Compiler context remains available for existing value resolution. The registry regression failed before the fix because emitter.ts leaked into files while unwatched, and now checks files, operations, inferred callbacks and watch selection with the emitter omitted and selected. Angular scanner and HTTP suites: 14 passed. This restores the documented selection contract; no storage or architecture-model changes. No blocking specification or quality finding in the changed flow.

Final validation: bun run check passed (16 Node tests, 750 Bun tests, 48 skipped, zero failures); git diff --check passed. The shared checkout also contains ongoing TASK-480 changes, which were preserved. Self specification and quality reviews are complete for this fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angular output bindings now use directive candidates from the scanner-selected files. The registry regression proves that omitted emitters contribute no files, operations or relationships and selected emitters remain watched; it failed before the fix and passes afterward. All 14 focused Angular tests passed. Repository check passed with 16 Node tests and 750 Bun tests; 48 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
