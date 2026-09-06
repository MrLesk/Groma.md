---
id: TASK-60
title: Parse the Groma CLI with Commander
status: Done
assignee:
  - '@alex'
created_date: '2026-08-16 19:37'
updated_date: '2026-08-16 19:39'
labels: []
dependencies: []
references:
  - src/cli.ts
documentation:
  - docs/product-model.md
priority: high
type: chore
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs groma view, web, scan, or accept, Commander parses the command line. The supported commands keep the same entry points and the same success and failure output. Groma no longer slices process.argv by hand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view, web, scan, and accept are registered through Commander
- [x] #2 groma scan still prints ok and a short summary and exits
- [x] #3 groma accept still applies a matched ghost or fails without accepting
- [x] #4 commander is a pinned runtime dependency
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
1. Pin commander and rewrite src/cli.ts to register view, web, scan, and accept as Commander commands. Keep existing success and failure text. Use parseAsync because the actions are async.
2. Existing CLI tests cover scan and accept. Run those plus bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pinned commander 15.0.0. src/cli.ts registers view, web, scan, and accept and uses parseAsync. Success and failure text for scan and accept is unchanged.

Verification: node --import=tsx --test test/cli-scan.test.ts test/accept.test.ts 9/9. tsc --noEmit clean. bun test of chrome/projection/viewer-lifecycle 16/16. Full bun run check fails in untracked test-bun/action-path.test.ts from other in-progress work; that file is not in this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CLI is now parsed by Commander 15. view, web, scan, and accept keep the same entry points and the same scan/accept output. Verified with the CLI scan and accept tests (9/9) and tsc.
<!-- SECTION:FINAL_SUMMARY:END -->
