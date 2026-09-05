---
id: TASK-277
title: Try consecutive ports after an occupied Web port
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:51'
updated_date: '2026-09-05 19:54'
labels: []
dependencies: []
references:
  - commands
modified_files:
  - src/cli.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 316000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a developer accepts the existing alternate-port prompt in groma web, try consecutive port numbers instead of requesting an arbitrary free port. Start one above the requested port and continue until binding succeeds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Accepting the prompt tries requested port +1, +2 and onward until the viewer starts and prints its actual URL.
- [x] #2 The prompt appears once; declining or cancelling starts no viewer, occupied listeners remain untouched, and unrelated startup errors still exit normally.
- [x] #3 Explicit --port 0 and noninteractive startup keep their existing behavior.
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
Replace the single port-0 retry in the Web CLI with consecutive bind attempts after confirmation, retrying only EADDRINUSE. Keep ownership in the existing CLI. Update startup documentation, verify multiple occupied consecutive ports and cancellation with tui-test, run focused lifecycle tests and bun run check, and complete implementer and full-context reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A direct retry loop inside openWeb exceeded the repository cognitive-complexity limit. Moved only that loop into a small CLI-local function; confirmation remains in openWeb and server binding is unchanged.

Final verification: real tui-test prompt on occupied ports 56140, 56141 and 56142 accepted once and started at 56143. HTTP returned 200 for the new setup page; all three occupied ports still returned their original response. Declining and Ctrl+C each exited 0. Screenshot: /tmp/groma277-ports.svg. bun run check passed with 105 Node tests, 306 Bun tests and the same seven existing lint warnings; no warning remains in src/cli.ts. Existing busy-bind lifecycle and noninteractive tests passed. Self specification and quality reviews passed: only EADDRINUSE retries, each retry binds before scanning/subscriptions, and explicit port 0 and noninteractive behavior are unchanged. No new module, architecture concept or fallback mode was introduced.

Final full-context complexity review passed with no blockers or material simplifications. Consecutive selection remains CLI-owned; the existing Web server still owns binding and lifecycle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
After one alternate-port confirmation, groma web now increases the requested port by 1 until binding succeeds and prints the selected URL. Verified three occupied consecutive ports, HTTP responses, decline and cancellation through tui-test, and existing lifecycle tests. bun run check passed with 105 Node and 306 Bun tests. Specification, quality and full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
