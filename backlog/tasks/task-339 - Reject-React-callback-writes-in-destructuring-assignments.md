---
id: TASK-339
title: Reject React callback writes in destructuring assignments
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 21:56'
updated_date: '2026-09-10 22:04'
labels: []
dependencies: []
references:
  - scanner-scan
modified_files:
  - test-bun/react-scanner.test.ts
  - plugins/scanners/react/src/scan.ts
priority: medium
type: bug
ordinal: 385000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React currently infers a certain supplied callback after destructuring overwrites its parameter. Apply the existing mutable-value abstention rule so the scan cannot create a false derived relationship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Array and object destructuring writes to the callback parameter produce no certain invocation or derived relationship and report unsupported-react-binding.
- [x] #2 Reads of the callback and writes to different symbols preserve the supported callback relationship.
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
1. Reproduce the false relationship with the packaged scanner. 2. Extend exact-symbol assignment target detection and add focused regressions. 3. Run React tests and review scope and simplicity; hand off for repository checks and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Packaged reproduction produced one false editor-to-host relationship before the fix and none afterward, with the existing unsupported-react-binding diagnostic. Three new array/object write regressions failed before and passed afterward. The read/default-read/different-symbol case passes. Biome passes for both changed files. Specification, quality and simplicity review: a single assignment-target helper follows only written positions, using exact compiler symbols; no mutable-flow inference or new stored concepts. Existing OKF Markdown relationships and C4 ownership stay unchanged. Public documentation already excludes mutable values, so no contract update is needed. Root will run the full repository check before finalization. Initial full React invocation hit sandbox FSEvents restrictions; unsandboxed invocation used Bun default 5s rather than repository 20s timeout and timed out in watch test; rerun with declared repository timeout pending.

Final focused validation: bun test --timeout 20000 test-bun/react-scanner.test.ts passed all 9 tests using the repository timeout with native filesystem permissions. Full bun run check remains assigned to root.

Full-check correction: changed the local visitor from a function declaration to a const arrow so TypeScript preserves the already-guarded callback symbol narrowing. No nullable fallback or assertion added. bun run typecheck and Biome pass; all 10 current React tests (including separate TASK-342) pass with repository timeout. Updated TASK-339 task-only patch and saved final source; TASK-342 baseline/final source receive the same correction, keeping its patch separate.

Root verification passed: bun run check in current workspace (110 Node + 438 Bun, 7 optional-toolchain skips) and isolated HEAD checkout containing only the four audit fixes (110 Node + 424 Bun, 7 skips). No new lint warnings. Root reviewed task-only diff for scope and simplicity. Commit/push, cross-platform CI, and independent fresh review follow; task remains In Progress until delivery checks finish.
<!-- SECTION:NOTES:END -->
