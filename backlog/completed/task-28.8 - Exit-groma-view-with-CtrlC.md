---
id: TASK-28.8
title: Exit groma view with Ctrl+C
status: Done
assignee:
  - grok
created_date: '2026-08-15 16:10'
updated_date: '2026-08-15 16:19'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
  - docs/viewers/index.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma view`, Esc must not leave the viewer. Esc still closes open details and otherwise does nothing. Ctrl+C is the only way to leave: Groma restores the terminal and returns to the shell without a stack dump or leftover alternate-screen state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Esc with details open closes details without changing level, selection, or geometry
- [x] #2 Esc with details closed leaves the viewer running
- [x] #3 Ctrl+C exits Groma, restores the terminal, and returns to the shell with status 0 and no stack dump
- [x] #4 The footer names Ctrl+C as the exit key, and Esc as close while details are open
- [x] #5 docs/viewers/tui/index.md describes Esc close and Ctrl+C exit
- [x] #6 Headless tests cover Esc-does-not-exit and Ctrl+C exit
- [x] #7 An agent-tty session of groma view leaves on Ctrl+C with the terminal restored
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
1. Esc only dismisses open details. With details closed it is a no-op and never calls destroy.
2. Keep Ctrl+C as the only exit: the existing key handler already calls destroy(); OpenTUI already restores the alternate screen via clearOnShutdown. Do not add a second SIGINT path unless a real session dumps or leaves the terminal unrestored.
3. Footer always shows `Ctrl+C exit`. Show `Esc close` only while details are open.
4. Update docs/viewers/tui/index.md so Esc closes details and Ctrl+C leaves.
5. Headless tests: Esc with details closed leaves the renderer alive; pressCtrlC closes it. Replace footer Esc-exit assertions.
6. Confirm with agent-tty: Esc keeps System Context visible; Ctrl+C ends the session with status 0 and no stack dump.
7. Align TASK-28 AC #8 with the new exit key.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Esc only dismisses open details. Ctrl+C is the only destroy path; OpenTUI clearOnShutdown restores the alternate screen and cli.ts awaits closed so the process ends 0.

Cold simplicity review asked to drop the duplicate details-test exit sequence and the 50ms Esc wait in press(). The duplicate sequence was removed. The wait had to stay: OpenTUI's stdin parser treats ESC as a possible CSI prefix, so dismiss is not applied before renderOnce() without it.

Verification:
- bun test test-bun/terminal-viewer.test.ts 9/9
- bun run check: tsc 7.0.2, architecture validate, 52 Node, 9 Bun
- agent-tty 120x36 bun src/cli.ts view: Esc kept the same screenHash; Enter then Esc showed Esc close then closed details while status stayed running; Ctrl+C exitCode 0, clean-exit, exitSignal null, post-exit screen empty.

Reviews: cold simplicity FINDINGS (applied one, reverted the Esc wait after tests failed), targeted re-review then regression fix, specification PASS, quality PASS. No blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Esc no longer leaves `groma view`. It only closes open details. Ctrl+C is the exit key: the viewer destroys the renderer, OpenTUI restores the alternate screen, and the process returns to the shell with status 0.

The footer always shows `Ctrl+C exit` and shows `Esc close` only while details are open. docs/viewers/tui/index.md matches that split. TASK-28 AC #8 now says Esc does not exit.

Verified by bun test test-bun/terminal-viewer.test.ts 9/9, bun run check, and an agent-tty 120x36 walkthrough of Esc stay, details Esc close, and Ctrl+C clean-exit 0.
<!-- SECTION:FINAL_SUMMARY:END -->
