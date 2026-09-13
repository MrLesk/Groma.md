---
id: TASK-387
title: Animate transitions between 2D and the spatial map views
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 20:13'
updated_date: '2026-09-13 20:20'
labels: []
dependencies: []
references:
  - presentation
  - orbit
  - render
modified_files:
  - src/viewers/web/layers/orbit.ts
  - src/viewers/web/iso/presentation.ts
  - src/viewers/web/render.ts
  - test-bun/web-layer-mode.test.ts
  - test-bun/web-map-presentation.test.ts
  - docs/viewers/web/index.md
  - test-bun/iso-map.test.ts
  - src/viewers/web/iso/motion.ts
  - test-bun/web-camera-motion.test.ts
ordinal: 433000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switching to or from 2D currently skips the spatial animation used by Iso and Layers, making the same architecture feel disconnected. The transition should visibly carry the architecture between a raised spatial view and its overhead footprint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Iso and Layers transition smoothly to and from 2D through camera rotation, flattening building geometry and changing layer separation, without an immediate geometry replacement.
- [x] #2 Settled 2D retains one flat footprint per element and the same source evidence, identities, layout and relationships; Iso-to-Layers motion remains unchanged.
- [x] #3 Changing view during a transition continues from displayed geometry; reduced motion applies the final state immediately, and F2 still returns to the previous nested view.
- [x] #4 Focused motion and geometry tests, browser verification and bun run check pass.
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
Extend the existing pose with plan flattening, interpolate pose and projected floor geometry together, preserve the final overhead representation, and verify intermediate geometry and interrupted transitions before browser review.

Synchronize the displayed camera with plan-transition progress to remove the initial fit jump observed during browser verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification reproduced an initial framing jump when entering 2D from a whole-map camera while an element is selected. Synchronize camera framing with plan pose progress so the accepted smooth transition starts from the displayed camera as well as geometry.

Implemented an 850 ms plan transition with gentle start and settle. Existing Iso/Layers motion retains its 650 ms curve. The displayed pose now owns flattening as well as yaw, pitch and separation. Intermediate copies lower building heights and widen tiers toward the final footprint; settled overhead still merges file evidence into the existing single footprint. Shared camera motion follows the same progress from its displayed position, avoiding a fit jump when entering or leaving 2D. Tests verify intermediate geometry, endpoint continuity, world immutability, F2 return, destination interruption, reduced motion and camera framing. Browser screenshots sampled the actual transition in both directions, including rapid redirection. Local web restarted and verified with all eight plugins healthy. Final bun run check passed: lint, types, 16 Node tests, 307 Bun tests, 6 optional native tests skipped. Git diff --check passed. Self specification, quality and simplicity review found no blocking defect; the change stays in the existing presentation, pose and camera owners without changing architecture semantics.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added coordinated 2D transitions: camera turns overhead, buildings flatten, tiers widen and framing moves on one clock. Returning to Iso or Layers reverses the transformation. Interrupted changes preserve displayed geometry and camera; reduced motion remains immediate. Browser verification and the full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
