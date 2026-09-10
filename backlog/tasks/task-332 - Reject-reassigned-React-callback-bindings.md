---
id: TASK-332
title: Reject reassigned React callback bindings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 19:04'
updated_date: '2026-09-10 19:17'
labels: []
dependencies: []
references:
  - scanner-scan
modified_files:
  - test-bun/react-scanner.test.ts
  - plugins/scanners/react/src/scan.ts
type: bug
ordinal: 378000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When scanning a React component that replaces its destructured callback parameter before invoking it, do not infer a certain relationship to the originally supplied handler. Preserve normal direct callback inference.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A component that directly reassigns its callback parameter emits no certain invocation or derived relationship to the supplied handler and reports unsupported-react-binding.
- [x] #2 An unchanged direct callback still infers the supported relationship.
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
Add a failing packaged-scanner regression using the existing React fixture; reject callback parameters assigned within the component using compiler symbol identity; run focused React tests and repository checks, and record platform coverage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression reproduced the false editor-to-host relationship before the fix. The scanner now rejects direct assignment to the callback compiler symbol anywhere inside the component. The existing documented exclusion of mutable callback values applies; no OKF fields or C4 concepts change. Core still owns relationship interpretation, and ordinary Markdown retains readable relationship rows.

Both acceptance criteria pass in the repository check: the new packaged-scanner regression emits no relationship, no invocation, and an unsupported diagnostic; the existing direct-callback test still passes. Specification and quality review found no blocking defect within the approved direct-reassignment example. The guard uses compiler symbols, not parameter spellings or project-specific names. Existing React documentation already excludes mutable values. Focused invocation used the Bun default 5-second timeout and timed out in the unchanged watch test; that same watch test passed in 1.74 seconds in the repository check using its existing 20-second setting. No timeout or test behavior changed. Linux and Windows CI validation remains pending; local host is macOS ARM64.

Final local check passed: bun run check, 110 Node tests and 415 Bun tests, 7 optional-toolchain skips, zero failures. Six existing complexity warnings remain outside this change. All five React tests passed, including the watch flow. git diff --check passed. Implementation is ready for human review; task remains In Progress until requested Linux and Windows verification is complete.

Alex confirmed that CI is fine and accepted completion. No further platform validation is required before closing this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rejects direct reassignment of a React callback parameter before making a certain handler claim. The regression failed before the fix and passes afterward; normal callbacks remain supported. bun run check passed on macOS ARM64: 110 Node tests and 415 Bun tests, with 7 optional-toolchain skips. Alex confirmed CI is fine.
<!-- SECTION:FINAL_SUMMARY:END -->
