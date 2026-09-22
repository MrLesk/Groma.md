---
id: TASK-490
title: Follow a growing map to the end of a world update
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 21:42'
updated_date: '2026-09-22 21:53'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/render.ts
ordinal: 571000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a world update glides the map, a camera nobody moved should follow the blended map. It ended each glide by refitting the selected architecture instead, and the system is selected by default, so the camera snapped in on the last frame. On a map that grows a lot, the camera also eased toward a fit that was itself easing, so the map overflowed the view mid-glide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a world update glides, a camera nobody moved ends on the fit of the whole map without a jump, also while an architecture is selected
- [x] #2 During the glide the whole blended map stays inside the view
- [x] #3 render.ts stays at or under 500 lines; bun run check passes
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
1. In repaintScene, keep a world update's last blended frame on the follow branch with a following flag set from mapMotion.morphing after every repaint.
2. On that branch, set a camera nobody moved to the fit of the blended map on every frame (camera.frame(fitted, 1)) instead of easing toward an easing fit.
3. Keep render.ts at or under 500 lines; verify in a browser with the system selected and a map that grows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause: render.ts repaintScene ran the mode-transition fit on the last frame of a world update. The motion stops morphing before that frame's repaint, so the frame fell through to fitArchitecture(selected architecture), and the system is selected by default. During the glide the camera also eased toward the fit of an easing blend (camera.frame(fitted, framing) with framing on the same ease), so a map that grows a lot overflowed the view mid-glide.

Fix: a following flag, set after every repaint from mapMotion.morphing, keeps the last blended frame on the follow branch, and the follow branch sets the camera to the blend's fit on every frame (camera.frame(fitted, 1)). render.ts stays at 500 lines. The documented behavior in docs/viewers/web/index.md (a camera nobody has moved follows the changing sheet on the same clock) is unchanged.

Verified: in a browser on the working tree, a raw demo scan with the system selected (?system=order-service) received the curated architecture in one update; the system island's on-screen width eased 242, 229, 236 ... 241 px and held at 241 to the end, with no jump. Before the fix, frame-by-frame footage of the same update showed a zoom-in on the last frame and the map spilling out of the view mid-glide. Typecheck passes, biome reports nothing for render.ts, and the morph, layer, presentation and camera tests pass. The full bun suite still has 4 failures in sheet routing and Vue scanning that belong to other sessions (TASK-482, TASK-487).

Final validation: bun run check passes on the last commit plus only this task's and TASK-488's changes in a separate clone (677 pass, 0 fail). Browser check on the working tree during a raw-to-curated update that grows the sheet 2.5 times: the whole map stayed inside the map pane on all 76 samples of the glide, and with the system selected the island's width held without a jump at the end.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A world update's glide now ends where it was heading. A camera nobody moved tracks the fit of the blended map on every frame, through the last one, instead of refitting the selected architecture on the final frame (a snap onto the default system selection) or easing behind a map that grows (which overflowed the view). Three lines in render.ts, which stays at 500. Verified in a browser with the system selected on a map that grows 2.5 times, and with an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
