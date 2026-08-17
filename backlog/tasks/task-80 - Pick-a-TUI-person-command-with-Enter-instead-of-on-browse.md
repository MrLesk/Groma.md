---
id: TASK-80
title: Pick a TUI person command with Enter instead of on browse
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 18:35'
updated_date: '2026-08-17 18:40'
labels: []
dependencies: []
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback: in the TUI details pane, moving over an action with up and down immediately lights its path - browsing is activating. Split the two: up and down move an action cursor through the person commands, Enter picks the row under the cursor (setting the active action and lighting its path on the map), and x still clears. The details pane shows the cursor row with the selection bar and renders the active command row in the accent so cursor and lit command are distinguishable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Moving up and down in the details pane moves a cursor through the person commands without changing the lit path
- [x] #2 Enter on a cursor row picks that command: the map lights its path and the details row renders in the accent; x still clears
- [x] #3 The footer hint names the pick key while browsing commands; behavior elsewhere is unchanged and bun test passes
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
1. Add actionCursor to ViewerState; in details focus, up/down move the cursor over pickableActions, Enter sets activeActionId from the cursor, left leaves; entering details focus seeds the cursor from the active action.
2. details.ts: the cursor row carries the selection bar and drives auto-scroll; the active action row renders its spans in the accent; thread actionCursor through drawDetails and paint.ts from viewer state.
3. chrome.ts: name the pick key in the browsing hint.
4. Rewrite the navigation test that pins activate-on-browse; verify interactively with agent-tty; bunx tsc; bun test; cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split browsing from picking: ViewerState gained actionCursor; in details focus up/down move the cursor over pickableActions (scroll fallback unchanged when there are none), Enter copies a validated cursor to activeActionId, and entering details focus seeds the cursor from the active action via a shared enterDetails helper. The details pane draws the selection bar and auto-scroll from the cursor row and renders the picked command in accent bold; the footer hint now reads 'enter pick'. Verified interactively with agent-tty color screenshots: Down moved the cursor with the map fully unlit, Enter lit the path and turned the picked row green with 'x clear' appearing, matching the map accent. The pinned navigation test rewritten to assert browse-does-not-light, enter-picks, and the scroll fallback. Cold simplicity review: optional-only findings; the details-entry dedupe applied. bunx tsc clean; bun test 144 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TUI person commands are now picked with Enter: up/down browse an action cursor without lighting anything, Enter activates the command under the cursor, x clears; the cursor row carries the bar, the picked row renders in the accent, and the footer names the pick key. Verified with agent-tty screenshots before and after picking, bunx tsc, and bun test (144 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
