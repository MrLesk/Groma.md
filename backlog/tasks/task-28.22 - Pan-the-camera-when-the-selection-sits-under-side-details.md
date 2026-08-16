---
id: TASK-28.22
title: Pan the camera when the selection sits under side details
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 10:03'
updated_date: '2026-08-16 10:14'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With side details open, arrowing to an item that lies under the panel leaves it hidden: the pan-to-keep-visible logic treats the full viewport as visible even though the panel overlays its right side. Moving right from Core to Architecture workspace at Containers selects a card the architect cannot see. The camera should pan just enough that the selected item sits clear of the panel, without zooming or reflowing the world.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At Containers with side details open, moving right from Core to Architecture workspace pans the camera so the Architecture workspace card is fully visible left of the details panel
- [x] #2 While side details are open the pan only moves the camera; zoom and card sizes stay the same
- [x] #3 With the panel closed, arrow moves keep the selection within the full viewport exactly as before
- [x] #4 Headless viewer tests and an agent-tty 120x36 walkthrough cover the panel-open arrow move
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
1. Add an optional coveredFromX option to ProjectionOptions: the screen column where a right-side overlay begins. In projectWorld, shrink only the viewport passed to panCells so it ends one cell before that column (the same one-cell margin viewportFor leaves at screen edges, keeping the selection ring visible); transform, fit zoom, and scale never change.
2. In terminal-viewer project(), when state.panel is side, pass detailsBounds(width, height, 'side').x as coveredFromX so the panel geometry has one source of truth.
3. Add a headless test: the covered projection overlaps the panel, the coveredFromX projection lands the workspace clear of it at unchanged zoom, and an enter/left/right walkthrough pans the map and returns to an identical frame.
4. Verify with agent-tty at 120x36 and 200x60: open details, arrow right from Core, confirm the workspace boundary and its ring sit left of the panel.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ProjectionOptions gained coveredFromX: the screen column where a right-side overlay begins. projectWorld shrinks only the pan-to-keep-visible viewport to end one cell before that column (the same one-cell margin viewportFor leaves at screen edges, so the selection ring stays visible); transform, fit zoom, and scale are untouched. terminal-viewer passes detailsBounds(width, height, 'side').x whenever the side panel is open, keeping panel geometry in one place. Verified: bun run check (52 node + 16 viewer tests, including a new test covering the covered projection, the pan, unchanged zoom, and the enter/left/right walkthrough); agent-tty at 120x36 and 200x60 shows the Architecture workspace boundary and its selection ring landing one column left of the panel after arrowing right from Core.

Cold simplicity review confirmed the flow and raised two optional cleanups, both applied: dropped the unreachable Math.min clamp in uncoveredViewport and extracted a byId helper in the new test. bun run check passes after the cleanups (52 node + 16 viewer tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
With side details open, the camera now pans the selection clear of the panel instead of leaving it hidden underneath. ProjectionOptions gained coveredFromX (the column where the overlay begins); projectWorld shrinks only the pan-to-keep-visible viewport to end one cell before it, preserving the selection ring margin, and terminal-viewer passes detailsBounds(...).x while the side panel is open. Zoom, scale, and closed-panel behavior are untouched. Verified with a new headless viewer test (covered vs panned projection, unchanged zoom, enter/left/right frame walkthrough), the full bun run check suite (52 node + 16 viewer tests), and agent-tty walkthroughs at 120x36 and 200x60 showing the Architecture workspace boundary landing one column left of the panel after arrowing right from Core.
<!-- SECTION:FINAL_SUMMARY:END -->
