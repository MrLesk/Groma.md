---
id: TASK-276
title: Keep the Backlog bar visible with zero mapped tasks
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:46'
updated_date: '2026-09-05 19:48'
labels: []
dependencies: []
references:
  - work-overlay
modified_files:
  - src/viewers/web/work/island.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens the Web map for a project with Backlog available but no mapped tasks, keep the bottom Backlog bar visible with its existing zero count.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The bottom Backlog bar is visible and shows 0 when Backlog is available and no tasks map to the architecture.
- [x] #2 Existing folding, status filters and mapped-task counts continue to work; projects without Backlog keep the bar hidden.
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
Use configured workflow statuses to keep the existing bar visible even when there are no pins. Update the Web viewer documentation. Verify the zero-pin project in the browser, run bun run check, and complete specification, quality and full-context reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed only the existing island visibility condition: configured Backlog statuses keep the bar visible without pins. The current summary already supplies the zero count. Browser verification against the Backlog.md project showed 0 shown / No mapped tasks, opened the empty bar and folded back to 0. A second preview with EMPTY_WORK_SOURCE kept the bar hidden. Existing summary and status-filter tests cover counting and filtering. Self specification and quality reviews found no scope gaps or defects; no architecture concepts, contracts, or new abstractions were added. The first repository check hit the known live architecture-update timeout; a clean rerun is in progress.

The complete bun run check rerun passed: Node tests passed, 306 Bun tests passed, and the same seven existing lint warnings remain. No code changes were made between runs.

Final full-context complexity review passed with no blockers or material simplifications. The reviewer confirmed the existing work snapshot owns availability and the existing summary owns counting; no new state or abstractions were introduced.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Web Backlog bar remains visible with 0 mapped tasks whenever Backlog supplies a configured workflow. Verified zero count, expand/collapse and absent-source visibility in the browser. Updated viewer documentation; bun run check passed with 105 Node and 306 Bun tests. Specification, quality and final full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
