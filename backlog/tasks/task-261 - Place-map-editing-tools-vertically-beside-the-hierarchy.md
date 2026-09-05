---
id: TASK-261
title: Place map editing tools vertically beside the hierarchy
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:36'
updated_date: '2026-09-05 17:40'
labels: []
dependencies: []
references:
  - web-viewer-authoring
modified_files:
  - src/viewers/web/editing/gestures.ts
ordinal: 300000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses the live Web map, the System, Container, Component, Group and Connect controls form a vertical strip on the map side of the hierarchy near its top. The toolbar follows the hierarchy edge when collapsed, remains independent of the details pane, and leaves the Backlog task area clear. This implements the agreed placement after the bottom toolbar overlapped Backlog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The editing toolbar is vertical beside the right edge of the hierarchy, near the top, in both expanded and collapsed hierarchy states.
- [x] #2 Backlog remains visible and usable at the bottom, and opening or closing details does not move the toolbar.
- [x] #3 Existing creation, grouping and connection controls remain usable in their new position.
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
1. Reuse the existing hierarchy inset to position the vertical toolbar and its error message. 2. Verify toolbar placement, hierarchy collapse, details toggle, Backlog and existing controls in the browser. 3. Run the repository check and required reviews, then commit and push only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification on the real repository confirms the toolbar is vertical, aligned with the hierarchy top and separated by 12px in both expanded and collapsed states. Closing details leaves its x position unchanged. Backlog expands at the bottom and remains fully separate. Group/Connect activate normally; dragging System opens its creation dialog and Cancel closes it without a write. Invalid Component drop shows its existing error within the toolbar. Cold simplicity review passed with no findings. Implementer specification/quality review found no blocker: shell owns the existing inset, editor owns controls and feedback, and gesture operations are unchanged. Full bun run check passed: 104 Node and 301 Bun tests, with lint and TypeScript passing.

Full-context complexity review passed with no material recommendations. The existing shared hierarchy inset is the only placement input, and toolbar feedback remains in the editor domain. No public contract or documentation change is required for this placement correction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Placed the existing map editing tools in a vertical strip beside the hierarchy, following its expanded or collapsed edge and leaving Backlog clear. Feedback follows the toolbar. Verified placement, details independence, Backlog expansion, tool activation and creation/Cancel in the browser. Both separate reviews passed. Full bun run check passed: 104 Node and 301 Bun tests, lint and TypeScript.
<!-- SECTION:FINAL_SUMMARY:END -->
