---
id: TASK-28.20
title: Keep same-level arrows from zooming in
status: Done
assignee:
  - grok
created_date: '2026-08-15 21:48'
updated_date: '2026-08-15 22:05'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - src/spikes/groma-tui/DESIGN.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The OpenTUI spike DESIGN.md says same-level arrows pan just enough and do not move the camera otherwise. Leaving a boundary (no same-level peer in that direction) zooms out. Enter frames the deeper level. After Enter onto a component, moving to a sibling currently tweens a zoom-in because the camera fits each component. Restore the spike rule: lateral moves keep zoom; zoom out only on escape to an outer level. At Components the camera frames the parent container, not each component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Same-level arrowing does not change camera zoom; it pans only if the selection would leave the screen
- [x] #2 When there is no same-level peer in that direction, selection escapes and the camera zooms out
- [x] #3 Enter to Components frames the parent container, not the child component
- [x] #4 Viewer tests cover same-level arrows keeping zoom and escape zooming out
- [x] #5 At Containers the camera frames the parent system, so escape to a sibling container zooms out to that system rather than into the sibling
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
1. Camera frames the containing box of the C4 level, not the selected child: parent system at Containers, parent container at Components.
2. followSelection tweens only when C4 level changes. Same-level arrows return undefined so projectWorld can pan just enough.
3. Escape zoom-out uses that level frame (never a close-up of the outer sibling).
4. Start the camera tween before the unlocked pan repaint so the first frame is not a jump.
5. Tests: same-level followSelection is undefined; sibling containers share the system fit; Enter to Components shares the container fit; escape zooms out.
6. Try the path in groma view: Enter Groma, Right Core, Enter, Right World layout (map still), Right (zoom out to Groma with Architecture workspace selected).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tried the live path as a user (agent-tty 120x36). Same-level Architecture model → World layout already kept the Core frame. Escape Right to Architecture workspace was the failure: the camera fitted that small container, so zooming out felt like zooming in.

Kept: Enter still opens details; Containers · Groma on Enter from context (first container by id is Architecture workspace, a small unlabeled box, and Enter-then-Right would escape). Dropped spike Backspace-ascend and cross-axis scoring.

fitLayer reuses focusElement so each C4 level frames its containing box. followSelection tweens only on level change. Kept Math.min on the way out so `+`/`-` that is already wider than the outer level does not zoom in. Simplicity review asked to delete that clamp; rejected because map `+`/`-` is product.

Verification: bun test test-bun/terminal-viewer.test.ts 15/15; bun run check. agent-tty: Enter Groma → Right Core → Enter → Right World layout (Core still fills the screen) → Right Architecture workspace (Groma neighborhood, Core still labeled).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Same-level arrows keep zoom and pan only if needed. Level changes tween to the containing box of that C4 level (system at Containers, container at Components), so escape zooms out to the neighborhood instead of into a sibling. Verified with viewer tests (15/15), bun run check, and agent-tty 120x36 (sibling arrow stays on Core; further Right shows Groma with Architecture workspace selected).
<!-- SECTION:FINAL_SUMMARY:END -->
