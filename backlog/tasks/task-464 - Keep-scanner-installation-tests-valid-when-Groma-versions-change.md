---
id: TASK-464
title: Keep scanner installation tests valid when Groma versions change
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 16:39'
updated_date: '2026-09-20 16:43'
labels: []
dependencies: []
references:
  - src-scanner
modified_files:
  - test-bun/scanner-installation.test.ts
  - test-bun/scanner-update.test.ts
  - test-bun/scanner-upgrades.test.ts
priority: high
type: bug
ordinal: 540000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Preparing the approved Groma 0.4.0 release reproduces five failures in existing scanner installation and update tests. Their compatible fixture packages require Groma ^0.3.0 while the real release check uses package.json.version from the release tag. The release fails before publication even though scanner version selection behaves correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Existing scanner installation and update scenarios pass with the development version and with Groma 0.4.0.
- [x] #2 Scanner update tests still reject the deliberately incompatible release and select the newest compatible fixture release.
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
1. Reuse the current package version for the compatible fixture packages in the three affected test files. Keep the deliberately incompatible package and all behavior assertions unchanged.
2. Test authority: the approved 0.4.0 release must pass its existing checks. A disposable committed-source snapshot with package.json.version=0.4.0 produced five failures because every eligible fixture required ^0.3.0. Existing tests cover installation, retry, restoration and newest-compatible update selection; fix their setup only, with no new tests or assertions.
3. Run the three affected test files at both versions, then bun run check. Review the small diff and preserve unrelated local changes.
4. Complete the requested full-context review, then finalize, commit and push only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before the fix, the five existing tests all failed in a disposable committed-source snapshot reporting Groma 0.4.0. After the fix, the same five tests and all 56 assertions pass with both 0.3.3 and 0.4.0. Complete bun run check passed: 16 Node tests; 621 Bun pass, 36 expected skips, zero failures. Only two pre-existing complexity warnings remain. No new assertions, helper modules, runtime behavior or documentation changes were introduced.
Implementer specification and quality reviews: both criteria are proved by the two-version runs. Compatible fixture packages read the exact host version; the newer ^9.0.0 package stays incompatible and the existing selection assertion still requires 1.1.0. Ownership is local to each existing test fixture and the path from setup to installation/update result is unchanged. The cold review is not required for this small fixture fix; the user-requested full-context review follows.

Final full-context complexity review: keep the change. No blocking issues or material simplifications. Direct imports are simpler than a new fixture helper, keep ownership beside each scenario, and remove a hidden version-maintenance step. The incompatible package and selection assertions remain intact.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compatible packages in three existing scanner installation/update fixtures now use the current Groma version. This fixes five release-check failures at 0.4.0 without changing production behavior or assertions. The five tests pass at both 0.3.3 and 0.4.0; bun run check passes 16 Node and 621 Bun tests with 36 expected skips. Implementer specification/quality review and the requested full-context review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
