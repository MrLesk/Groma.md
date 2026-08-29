---
id: TASK-207
title: Animate details pane collapse after Back
status: Done
assignee:
  - '@codex'
created_date: '2026-08-29 10:45'
updated_date: '2026-08-29 10:50'
labels: []
dependencies: []
references:
  - page
  - motion
modified_files:
  - src/viewers/web/page.ts
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer leaves an expanded source or task-diff file with Back in the Web viewer, the details pane returns to its normal width through the existing motion system instead of snapping smaller.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing Back from an expanded source or task-diff file returns the details pane to its normal width
- [x] #2 The width reduction is visibly animated with the existing Web motion timing and respects reduced-motion preferences
- [x] #3 The selected component or task remains selected after Back
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
1. Extend the existing details-pane chrome transition to animate width using the shared motion duration and easing. 2. Verify source and task-diff Back flows return from 640 px to the normal details width without changing selection. 3. Run the focused rendered interaction check and the repository check, then review the final diff for task isolation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the collapse by adding width to the existing #details chrome transition. The same rule covers source and task-diff file views and the existing reduced-motion selector already disables it.

Browser QA at http://127.0.0.1:4871/?task=TASK-207 measured 640 px before Back, 472.49 px at 50 ms, 421.10 px at 130 ms, and 409.59 px at 280 ms. The task URL and heading remained selected; reduced-motion emulation computed transition: none; console warnings/errors were empty.

Focused task-diff/web-page tests pass (4 tests) and the previously timed-out live-reload test passes alone. The complete repository check is blocked by six unrelated iso-map assertions from concurrent shared-workspace changes; its seventh failure was the live-reload timeout that passed in isolation.

Cold simplicity review passed: Back clears only file state; each file domain removes its expanded-width class; shared details chrome owns the width transition. No deletion, extraction, test, or follow-up is justified. The reviewer would choose the same approach because one rule covers both domains and minimizes timing drift and junior-developer mistakes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added width to the shared details-pane chrome transition, so Back from either source or task-diff files animates from the 640 px file view to the normal pane width without changing selection. Browser measurements captured 640 → 472.49 → 421.10 → 409.59 px over the existing 260 ms timing; reduced-motion computed transition none, the URL and task heading stayed selected, console output was clean, and focused tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->
