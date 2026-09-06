---
id: TASK-70
title: Go back from Enter with Backspace
status: Done
assignee: []
created_date: '2026-08-16 20:30'
updated_date: '2026-08-16 20:38'
labels: []
dependencies: []
references:
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enter opens a system or container, or focuses details on a leaf. There is no reverse key, so after opening an item to inspect it the architect cannot return to the previous selection without spatial arrows. Backspace is the reverse of Enter: leave the current C4 level to the parent that Enter came from, and if details is focused return to the map as well. Esc still only leaves a side pane and does not change selection. Filter Backspace still deletes a character.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backspace after Enter on a system or container restores that parent selection
- [x] #2 Backspace from an item's details returns to the map and to the parent Enter came from
- [x] #3 Esc still only leaves a side pane and does not change the selection
- [x] #4 Tests use a fixture world, not live groma/
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
1. Bind Backspace to leave outside the filter.
2. leave always applies leaveView and returns focus to the map.
3. Footer and TUI docs name Backspace as the reverse of Enter.
4. Fixture-test container/component leave, details leave, and Esc unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backspace maps to leave outside the filter. leave always runs leaveView and returns focus to the map. Esc stays dismiss-only. Filter Backspace still deletes.

Fixture: Enter system then leave restores alpha; Enter container then leave restores cleft; details on pleft, dismiss keeps pleft, leave goes to cleft on the map. bun test test-bun/ 46/46.

Simplicity accept-as-is. Spec and quality: pass, no blockers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Backspace is the reverse of Enter: it leaves the opened item for the parent and returns to the map if details is open. Esc still only leaves a pane. Verified with fixture navigation tests; viewer suite 46/46.
<!-- SECTION:FINAL_SUMMARY:END -->
