---
id: TASK-269
title: Keep Safari flow selection and animation smooth
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 18:58'
updated_date: '2026-09-05 19:46'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - test-bun/web-svg-performance.test.ts
type: bug
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting the Agent: architecture curation flow at http://localhost:4747/?flow=agent-architecture-curation&theme=light causes severe lag in Safari while Chrome remains smooth. Diagnose and remove the demonstrated browser rendering cost while preserving the existing flow experience.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The reported flow runs smoothly in Safari after selection, with measured improvement against the same-map baseline.
- [x] #2 Focused verification, bun run check, and the full-context complexity review are completed with evidence.
- [x] #3 The approved TASK-270 presentation is preserved: continuous directional flow dashes with fixed arrowheads, solid task-highlighted routes, static unhighlighted draft dashes, reduced motion, existing selection/camera behavior and fixed geometry; Chrome remains smooth.
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
1. Preserve the committed TASK-270 flow/task/draft presentation. 2. In Iso map, split ground, animated routes, and foreground buildings into aligned sibling paint surfaces; apply the existing single camera to all worlds and isolate only the animated route surface. Keep core geometry, route nodes, layering, and input behavior unchanged. 3. Update the existing composition guard, verify built Safari/Chrome flow and camera behavior, run focused tests and bun run check, and request the full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Safari reproduces the reported flow slowdown on the current 80-element, 98-route map: initial comparison measured idle 60 FPS (p95 17 ms), active flow 22 FPS (p95 59 ms), and the same flow with only marker animation paused 59 FPS (p95 18 ms). This isolates the continuous marker animation as the trigger; further comparisons run with Inspector closed.

With Inspector closed, CSS baseline measured 30 FPS/p95 39 ms. Marker will-change measured 31/39; translateZ on the marker 25/72; translateZ on the route group 25/55. Native SVG animateMotion also remained at 32 FPS/p95 37 ms versus CSS 32/40. These small style/animation substitutions do not remove the demonstrated cost.

Route-local HTML motion inside SVG foreignObject measures 60 FPS/p95 17 ms with and without will-change, while retaining marker path coordinates and the original SVG route layer. No implementation files were edited. Before applying that fix, the TASK-266 agent reported a new Alex-approved presentation change replacing markers with animated dashed flow lines in iso/style.ts, iso/paint-routes.ts and iso/map.ts. File ownership was coordinated: that agent implements the presentation change; TASK-269 will measure its built result first and avoid obsolete marker code.

TASK-270 is the confirmed owning task for the approved presentation change. Safari testing now targets its built preview on port 51714. The old marker-preservation criterion is replaced by preservation of TASK-270 flow/task/draft styling. Original-marker Chrome baseline measured 120 FPS/p95 9.1 ms, confirming the browser difference.

A fixed 80-element/98-route snapshot in Safari measured 21.3 FPS/p95 56 ms before isolation and 60.2 FPS/p95 18 ms with aligned SVG surfaces inside HTML wrappers and route-only compositing. Screenshot confirms original route placement. The foreignObject experiment was rejected because Safari did not preserve placement. The accepted direction changes only the existing Web Iso map paint boundary; OKF records, C4 elements, core sheet geometry and flow semantics stay unchanged.

Implementation and self-review: three sibling HTML/SVG paint surfaces preserve existing ground/routes/foreground order and use one camera value; only active flow routes request a separate paint layer. SVG definitions remain with foreground buildings so facade generation still resolves its owning SVG. No OKF/C4, projection, flow, or task-style rules changed. Built Safari verification: full flow 60 FPS/p95 18 ms, versus fixed-map baseline 21.3 FPS/p95 56 ms; selected step in separated layers 58.3 FPS/p95 18 ms and after wheel pan 60 FPS/p95 18 ms. All three SVG transforms match before and after pan, five routes light for the full flow and one for the selected step; 12 pattern definitions present. Screenshots verify route placement and separated-layer rendering. Chrome remains 120 FPS; zoom preserves matching transforms, the route hit target resolves through the foreground surface, and a blank map click clears selection and releases route compositing. Reduced motion disables the flow animation. Focused tests: 27 pass. Full bun run check passes: 105 Node tests and 306 Bun tests, with seven existing lint warnings. Initial sandbox check could not open filesystem watchers; the required check passed outside the sandbox. Specification and quality self-reviews found no blocking defect or scope expansion. Final full-context complexity review is next.

Final full-context complexity review passed with no blocking findings or recommended runtime changes. The reviewer confirmed that three paint surfaces are required to preserve route drawing order while isolating animation, and that one camera state prevents alignment mistakes. Non-blocking observation: the existing source-based composition test is coupled to source spelling; do not expand that parser as a substitute for browser evidence. No additional behavior or architecture was introduced.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Isolated animated routes between ground and foreground SVG paint surfaces under one shared camera. Safari improved from 21.3 FPS to 60 FPS on the reported flow; Chrome remains at 120 FPS. Verified flow steps, pan/zoom alignment, separated layers, route hit testing, blank-map clearing, and reduced motion. Focused tests and bun run check passed; final complexity review found no blockers. Public behavior and architecture contracts are unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
