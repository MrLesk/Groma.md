---
id: TASK-342
title: Preserve React TypeScript configuration origin
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 21:58'
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
ordinal: 388000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React scanner drops the selected tsconfig filename when parsing compiler options, rejecting compiler-valid incremental builds and resolving explicit types from the wrong context. Preserve the compiler configuration origin without changing project options or weakening diagnostics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A valid incremental React project prepares and produces its direct supplied callback relationship without writing build information.
- [x] #2 The prepared Gemini CLI configuration no longer produces artificial incremental or vitest/globals option errors.
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
1. Reproduce with a packaged incremental callback fixture. 2. Pass the selected config filename through the compiler parser. 3. Verify focused React tests and the real Gemini configuration; hand off for full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression failed before the fix with the incremental compiler option error. After passing the selected tsconfig filename as the parser fifth argument, all 10 React tests pass with the repository 20000ms timeout and native filesystem permissions. The incremental case verifies readiness, direct callback inference and absent tsconfig.tsbuildinfo. Biome passes. Real prepared Gemini CLI compiler probe reports both incremental and vitest/globals errors without the filename and no option errors with it. Packaged scanner now reaches semantic checking and stops on TextInput.tsx terminalCursorFocus prop type errors, a separate project preparation limitation left unchanged. Self specification, quality and simplicity review: direct use of compiler API context, no diagnostics suppressed, no new abstraction or public contract; OKF and C4 storage unchanged. Full repository check and finalization remain assigned to root.

Root verification passed: bun run check in current workspace (110 Node + 438 Bun, 7 optional-toolchain skips) and isolated HEAD checkout containing only the four audit fixes (110 Node + 424 Bun, 7 skips). No new lint warnings. Root reviewed task-only diff for scope and simplicity. Commit/push, cross-platform CI, and independent fresh review follow; task remains In Progress until delivery checks finish.
<!-- SECTION:NOTES:END -->
