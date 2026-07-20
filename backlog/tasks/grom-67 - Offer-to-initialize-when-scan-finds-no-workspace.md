---
id: GROM-67
title: Offer to initialize when scan finds no workspace
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 06:07'
updated_date: '2026-07-20 06:20'
labels:
  - cli
milestone: m-4
dependencies: []
references:
  - src/cli/surface.ts
priority: medium
type: feature
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma scan in a directory without a groma workspace fails with a diagnostic that tells the user to run groma init first. In an interactive terminal that is a needless round trip: the CLI should ask whether to create the workspace now and, on yes, initialize and continue the same scan run. Non-interactive and json invocations keep the current fail-closed diagnostic so automation never creates a workspace implicitly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma scan with no workspace in an interactive plain-format terminal asks one yes-or-no question; yes initializes the workspace and the same invocation continues into the normal scan flow, no returns the existing workspace diagnostic without side effects
- [x] #2 Non-interactive or json-format scan invocations never prompt and keep the current diagnostic; declining or an unreadable answer never initializes
- [x] #3 The confirmation is injectable for tests; CLI tests cover accept, decline, and non-interactive paths, and the accepted path produces a completed scan in a fresh directory
- [x] #4 Help text mentions that scan offers initialization in an interactive terminal
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ProgramOptions gains confirm?: (question) => Promise<boolean>; program.ts builds the effective hook only for plain-format invocations on an interactive terminal (default implementation prompts on stderr and reads one line from stdin), so json and non-interactive runs can never prompt, and threads it into the surface controller like the web ready hook.
2. surface.ts scan branch: when the workspace is missing and the hook is present, ask one yes-or-no question; on yes run the shared initialize operation and workspace recovery, then fall through into the unchanged scan flow; on no (or any non-yes answer) fall through without side effects so the existing no-workspace diagnostic (exit 3) is returned.
3. Help text mentions the interactive offer.
4. Tests cover accept (scan completes in a fresh directory and the workspace exists), decline (current diagnostic, no groma/ directory), json format and non-interactive terminals (hook never called); bun run check.
Supported boundary: the offer exists only for scan in interactive plain-format terminals; no other command gains prompting; automation behavior is unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The offer lives at the top of the scan branch in surface.ts, gated on a confirm hook that program.ts supplies only for plain-format invocations on an interactive terminal (default implementation prompts on stderr and reads one stdin line; anything but y/yes declines). Accepting runs the shared initialize operation and workspace recovery inside the same host run, then falls through into the unchanged scan flow; declining falls through untouched so the existing no-workspace diagnostic (exit 3) is preserved. The hook check short-circuits before touching workspace status so hook-less surface invocations keep their exact prior behavior (a scan surface unit test caught the original ordering).
Validation: bun run check green (440 tests); new tests cover accept (workspace created and scan completed in one invocation), decline (diagnostic, no groma/ directory), json format, and non-interactive terminals (hook never invoked). The default stdin prompt is a thin adapter around the tested hook; automation paths never reach it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scan in an interactive plain-format terminal now offers to create the missing workspace and, on yes, initializes and completes the same scan run; declining, json format, and non-interactive terminals keep the exact fail-closed diagnostic with no side effects. Verified with the full check gate and four dedicated CLI tests.
<!-- SECTION:FINAL_SUMMARY:END -->
