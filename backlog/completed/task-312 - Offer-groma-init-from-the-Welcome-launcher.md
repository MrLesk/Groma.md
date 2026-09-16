---
id: TASK-312
title: Offer groma init from the Welcome launcher
status: Done
assignee:
  - '@alex'
created_date: '2026-09-06 19:35'
updated_date: '2026-09-06 19:36'
labels: []
dependencies: []
references:
  - welcome
  - init-command
modified_files:
  - src/cli.ts
  - docs/product-model.md
  - src/init-command-ui.ts
  - test/first-run.test.ts
type: bug
ordinal: 350000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare `groma` currently throws a stack trace from GromaFileSystem.open when the repository has no Groma project, because Welcome loads scanner inventory before initialization. On a TTY it should use the same first-run Clack confirm as `groma view` and the occupied-port prompt: ask whether to initialize now, and Yes runs the existing init wizard before Welcome. Without a TTY, or with `--plain`, it should print one sentence naming `groma init` and fail without a stack trace. Interactive `groma instructions` uses the same door because it also opens Welcome.

Reproduced example: running `groma` in ~/projects/alex-cv with no Groma records prints Groma is not initialized here. Run groma init. plus a stack from scanner inventory through welcome/model.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a TTY, bare groma in a repository without Groma records asks with Clack whether to initialize now; Yes runs the existing init wizard and then opens Welcome; No prints one line naming groma init and writes nothing.
- [x] #2 Without a TTY, or with groma --plain, a repository without Groma records prints one sentence naming groma init, exits non-zero, and does not print a stack frame.
- [x] #3 Interactive groma instructions uses the same initialization door before opening Welcome.
- [x] #4 Tests cover the non-interactive missing path for bare groma and groma --plain.
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
1. Route bare groma, interactive groma instructions, and groma view through one CLI helper that calls ensureInitialized.
2. On a TTY, that helper uses the existing Clack init confirm and wizard; without a TTY or with --plain it prints the one-sentence groma init message and fails without a stack.
3. After a successful init from Welcome, skip scan/viewer questions and open Welcome.
4. Add first-run tests for non-interactive bare groma and groma --plain; mention the same door in the product model.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification: AC1/AC3 use continueWhenReady(true) before Welcome, which is ensureInitialized (Clack Initialize now? (y/n), then the existing wizard, then startWelcome). Existing first-run tests cover yes, no, and cancel. AC2/AC4: bun test test/first-run.test.ts covers bare groma and groma --plain (one stderr line naming groma init, exit 1, no stack). Quality: one CLI helper shared with groma view; no extra catch or fallback. bun run check: 110 Node and 340 Bun tests pass; 6 existing Biome complexity warnings; git diff --check clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare groma and interactive groma instructions now use the same first-run Clack door as groma view. On a TTY they ask whether to initialize now and then open Welcome; without a TTY they print one sentence naming groma init and fail without a stack. Verified with first-run tests including the new non-interactive welcome cases, bun run check (110 Node + 340 Bun passing), and git diff --check.
<!-- SECTION:FINAL_SUMMARY:END -->
