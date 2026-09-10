---
id: TASK-343
title: Extract TypeScript exports from parsed declarations
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-10 22:08'
updated_date: '2026-09-10 22:11'
labels: []
dependencies: []
references:
  - typescript-scanner
modified_files:
  - test-bun/typescript-source-usage.test.ts
  - plugins/scanners/typescript/src/source-analysis.ts
type: bug
ordinal: 389000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generated-code template strings in pi-mono are falsely reported as exported source symbols. Use actual supported top-level declarations so scan evidence describes code declared in the source file.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Template-string generated exports are absent while real exported declarations retain source symbol identities and kinds.
- [x] #2 The pi-mono image model generator reports its actual export without the generated IMAGE_MODELS symbol.
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
Add a generated-source regression and controls for existing export kinds; read supported declarations from the existing compiler AST; verify focused tests, type checking, and the pi-mono witness.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Regression failed before the fix on an imaginary exported variable inside a template string. Existing parsed top-level declarations now supply symbols; supported declaration kinds, IDs, abstract/default/declare classes and async functions remain covered. Focused tests: 3 pass, 23 assertions. Type checking and changed-file Biome lint pass without warnings. Current source analysis against real pi-mono verifies only parseOpenRouterImageModels from its generator; Stack and TuiBase remain class symbols. Evidence and task-only diff: /tmp/groma-accuracy-audit/fix-symbol-syntax/. Self specification, quality and simplicity reviews found no blocker: one existing AST traversal, one variable helper and a kind mapping, no parser or dependency additions. Existing OKF source references and C4 ownership remain unchanged; exported declaration contract already documents this behavior. Full repository check and commit/push remain with coordinator.

Root reviewed the task-only diff for scope and simplicity. Full bun run check passed in the current workspace (110 Node + 440 Bun, 7 optional skips) and isolated committed-code checkout with only our fixes (110 Node + 426 Bun, 7 skips). Commit/push, cross-platform CI and a new cold review follow.
<!-- SECTION:NOTES:END -->
