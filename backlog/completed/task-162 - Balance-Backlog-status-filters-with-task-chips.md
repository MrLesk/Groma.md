---
id: TASK-162
title: Balance Backlog status filters with task chips
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 20:58'
updated_date: '2026-08-23 21:02'
labels: []
dependencies: []
references:
  - web-viewer
  - render
modified_files:
  - src/viewers/web/work/island.ts
  - docs/viewers/web/index.md
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect expands the Backlog task bar, its outer shell should return to the approved 28px pill radius, status filters should carry the same vertical weight as task chips, and a quiet separator should distinguish filtering from task selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The folded and expanded Backlog task bar use a 28px outer radius
- [x] #2 Every visible status filter is the same rendered height as a task chip
- [x] #3 A vertical separator appears between the status filters and task strip in the expanded bar
- [x] #4 Filtering, expansion, scrolling, task selection and hover behavior remain unchanged
- [x] #5 Browser QA verifies the expanded composition in light and dark themes
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
1. Restore the task bar's existing 28px outer pill radius and update the web-view contract.
2. Give status filters the task-chip height and reuse the existing divider between status filters and the task strip.
3. Verify folded and expanded light/dark states and filter, task, hover and scroll behavior; run focused and full checks, then complete required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restored the task bar's 28px outer radius, set status filters and task chips through one shared 38px height rule, and reused the existing divider node between status filters and the task strip. Browser QA at 1280x720 measured 28px folded/expanded radii, 38px filters and chips, and verified separator order, filtering, a 6,051px horizontally scrollable strip, hover tooltip, task selection, light/dark themes and clean console. Focused checks pass (11 tests), typecheck passes and diff whitespace is clean.

Full bun run check passes with 93 Node and 177 viewer tests.

Cold simplicity and full-context architecture reviews passed with no findings. Both recommend the current domain-local implementation: one island-specific radius, one shared status/task height rule, and one reused divider node, with no new abstraction or decorative tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the Backlog bar's 28px pill radius, matched status filters to 38px task chips, and separated filters from tasks with the existing divider. Verified light/dark composition, filtering, scrolling, hover, task selection, clean console, focused checks, full 93/177 suites, and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
