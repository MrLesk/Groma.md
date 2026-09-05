---
id: TASK-284
title: Fix remaining Windows viewer lifecycle and command issues
status: Done
assignee:
  - codex
created_date: '2026-09-05 21:48'
updated_date: '2026-09-05 21:54'
labels: []
dependencies: []
references:
  - backlog-plugin
modified_files:
  - test-bun/backlog-command.test.ts
  - plugins/work-sources/backlog/src/index.ts
  - docs/viewers/tui/validation.md
type: bug
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows Web cleanup reproduces EBUSY, Backlog .cmd launch reproduces EINVAL, and terminal validation assumes Bash. Complete these viewer fixes following TASK-232.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Closing the Web viewer releases its temporary repository so authoring and first-run tests can remove it on Windows.
- [x] #2 Backlog configuration reads work through a Windows .cmd shim in a path containing spaces; executable launch remains unchanged.
- [x] #3 TUI validation provides executable PowerShell instructions and states the tui-test prerequisite.
- [x] #4 bun run check passes on Windows and affected splash, TUI and Web flows are verified.
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
1. Read Backlog task paths before starting configuration subprocesses, so a missing task directory cannot leave children holding the repository after viewer shutdown. 2. Launch the fixed Backlog configuration queries through cmd.exe for .cmd shims, preserving direct executable launch. 3. Add regression tests for both failures and PowerShell terminal validation instructions. 4. Run focused regressions, viewer smoke checks, specification and quality reviews, and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Isolation: a Web session with the default Backlog source fails immediate repository removal with EBUSY; the same session with EMPTY_WORK_SOURCE releases it. Independent source and architecture watchers release successfully. Backlog read starts two config children in Promise.all before missing taskFiles rejects, leaving children outside the awaited work chain.

Both regressions failed before the change and pass afterward. The full previously failing Web authoring and first-run suites now pass: 11/11 focused tests including .cmd config reads from a path with spaces. Fix remains in the Backlog plugin; no watcher retries or server changes are needed.

Verification: bun run check passed with 102 Node tests and 288 Bun tests; seven unchanged pre-existing complexity warnings remain. Windows PTY smoke test passed bare splash -> TUI, Enter into Api, and Right changed selection from Stock to Orders. Browser fixture rendered the isometric map, opened Api container details, and emitted no warning/error logs. PowerShell parser accepts the documented snippet; tui-test is absent on this machine, so the CLI screenshot procedure itself was not executed. Native PTY and headless renderer tests provided terminal verification. The initial smoke fixture lacked Git initialization; initializing its temporary repository allowed the supported CLI flow to run.

Specification review: all four acceptance criteria have evidence above. Quality and simplicity review: the fix stays within the Backlog owner, preserves direct executable behavior and existing missing-work handling, uses only fixed config arguments in cmd.exe, adds two independent concurrent regressions, and avoids changes to scanner or server lifecycle. No blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed Windows EBUSY cleanup by reading task paths before launching Backlog configuration children. Backlog .cmd shims now run through cmd.exe, including paths with spaces. Added focused regressions and PowerShell TUI validation instructions. Verified 102 Node and 288 Bun tests, Windows splash-to-TUI navigation, browser container selection without warning/error logs, and PowerShell syntax. tui-test itself is not installed; terminal verification used native PTY and headless tests.
<!-- SECTION:FINAL_SUMMARY:END -->
