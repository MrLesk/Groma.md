---
id: TASK-250
title: Share header popup behavior
status: Done
assignee:
  - codex
created_date: '2026-09-05 14:46'
updated_date: '2026-09-05 15:23'
labels: []
dependencies: []
references:
  - web-shell
  - popover
  - control
  - revision-history
modified_files:
  - src/viewers/web/atoms/popover.ts
  - src/viewers/web/atoms/chrome.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/chrome/theme-control.ts
  - src/viewers/web/search/control.ts
  - src/viewers/web/revision/control.ts
  - docs/viewers/web/index.md
  - groma/systems/groma/containers/web-viewer/components/popover.md
ordinal: 289000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses a Web header popup, its trigger shows a pointer cursor and clicking outside dismisses it. Help, Credits, Theme, Revision and Search share the existing popup surface and one dismissal implementation instead of separate outside-click handlers. Search dismissal restores its saved view; clicking the revision tooltip counts as inside its popup. This replaces duplicated header behavior and fixes the missing Help dismissal and summary cursor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help and Credits show a pointer cursor; all header popup triggers use the shared control affordance.
- [x] #2 Help, Credits, Theme and Revision close on outside pointer clicks and remain open for clicks inside their content or owned tooltip.
- [x] #3 Search uses the same dismissal primitive while preserving cancel restoration and explicit result acceptance.
- [x] #4 Header popup dismissal has one implementation; duplicate per-control outside-click handlers are removed.
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
1. Extend the existing popup atom with one outside-pointer dismissal binding. Native details popups use its default close action; Search supplies its cancel action and Revision supplies its tooltip as an owned surface. 2. Replace the Theme, Revision, Credits and Search dismissal listeners and bind Help through the same atom. Put cursor:pointer on the shared chrome-button class. 3. Verify each popup inside/outside click, cross-popup clicks, revision tooltip and search cancel in the browser; run bun run check, review scope/simplicity/quality, and obtain the final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extended the existing popup atom with one dismissal implementation and replaced the Theme, Revision, Credits and Search document listeners. Help uses the same binding. Native details keep their built-in opening/closing; Search supplies cancellation, and Revision passes its existing tooltip node as an owned surface. Shared chrome-button now owns cursor:pointer. No new files, dependencies, popup state or duplicated event logic. Documentation and Popover architecture updated.

Browser verification: all four summary triggers compute cursor:pointer. Help and Credits remain open on content clicks and close outside; Theme and Revision close when another header control is clicked. Search preview moved the camera, and clicking Help restored its exact saved transform and selection. A result click still accepts the task. The visible Revision tooltip was clicked: Revision and tooltip stayed open; clicking Help then closed Revision and hid the tooltip. Full bun run check passes: lint/types, 104 Node tests and 291 viewer tests. Log: /private/tmp/task250-check.log. Self simplicity/specification/quality reviews found no supported-flow defects. Final full-context reviewer found the shared atom clear and minimal; its remaining tooltip verification was completed. Separate preview on localhost:60593 was used without stopping the existing preview.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared header popup dismissal through the existing popup atom and fixed pointer cursors through the common button style. Help, Credits, Theme, Revision and Search use the same outside-click rule, preserving search restoration and Revision tooltip ownership. Browser checks and the full bun run check pass; complexity review found no material changes needed.
<!-- SECTION:FINAL_SUMMARY:END -->
