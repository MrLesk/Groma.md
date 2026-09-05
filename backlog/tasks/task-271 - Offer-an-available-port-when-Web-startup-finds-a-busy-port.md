---
id: TASK-271
title: Offer an available port when Web startup finds a busy port
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:06'
updated_date: '2026-09-05 19:10'
labels: []
dependencies: []
references:
  - commands
  - web-server
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/server.ts
  - src/cli.ts
  - test-bun/web-port.test.ts
  - docs/viewers/web/index.md
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When groma web cannot bind its requested port, an interactive terminal offers another available port with a yes/no prompt. Accepting starts the same viewer on a free port and prints its URL; declining exits without starting a viewer. The user reproduced the default port 4747 being occupied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A busy requested port prompts interactive users to continue on another available port; y starts the viewer and prints its actual URL.
- [x] #2 n or cancelling the prompt exits without starting another viewer; the process holding the original port stays untouched.
- [x] #3 Noninteractive runs fail with a concise actionable --port message instead of waiting for input; unrelated startup errors keep their existing handling.
- [x] #4 A failed bind starts no scan or live map session; startup and busy-port checks, a real y/n terminal walkthrough, and bun run check verify the change.
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
1. Bind the Web HTTP port before scanning or creating the ready map session. 2. Catch only EADDRINUSE in the Web CLI entry, reuse Clack confirmation on a terminal, and retry once with port 0 only after yes; offer --port 0 to noninteractive callers. 3. Verify occupied-port lifecycle with isolated fixtures, exercise y and n in a terminal, update the Web startup documentation, run the repository check and implementer reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused startup and port checks passed 6/6. bun run check passed 105 Node tests and 306 Bun tests with seven existing lint warnings outside this change. Real tui-test verification: with a temporary listener on 51340, n exited 0; y started Groma on 51574 and its setup page returned HTTP 200, while 51340 still served the original response. Implementer specification and quality reviews passed: only EADDRINUSE triggers confirmation, port 0 is requested once only after yes, noninteractive invocation exits with its command, and bind occurs before scanning or map subscriptions. No new module or architecture concept is introduced; port selection remains CLI behavior and listener binding remains Web-server behavior.

Ctrl+C at the terminal prompt also exited 0. Final full-context complexity review passed with no blocking findings or material recommendations: CLI owns confirmation; Web server owns binding; no new abstraction is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web now catches an occupied port and offers an interactive y/n choice. Yes starts on an available port and prints the actual URL; no or cancellation exits without touching the existing listener. Noninteractive runs receive the --port 0 command. Binding now precedes scanning and live subscriptions. Verified with occupied-port fixture tests, real y/n/cancel terminal checks, HTTP checks for both listeners, 105 Node tests, 306 Bun tests, and the full-context review.
<!-- SECTION:FINAL_SUMMARY:END -->
