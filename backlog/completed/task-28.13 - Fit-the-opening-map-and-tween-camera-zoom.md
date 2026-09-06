---
id: TASK-28.13
title: Fit the opening map and tween camera zoom
status: Done
assignee:
  - grok
created_date: '2026-08-15 20:13'
updated_date: '2026-08-15 20:32'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - src/viewers/tui/terminal-viewer.ts
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect opens groma view, the whole System Context map fits on screen so people, Groma, and Git are all visible. On the map, + and - zoom the camera in steps with the spike's 750ms log-zoom tween. They do not change C4 level. z and Enter still change level. Minimum zoom fits the world. Maximum zoom is one world unit per cell so names stay readable. Arrowing still pans just enough. Level changes keep the current zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The first System Context frame shows people, Groma, and Git together
- [x] #2 On the map, + and = zoom in and - and _ zoom out without changing C4 level
- [x] #3 Camera zoom tweens for 750ms in log space with ease-in-out cubic; resize snaps
- [x] #4 Minimum zoom fits the world; maximum zoom is 1 so on-screen names stay readable
- [x] #5 z footer plus and Enter still change C4 level; map plus does not
- [x] #6 Arrowing pans just enough; entering or leaving a level keeps camera zoom
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
1. Port the spike camera (center + zoom, 750ms log tween, ease-in-out cubic, snap on resize) into `src/viewers/tui/camera.ts`. Project with that camera: default rest is `fitView` of the world; max zoom is 1; pan still nudges just enough when the selection would leave the view.
2. On the map, `+`/`=` and `-`/`_` tween zoom and do not change C4 level. Footer `z` plus and Enter still enter/leave. Keep zoom across level changes. Size titled cards to the full name only when the projected box is large enough.
3. Update TUI docs, AGENTS.md map rules, and viewer tests: opening frame shows people + Groma + Git; plus stays on System Context; zoom 1 still has readable Core names; wait for the tween to settle in headless tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Live camera is createCamera, seeded from fitView or a test camera. Map +/- tween zoom (step 1.25, 750ms log, ease-in-out cubic). Footer z plus and Enter still change C4 level. Resize and reload snap. Titled cards use the full name only when the projected box is large enough.

Simplicity: dropped WorldProjection.scale, ViewerState.camera, and the first-paint placed/dummy camera. zoomBy reads rest zoom from fitView.

Verification: bun test test-bun/terminal-viewer.test.ts 12/12; bun run check (tsc 7.0.2, architecture, 52 Node, 12 viewer). agent-tty 120x36: start shows people, SYSTEM · Groma, and Git; + stays on System Context and Groma grows (title bar 49 → 68); Enter opens Containers · Groma at that zoom; - zooms out still on Containers; resize 200x60 snaps.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view now opens fitted to the whole System Context map. On the map, + and - zoom the camera with a 750ms log tween; z and Enter still change C4 level. Closest zoom is one cell per world unit so names stay readable. Verified with viewer tests and an agent-tty 120x36 walkthrough.
<!-- SECTION:FINAL_SUMMARY:END -->
