---
id: TASK-340
title: Recognize exported abstract TypeScript classes
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 21:57'
updated_date: '2026-09-10 22:04'
labels: []
dependencies: []
references:
  - typescript-scanner
modified_files:
  - test-bun/typescript-source-usage.test.ts
  - plugins/scanners/typescript/src/source-analysis.ts
type: bug
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TypeScript scanner omits exported abstract classes from source symbols, including Stack and TuiBase in pi-mono. Recognize these declarations within the existing exported class evidence contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Exported abstract classes appear as class symbols with their source identity, alongside ordinary exported classes.
- [x] #2 Current-source scanning of pi-mono reports Stack and TuiBase as class symbols.
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
Add a focused source-symbol regression, allow the abstract modifier in existing extraction, and verify the regression plus pi-mono symbols. Preserve architecture ownership and scanner contracts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression failed before the fix because Abstract was missing and passes after the one-line modifier change. bun test test-bun/typescript-source-usage.test.ts: 2 pass, 21 assertions. Current-source scanner analyzed the pi-mono temporary copy (690 files); exact Stack and TuiBase class symbol identities verified by /tmp/groma-accuracy-audit/fix-abstract/verify.ts. Spec, quality, and simplicity review: existing extraction gains one optional modifier; no new API, parser, ownership, or C4 concept. Symbols remain source evidence under the existing Groma profile, and ordinary OKF Markdown meaning is unchanged. No documentation change needed because exported classes are already promised. Task-only diff and baseline saved under /tmp/groma-accuracy-audit/fix-abstract/. Full repository check, commit and push are assigned to the coordinator.

Root verification passed: bun run check in current workspace (110 Node + 438 Bun, 7 optional-toolchain skips) and isolated HEAD checkout containing only the four audit fixes (110 Node + 424 Bun, 7 skips). No new lint warnings. Root reviewed task-only diff for scope and simplicity. Commit/push, cross-platform CI, and independent fresh review follow; task remains In Progress until delivery checks finish.
<!-- SECTION:NOTES:END -->
