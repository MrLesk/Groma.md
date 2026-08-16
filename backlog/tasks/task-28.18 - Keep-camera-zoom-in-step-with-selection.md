---
id: TASK-28.18
title: Keep camera zoom in step with selection
status: Done
assignee:
  - grok
created_date: '2026-08-15 21:09'
updated_date: '2026-08-15 21:11'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - src/viewers/tui/terminal-viewer.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Camera zoom and the selected item should stay together. Selecting a container or component tweens the camera to fit it. Moving from a component to a sibling container zooms out to frame that container. System Context still shows the whole map and only pans to keep a selection on screen. Manual plus and minus still step-zoom until the next selection change that needs a new frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a container or component tweens the camera to fit that item
- [x] #2 Moving from a component to a sibling container zooms out to frame that container
- [x] #3 System Context keeps the whole map in view and pans just enough for an off-screen selection
- [x] #4 Viewer tests cover a component-to-sibling-container move and selection framing
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
1. Add followSelection: fit the selected item; when the C4 level goes up, never zoom in (min of current zoom and the fit).
2. After any viewer state change that moves selection or level, tween to that camera. Context-only selection changes still only pan.
3. Update TUI docs, AGENTS.md, and tests for World layout right to Architecture workspace plus a zoom-out when the sibling is larger.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold simplicity: one followSelection after reduceViewer. Fit the selected item; when C4 level goes up, zoom is min(current, fit) so a component-to-container move zooms out. Context selection still only pans.

Verification: bun test 15/15; bun run check. World layout Right becomes Containers · Architecture workspace. followSelection to Core from a component fit has a lower zoom. Context pan-just-enough test still passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selection now drives the camera: containers and components tween to fit the selected item, and moving from a component to a sibling container zooms out. System Context still fits the whole map and pans just enough. Verified by the sibling-container camera test and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
