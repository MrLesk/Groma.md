---
id: TASK-34.5
title: Jump anywhere with a / filter in the footer
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 11:17'
updated_date: '2026-08-16 12:26'
labels: []
dependencies:
  - TASK-34.4
parent_task_id: TASK-34
priority: high
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
/ turns the footer into a filter input over element names in the merged world. Typing narrows matches; the footer shows the match position and current match name; the selection and camera follow the current match live. Enter keeps the selection and closes the filter; Esc restores the selection and camera from before the filter opened.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 / opens the filter in the footer and typing filters merged-world element names
- [x] #2 The current match drives selection and camera live, with match position and name shown in the footer
- [x] #3 Enter accepts the match; Esc cancels and restores the prior selection and camera
- [x] #4 The filter works with side panes collapsed
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
1. navigation.ts: ViewerState.filter { query, index, before {level, currentId} }; filterMatches(world, query) as case-insensitive name substring over the merged world; reduceFilter(world, state, input) handling open, char, delete, next, previous, accept, cancel; the current match drives selection through the shared sync; cancel restores the before view.
2. terminal-viewer.ts: / opens the filter and snapshots the camera; while active, printable keys, backspace, arrows, Enter, Esc route to reduceFilter; camera follows matches via the existing followSelection and restores on cancel.
3. paint.ts/chrome.ts: while the filter is active the footer hint line is replaced by the filter line with query, match position, and current match name.
4. Logic tests for matching and the reducer flow; docs update.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity review applied: dead index clamps removed (the reducer owns the invariant), the capture/follow/repaint sequence extracted into one transition helper shared by actions and filter input, plain filter pass-through in paint. Verified live with agent-tty: '/wor' shows '1 of 2 · Architecture workspace' with live selection and camera, Down cycles to World layout at components, Enter keeps it, Esc restores the pre-filter Groma view and camera. Logic tests cover matching, live follow, cycling, narrowing to nothing, cancel restore, and accept.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
/ opens a footer filter over merged-world element names: reduceFilter holds query, match index, and the pre-filter view; the current match drives selection and camera live through the shared sync and framing; Enter accepts, Esc restores selection and the saved camera; the footer hint line becomes the filter line while open. Verified by logic tests (21 pass) and a live agent-tty session.
<!-- SECTION:FINAL_SUMMARY:END -->
