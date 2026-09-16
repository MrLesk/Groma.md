---
id: TASK-300
title: Remove the relationship interaction dropdown
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 13:43'
updated_date: '2026-09-06 13:45'
labels: []
dependencies: []
references:
  - web-viewer-details
modified_files:
  - src/viewers/web/organisms/relationship-details.ts
type: enhancement
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer opening relationship details sees the current interaction directly, without a dropdown for switching underlying interactions. Preserve the initial interaction details and its available edit, accept, and remove actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relationship details contain no interaction dropdown or switching control.
- [x] #2 The initially displayed interaction and its existing applicable actions remain available.
- [x] #3 Browser verification and bun run check pass.
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
Remove the selector and its label helper from the relationship details renderer, and render the existing first interaction directly. Verify the panel and edit entry in the browser, run the repository check, and perform the implementer review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex explicitly requested removal of interaction switching entirely. The renderer now displays the same first connection directly and retains its existing action rules. Browser verification of Coding agent → Commands confirms no dropdown, unchanged interaction details, and Edit opening the populated Description and Technology fields; Cancel returns to the details panel. bun run check passes with 106 Node and 327 Bun tests and six unchanged complexity warnings. git diff --check passes. Implementer specification and quality reviews found no blocking issue. No architecture or storage contract changes; existing documentation does not describe this selector, so no documentation correction is needed.

Final lint-output review found one new complexity warning in the flattened renderer (16, limit 15). Simplifying the draft-action guard before completing the task; the earlier six-warning note is superseded until the recheck.

Final recheck passes after replacing nested draft-action conditions with an early return: 106 Node tests and 329 Bun tests, six pre-existing complexity warnings, and clean git diff --check. The concurrent repository now includes two additional tests. Targeted re-review confirms the guard preserves the existing authored-draft action conditions. All acceptance criteria and Definition of Done remain verified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed interaction switching from relationship details while preserving the initial interaction and its applicable actions. Browser verification confirms the dropdown is absent and Edit/Cancel still work. Final bun run check passes all 435 tests with no new complexity warnings.
<!-- SECTION:FINAL_SUMMARY:END -->
