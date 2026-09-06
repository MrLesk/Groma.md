---
id: TASK-160
title: Align the Backlog task bar radius with floating chrome
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 20:40'
updated_date: '2026-08-23 20:44'
labels: []
dependencies: []
references:
  - web-viewer
modified_files:
  - src/viewers/web/work/island.ts
  - docs/viewers/web/index.md
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect views Backlog work on the web map, the folded and expanded task bar should use the same corner language as the floating hierarchy and inspector instead of reading as a separate pill-shaped system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The expanded Backlog task bar uses the same corner radius as the floating sidebars
- [x] #2 The folded task bar remains compact but uses a related, less pill-like radius
- [x] #3 Task filtering, expansion, scrolling, selection and hover behavior remain unchanged
- [x] #4 Browser QA verifies folded and expanded states in light and dark themes
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
1. Replace the task bar's isolated pill radius with the existing floating-chrome radius token.
2. Keep folded and expanded markup, state, and interactions unchanged; update stale pill wording in the web-view contract.
3. Verify folded and expanded states in light and dark themes, run focused and full checks, then complete the required simplicity and architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation uses the existing --chrome-radius token directly on #work, replacing the isolated 28px pill radius without adding selectors, state or components. Updated the web-view contract to describe the shared corner language. Focused checks pass (11 tests), typecheck passes, full bun run check passes (93 Node and 176 viewer tests). Browser QA at 1280x720 measured #work and #hierarchy at 10px in folded/expanded light/dark states; expansion, task selection, details, theme switching and console health passed.

Cold simplicity and full-context architecture reviews both passed with no findings. Reviewers confirmed one shared token is simpler and safer than a folded-state selector or second radius token, keeps task-bar code in its domain, and minimizes junior-developer drift. Browser hover verification showed the selected chip tooltip unchanged.

After rebasing onto TASK-157 and TASK-158, the full check passes again with 93 Node and 177 viewer tests; neither landed task overlaps TASK-160 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned the folded and expanded Backlog task bar with the floating shell by reusing the existing 10px chrome radius and removing stale pill wording. Verified all four light/dark and folded/expanded states, expansion, task selection, details, theme switching, hover, console health, focused tests, typecheck, the rebased full 93/177 test suites, and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
