---
id: TASK-475
title: Keep revision test fixtures independent of Git line endings
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 06:52'
updated_date: '2026-09-21 06:55'
labels: []
dependencies: []
references:
  - 'https://github.com/MrLesk/Groma.md/actions/runs/35566456973'
  - history-revisions
modified_files:
  - test-bun/web-export.test.ts
  - test-bun/web-revisions.test.ts
priority: high
type: bug
ordinal: 551000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows CI run 35566456973 fails the web revision and commit-export source assertions. The copied fixture uses CRLF while the temporary repository inherits Git auto conversion and commits LF. Tests must control this setup while keeping exact source assertions and production snapshot behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Revision and export fixture commits retain the exact source content supplied by each test on Windows and Unix hosts.
- [x] #2 Existing revision, comparison, and export assertions pass without line-ending normalization, removed checks, or changed timeouts.
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
1. Reproduce the Windows CRLF fixture and inherited Git auto conversion in an isolated temporary repository. 2. Disable automatic line-ending conversion in the two existing test repositories before their first commit. The fixture setup owns this policy; production archive and source behavior stay unchanged. 3. Run the existing focused tests and complete bun run check, review the two-line change, then push and verify the ordinary CI matrix. No new test or assertion is needed: the existing exact source assertions already detect the reproduced mismatch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the exact mismatch with a temporary CRLF source fixture: core.autocrlf=true archives 134 bytes from a 143-byte working file; core.autocrlf=false archives all 143 bytes unchanged. Added a local Git setting before the first commit in each failing test. Existing assertions and product code are unchanged.

Focused checks passed: 3 existing tests, 79 assertions. Complete bun run check passed: 632 Bun tests, 36 existing skips, no failures, plus lint, types and Node checks. Specification review: each temporary repository explicitly preserves LF or CRLF source bytes before adding files. Quality review: both local settings are isolated to the test repository; exact source, comparison, unchanged-checkout assertions and timeouts remain intact. No product, CI workflow, runner lifecycle or documentation contract changes are needed. Final native CI verification follows the push.

Full-context complexity review found no blocking issue and recommends keeping the two direct calls. A shared helper would add indirection without simplifying the flow. The implementation and local verification are complete; the ordinary three-host CI run will verify the pushed head and its result will be reported in the conversation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the two revision/export test repositories preserve source bytes by setting core.autocrlf=false before their first commit. The Windows CRLF mismatch was reproduced and corrected without changing production code, assertions, timeouts or CI configuration. Focused tests and the complete repository check pass (632 passed, 36 skipped); complexity review found no issue.
<!-- SECTION:FINAL_SUMMARY:END -->
