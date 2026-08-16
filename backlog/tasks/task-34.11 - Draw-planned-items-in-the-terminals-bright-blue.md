---
id: TASK-34.11
title: Draw planned items in the terminal's bright blue
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:55'
updated_date: '2026-08-16 12:56'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: bug
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Planned ghosts render in the terminal's dark ANSI blue (slot 4), which is barely readable on dark backgrounds. Planned now uses the terminal's bright blue (slot 12), so it stays derived from the user's own terminal theme rather than a hardcoded color, and reads clearly in the tree, on the map, and in details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Planned elements render in the terminal palette's bright blue everywhere the planned color is used
- [x] #2 All viewer colors keep deriving from the terminal palette; no hardcoded RGB values are introduced
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. atoms/theme.ts: planned = palette[12] instead of palette[4].
2. Update the visual-language test's planned-color anchor; live agent-tty screenshot with the Scan reconciler ghost visible.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review: no findings. Verified with an agent-tty screenshot: the Scan reconciler ghost reads clearly in bright blue in the tree; typecheck and the 21 viewer tests pass. The color still derives from the terminal palette (slot 12), so user themes carry through.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Planned elements now use the terminal palette's bright blue (ANSI slot 12) instead of the barely readable dark blue, changed once in the theme so the tree, map, and details all follow; colors remain fully derived from the user's terminal theme. Verified by the visual-language test anchor and a live screenshot.
<!-- SECTION:FINAL_SUMMARY:END -->
