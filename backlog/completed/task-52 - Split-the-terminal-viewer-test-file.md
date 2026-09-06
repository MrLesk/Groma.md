---
id: TASK-52
title: Split the terminal viewer test file
status: Done
assignee: []
created_date: '2026-08-16 18:29'
updated_date: '2026-08-16 18:32'
labels: []
dependencies: []
references:
  - test-bun/terminal-viewer.test.ts
priority: medium
type: chore
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The terminal viewer tests live in one 1200-line file. Split them by concern so each file is a readable suite: projection, navigation, camera, tree, chrome, and lifecycle. Shared helpers move to one module. bun test test-bun still runs every case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 test-bun/terminal-viewer.test.ts no longer exists.
- [x] #2 Viewer tests are split into smaller files by concern, each well under 500 lines.
- [x] #3 bun test --timeout 20000 test-bun/ still passes the same cases.
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
1. Extract shared helpers and the in-memory navigation world.
2. Split tests into projection, navigation, camera, tree, chrome, and lifecycle files.
3. Delete the mega file and rerun the viewer suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split test-bun/terminal-viewer.test.ts into helpers plus projection, navigation, camera, tree, chrome, and viewer-lifecycle. bun test test-bun 35/35.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Viewer tests are split by concern. The 1200-line file is gone. bun test test-bun still passes 35 cases.
<!-- SECTION:FINAL_SUMMARY:END -->
