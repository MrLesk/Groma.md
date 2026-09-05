---
id: TASK-240
title: Guide an empty project from groma view
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 20:59'
updated_date: '2026-09-05 15:23'
labels:
  - cli
  - tui
dependencies: []
references:
  - terminal-painting
  - screen
  - plain-text-view
  - viewer-semantics
modified_files:
  - src/empty-world.ts
  - src/viewers/tui/organisms/empty.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/plain-world.ts
  - test-bun/viewer-lifecycle.test.ts
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After `groma init`, a project has a profile and no architecture. When a human runs `groma view` there, Groma shows an empty state instead of a blank map: the project name, one line saying the architecture is empty, and the two ways forward: run `groma scan` to observe the code, or start a draft (the settled name for a plan, TASK-241 vocabulary: `groma add draft <name> --overview`, then `groma draft component <name> --parent <id>` for a ghost) when nothing is built yet. The empty state uses the terminal defaults and the brand green like the splash. It leaves when the world gains its first element: a scan that folds elements, or a refresh, replaces it with the map without restarting. The "no Groma directory" and "empty world" decisions live once in core (TASK-241.2 adds the seam for the browser); this task consumes that seam or adds it if it lands first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a Groma directory and no architecture elements, groma view on a TTY shows the empty state with the project name, the empty line, and the exact groma scan, groma add draft, and groma draft component commands, instead of a blank map
- [x] #2 Escape, q and Ctrl+C leave the empty state; r refreshes it
- [x] #3 When a scan or refresh yields the first element, the map replaces the empty state in the same process
- [x] #4 groma view --plain and a non-TTY run print the same guidance as plain text
- [x] #5 Tests cover the empty-state decision and the switch to the map through a fixture under test/fixtures
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
1. Reconcile the stale groma create phrase with the task description and the settled TASK-241 command contract. 2. Verify the empty-state decision, live replacement, keys, and plain output with focused tests and tui-test. 3. Correct only reproduced gaps, then run required reviews and finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contract correction on 2026-09-03: acceptance criterion 1 named the removed groma create command, while the task description and settled TASK-241 command contract require groma add draft followed by groma draft component. The criterion now uses the current commands; no compatibility alias is added.

Implementation and verification on 2026-09-03: the existing core empty-world rule now owns shared guidance lines. Plain output prints them directly; the TUI renders them through one terminal organism, gates empty-state keys, and reuses the existing refresh/update path to replace the invitation with the map. Focused empty lifecycle and web suites passed 10/10. A real 120x36 tui-test session showed the centered project title and current commands; r kept the empty state after refresh and q exited with code 0. The final repository check passed with 107 Node and 272 Bun tests; Biome reported only the same 13 existing complexity warnings. Cold simplicity, specification, quality, and full-context complexity reviews found no material finding.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the missing terminal and plain empty-project guidance using the existing core empty-world decision. The TUI supports refresh and all requested exit keys, and the first live element replaces the invitation through the normal update path. Verified with focused tests, real tui-test QA, and a passing full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
