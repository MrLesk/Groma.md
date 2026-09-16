---
id: TASK-292
title: Animate camera navigation and focus flow steps
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:29'
updated_date: '2026-09-05 22:37'
labels: []
dependencies: []
references:
  - iso-camera
  - flow-controls
  - iso-map
  - render
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/motion.ts
  - src/viewers/web/flow/state.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - test-bun/web-camera-motion.test.ts
  - test-bun/web-flow-activation.test.ts
  - docs/viewers/web/index.md
  - features/flows.feature
type: enhancement
ordinal: 331000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Flow step navigation should smoothly frame the selected relationship and its endpoints, pulse the endpoint components with the existing focused-route treatment, and return to the complete checked-flow view on Clear focus. Camera navigation should show a quick continuous pan and zoom from the current displayed position, retaining the readable automatic zoom limit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Next, Previous, and direct step selection smoothly fit the step route and its endpoint bodies at no more than the readable automatic zoom scale.
- [x] #2 The focused route and its endpoint components share the existing continuous pulse; other flow members retain normal highlighting, and reduced motion remains static.
- [x] #3 Clear focus smoothly restores the complete checked-flow framing.
- [x] #4 Architecture and task selection, search navigation, Fit, and zoom controls animate pan and zoom together; a new action starts from the displayed camera and direct gestures remain responsive.
- [x] #5 Focused lifecycle and camera tests, browser verification, documentation, and bun run check cover the supported behavior.
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
1. Keep flow step scope in flow/state and reuse architecture fitting for the focused route plus endpoints; Clear focus restores the checked-flow union. 2. Use one camera-motion owner beside camera fitting: animate position and scale together over 220ms, retarget from the displayed state, and let direct gestures replace pending motion. Layer transitions update the same animated destination as their geometry changes. Reuse the existing compositor path for all camera frames. 3. Mark focused route endpoints in map state and reuse the existing pulse keyframes and reduced-motion treatment. 4. Cover motion interruption and flow focus/clear invariants, update behavioral documentation, verify in the browser, run bun run check and self reviews, then the required full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one camera-motion module beside camera fitting, reusing the existing layer-motion pattern and compositor path. Navigation interpolates x, y and scale together over 220ms; repeated zoom buttons use the destination, while new selections retarget from the displayed camera. Direct gestures replace pending motion and layer reprojection cancels it. Flow step scope uses the existing explicit route and endpoint fit; map state gives those endpoints the existing pulse and static reduced-motion emphasis. Renderer dropped from 498 to 486 lines. No new OKF metadata, C4 elements, layout rules, or stored architecture concepts: flows remain supporting knowledge and this behavior belongs to the existing viewer camera, flow controls, and map. Self simplicity/specification/quality reviews found no blocking issue. Focused tests pass 13/13; bun run check passes including lint, typecheck, Node and 313 Bun tests across 62 files. Browser verification: whole flow about 481 percent, first step 1949 percent, next step 1337 percent, Previous restores first step, Clear focus restores 481 percent and removes all focused marks. DOM inspection confirms one focused route plus exactly its two endpoints with map-flow-focus animation; screenshots confirm both endpoints and route fit. Camera compositor transform and zoom readout change during transitions. Final full-context complexity review pending.

The full-context reviewer found no blockers and one redundant compositor condition, now removed. Completion review also identified layer switching as another caller of the immediate fit path covered by the requested general smooth-movement rule. Layer mode now retargets the same camera animation while its geometry moves; direct orbit remains immediate. This removes the separate stop method from the animator.

Final verification after cleanup: bun run check passed again (313 Bun tests, Node tests, lint and types). Browser F2 observation showed camera scale and translation progressing through intermediate values rather than jumping; step framing works across the separated actor/component planes, and Clear focus restores the checked flow with zero focused marks. Targeted complexity re-review passed with no blockers. Final renderer is 485 lines and camera-motion module is 59 lines. Temporary browser tab and read-only preview server were closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Flow steps now smoothly fit their route and endpoint bodies, which share the focused pulse. Clear focus smoothly restores all checked flows. Camera navigation uses one 220ms pan-and-zoom transition with readable automatic zoom, responsive direct gestures, reduced-motion support, and continuous layer-view fits. Verified with browser flow/step/clear/layer interactions, 13 focused tests, the complete repository check (313 Bun tests plus Node, lint and types), and a final complexity review without blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
