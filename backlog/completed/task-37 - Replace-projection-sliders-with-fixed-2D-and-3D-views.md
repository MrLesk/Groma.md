---
id: TASK-37
title: Replace projection sliders with fixed 2D and 3D views
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 13:14'
updated_date: '2026-08-16 13:17'
labels: []
dependencies: []
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The free rotation and tilt sliders were exploration tools. The chosen product default is rotation 30deg, tilt 45deg. The control panel keeps view switching but drops full freedom: 2D is a fixed top-down plan at rotation 0, 3D is the fixed default city view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The panel offers exactly two views: 2D (rotation 0, top-down) and 3D (rotation 30deg, tilt 45deg); no free sliders remain
- [x] #2 Switching views re-renders and re-fits without reloading; pan, zoom, and hover still work in both
- [x] #3 The page opens in the 3D view by default
- [x] #4 Scene tests keep passing against the new default projection
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
1. scene.ts: set defaultProjection to rotation 30deg, elevation 45deg.
2. render.ts: drop slider wiring and readouts; a planView boolean picks between the fixed plan projection (rotation 0, elevation 90deg) and defaultProjection; the 2D/3D buttons only call setMode.
3. page.ts: shrink the panel markup and CSS to the two buttons.
4. Rerun bun run check; visual check of both views and interactions; cold simplicity review; finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `bun run check` green (56 node + 30 bun tests; scene tests reference defaultProjection symbolically so no edits were needed). Browser checks: page opens in 3D at rotation 30deg / tilt 45deg; clicking 2D snaps to the axis-aligned top-down plan at rotation 0 and re-fits; 3D returns to the default; zoom and pan verified after switching; no sliders remain. Cold simplicity review: 2 minor findings (store the chosen Projection directly instead of a planView boolean + projection() helper; drop obsolete HTMLButtonElement casts), both applied, checks rerun.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the free rotation/tilt sliders with two fixed views: 2D (rotation 0, top-down plan) and 3D (the new product default, rotation 30deg, elevation 45deg, set in scene.ts defaultProjection). The client stores the current Projection directly; buttons just swap it, re-fit, and redraw. Verified with `bun run check` and browser checks of both views plus pan/zoom after switching.
<!-- SECTION:FINAL_SUMMARY:END -->
