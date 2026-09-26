---
id: TASK-528
title: Finish live map updates while orbiting Layers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-26 15:37'
updated_date: '2026-09-26 15:42'
labels: []
dependencies: []
references:
  - presentation
modified_files:
  - test-bun/web-map-animator.test.ts
  - src/viewers/web/iso/view-motion/presentation.ts
priority: medium
type: bug
ordinal: 613000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dragging in Layers mode cancels the animation frame loop while a live layout transition remains active. The map can stay between its old and new layouts indefinitely.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Orbiting during a live sheet transition allows the displayed sheet to reach the new layout and end the transition.
- [x] #2 Orbit input still changes the Layers pose and schedules repainting without a world update.
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
1. Preserve the existing animator loop while a sheet update remains active; orbit still cancels the pose transition. 2. Add a focused animator scheduling test in its own test file, following the browser-frame stubs used by web-camera-layer.test.ts. Each animator owns its timers and motion. Test authority: the reproduced Layers drag freeze and TASK-481 smooth live updates. Wrong result: orbit leaves a half-updated sheet with no finishing frame. Existing sheet-morph tests only step pure motion directly, so they cannot catch a cancelled scheduler. Verify a partly advanced update reaches its destination after orbit, and plain orbit still repaints. 3. Prove the test fails before the fix, run focused motion/camera tests, then bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and self-review: orbit still changes the layer pose and ends its entrance transition; createMapAnimator stops the frame loop only when no sheet update remains. The scheduling regression failed before the fix with width about 37.5 instead of the destination 40, then passed with the destination reached and morphing false. A second case verifies ordinary orbit repainting. Focused animator, sheet morph and camera checks: 19 passed. Tests own their motion/timers and follow the existing parallel browser stub pattern. Existing live-update behavior is restored; no public contract changes. No blocking specification or quality finding.

Final validation: bun run check passed (16 Node tests, 750 Bun tests, 48 skipped, zero failures); git diff --check passed. The shared checkout also contains ongoing TASK-480 changes, which were preserved. Self specification and quality reviews are complete for this fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Layer orbiting preserves the animation loop while a live sheet update is active, allowing it to reach its destination. The scheduling regression failed before the fix and passes afterward, and plain orbit still repaints. All 19 focused motion and camera tests passed. Repository check passed with 16 Node tests and 750 Bun tests; 48 skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
