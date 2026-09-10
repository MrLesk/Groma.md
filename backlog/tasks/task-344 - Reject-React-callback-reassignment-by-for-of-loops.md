---
id: TASK-344
title: Reject React callback reassignment by for-of loops
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 22:08'
updated_date: '2026-09-10 22:11'
labels: []
dependencies: []
references:
  - scanner-scan
modified_files:
  - test-bun/react-scanner.test.ts
  - plugins/scanners/react/src/scan.ts
priority: medium
type: bug
ordinal: 390000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A for-of loop assigning to a callback parameter currently leaves a false certain relationship to the original supplied handler. Apply the existing mutable callback abstention rule to that assignment target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A for-of assignment to the callback parameter produces no certain invocation or derived relationship and reports unsupported-react-binding.
- [x] #2 A for-of loop declaring a separate or shadow variable preserves the supported callback relationship.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the false relationship with a packaged fixture. 2. Reuse exact-symbol write detection for for-of initializers. 3. Run typecheck and focused React tests; hand off for full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The packaged for-of regression failed before the fix with a false editor-to-host relationship; separate and shadow loop variables preserved the callback. A single existing-helper call now detects for-of assignment targets. Variable declaration lists do not write the outer callback symbol. Afterward all 11 React tests pass with the repository timeout and native filesystem permissions; bun run typecheck and targeted Biome pass. Self specification, quality and simplicity reviews found no further blocker: no new loop model, inference capability, nullable fallback or architecture concept. Existing mutable-value exclusion already documents behavior. OKF relationships and C4 ownership are unchanged. Root owns full repository checks and finalization; task-only patches and snapshots are under /tmp/groma-accuracy-audit/fix-react-loop.

Root reviewed the task-only diff for scope and simplicity. Full bun run check passed in the current workspace (110 Node + 440 Bun, 7 optional skips) and isolated committed-code checkout with only our fixes (110 Node + 426 Bun, 7 skips). Commit/push, cross-platform CI and a new cold review follow.
<!-- SECTION:NOTES:END -->
