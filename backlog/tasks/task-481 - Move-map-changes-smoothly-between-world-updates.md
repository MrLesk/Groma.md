---
id: TASK-481
title: Move map changes smoothly between world updates
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-22 05:47'
updated_date: '2026-09-22 20:29'
labels: []
dependencies: []
references:
  - presentation
  - render
  - camera
  - shell
modified_files:
  - docs/viewers/web/index.md
ordinal: 562000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the world changes (a save, a timelapse step, another revision), the sheet is swapped and repainted, so islands, slabs and buildings jump to their new places. The map should blend from the displayed sheet to the new one the way the Iso to Layers move blends poses: shared elements glide, new ones grow out of the ground, departed ones shrink away, routes draw on and retract, and the camera follows the growing sheet on the same clock. Updates that arrive faster than a transition are followed at their own pace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A world update blends the displayed sheet into the new one over a short transition instead of repainting it in place
- [ ] #2 Elements only in the new sheet grow from their centre and elements only in the old sheet shrink away; shared elements and routes keep their identity
- [ ] #3 A hand-positioned camera stays where it is during the blend; an untouched camera follows the changing sheet on the same clock
- [ ] #4 Reduced motion and very large maps apply the update at once
- [ ] #5 Focused tests cover the blend and the motion state; bun run check passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: src/viewers/web/iso/morph.ts holds the pure blend, tweenSheet(from, to, amount). It matches islands and zones by key, slabs and buildings by representationId, routes by id. Shared items interpolate their cell rects (cells project linearly, so screen motion is straight); buildings also interpolate height and per-floor footprints when the floor count matches, and switch names and floors at the midpoint otherwise. Items only in the new sheet grow from their centre from 2% size; items only in the old one shrink to 2% and vanish at the end. Surfaces keep their label band (labelBand of ISLAND_FONT, GROUP_FONT, CONTAINER_FONT) while growing, so the body never gets a negative depth. A growing building shows a blank roof line below half size: an empty lines array makes roofBlock infinite for round and pill shapes. Routes present in both sheets are resampled at the union of their corner fractions and blended point by point; routes only in one sheet are drawn on from their source or retracted into it (drawnPath). The frame rect jumps when the old or the new sheet has no islands, so the empty map's plate does not rewrap letter by letter.

Motion: createMapMotion(initial) in presentation.ts now owns the displayed sheet. retarget(sheet, now, animate) starts a 700 ms blend (MORPH_DURATION_MS) from whatever is displayed; while a blend runs, a new update takes the observed interval since the last retarget, clamped to 160 ms (MORPH_FASTEST_MS). No blend for reduced motion, for a placement equal to the shown one (sameSheet compares JSON), or above 500 buildings plus slabs (MORPH_LIMIT). step() advances the pose transition and the sheet blend; framing follows the blend's eased progress. createMapAnimator gained retarget(sheet), which schedules frames without painting: applyWorld in render.ts paints the first frame itself as before.

render.ts: projectedScene presents mapMotion.sheet; applyWorld calls mapAnimator.retarget before painting and, when a blend runs, camera.frame(fitted, 0) instead of camera.move(fitted) so the camera follows the growing sheet on the same clock from where it is; repaintScene skips camera framing during a blend when the viewer positioned the camera (touched). The viewport measurement moved to shell.ts measureFrame to keep render.ts under 500 lines.

Verified: bun run check passed (696 tests); test-bun/web-sheet-morph.test.ts covers the blend ends, gliding, growing and shrinking, route drawing and corner matching, a real placement from nothing (finite geometry), the motion timing, the fast-update clamp, reduced motion and the unchanged shortcut. Watched in the browser through the two Slidev decks' timelapse (300 ms and 700 ms per commit) and filmed frame by frame with the video rig.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-22 20:29
---
TASK-484 coordination (touch pinch): I change only the gesture sentence under What you can do in docs/viewers/web/index.md. Your paragraphs stay untouched. Please stage only TASK-481 hunks in that file.
---
<!-- COMMENTS:END -->
