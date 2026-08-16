---
id: TASK-68
title: Pick a person action then inspect its path on the map
status: Done
assignee: []
created_date: '2026-08-16 20:01'
updated_date: '2026-08-16 20:13'
labels: []
dependencies: []
references:
  - src/viewers/action-path.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/organisms/chrome.ts
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect opens a person, uses Up and Down to choose one command, then leaves that person and walks the map to inspect the boxes the command touches. The path lights as soon as the command is chosen. Esc only returns from a side pane. The path stays until x or a different person-command is chosen. Space does not cycle or pin. Camera zoom and C4 enter stay available after the person is closed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Up and Down on a person's details choose one action and light its path immediately
- [x] #2 Esc and leaving the person keep the path; map arrows, Enter, and zoom still work
- [x] #3 Up and Down on a non-person do not change the active action
- [x] #4 x clears the path; choosing another person action replaces it
- [x] #5 Tests use a fixture world, not live groma/
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
1. Replace pinnedIds and actionCursor with one activeActionId.
2. Person details Up/Down set that id; other details only scroll; Esc/dismiss does not clear it.
3. Paint the walk of that one id; keep the current selection readable; footer names the action and x.
4. Drop Space pin. x clears. Docs match.
5. Fixture-test pick, persist across leave and map moves, non-person scroll, replace, and clear.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
One activeActionId. Person details Up/Down pick it and the path paints immediately. Esc/Left/map moves do not clear it. Non-person details only scroll. x clears. Space is unbound. Path is the outgoing walk plus people who use the start. Current map selection stays undimmed.

Fixture tests: buyer Down sets buyer-api then buyer-web; Left and dismiss keep it; api Down scrolls and keeps buyer-web; Up replaces; x clears. actionPath covers the walk, person inbound edges, missing id. bun test test-bun/ 43/43.

Simplicity: inlined walkAction, dropped empty-path shortcut and refresh scrub. Spec and quality: pass, no blockers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A person action is chosen with Up/Down and stays on the map after Esc. Inspect boxes with the usual keys; x clears or another pick replaces. Space no longer pins. Verified with fixture navigation and path tests; viewer suite 43/43.
<!-- SECTION:FINAL_SUMMARY:END -->
