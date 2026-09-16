---
id: TASK-239
title: Offer groma init when groma view finds no Groma project
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 20:59'
updated_date: '2026-09-03 21:02'
labels:
  - cli
dependencies: []
ordinal: 268000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running `groma view` in a repository that has no Groma directory ends today with the raw error "Groma is not initialized; run groma init". When a human runs `groma view` on a TTY in that state, Groma asks with the Clack prompt used by `groma init` whether to initialize now; Yes runs the init wizard and then opens the map, No exits quietly with one line pointing to `groma init`. When the output is not a TTY, or `--plain` is set, Groma prints one sentence pointing to `groma init` and exits with a non-zero code. No stack trace in either case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a TTY, `groma view` in a repository without a Groma directory asks with Clack whether to run `groma init`; Yes runs the same init wizard as `groma init` and then opens the terminal map
- [x] #2 Answering No exits with code 0 and one line naming `groma init`
- [x] #3 Without a TTY, or with `--plain`, `groma view` prints one sentence naming `groma init` and exits with a non-zero code
- [x] #4 Neither path prints a stack trace or an unexplained error
- [x] #5 Tests cover the non-TTY path and the TTY prompt through the init UI seam, using fixtures under test/fixtures
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
1. Verify the existing missing-project decision through focused tests and a real TTY with tui-test. 2. Confirm Yes, No, plain, and non-TTY outcomes have the required exit behavior and no stack trace. 3. Run required reviews and finalize without code changes unless a supported-flow gap is reproduced.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification on 2026-09-03: a real 100x30 tui-test PTY showed the Clack initialization prompt. Selecting No returned exit code 0 and the single line 'Run groma init when you are ready.' The Yes branch entered the shared init path; focused first-run tests prove the same name and directory wizard is invoked and returns ready to the view caller. Direct view --plain in a repository without Groma exited 1 with one sentence naming groma init and no stack. Focused first-run suite passed 6/6; the current full check passed 107 Node and 269 Bun tests. Specification, quality, and required full-context complexity reviews found no material gap or simpler safe structure.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed and verified the first-run door for groma view: TTY users can start the shared init wizard, No exits quietly, and plain/non-TTY use one actionable failure sentence. Verified with a real tui-test session, direct CLI output, 6 focused tests, and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
