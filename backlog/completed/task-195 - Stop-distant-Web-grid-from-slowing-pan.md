---
id: TASK-195
title: Stop distant Web grid from slowing pan
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 19:00'
updated_date: '2026-08-27 19:08'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/map.ts
  - test-bun/iso-scale.test.ts
priority: high
type: bug
ordinal: 207000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect pans the Web map at distant zoom, Groma stops painting the dense graph-paper pattern before it can reduce frame rate. Fit and closer views retain the useful grid hierarchy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At distant zoom where major grid cells are no longer useful, the complete grid leaves the paint tree
- [x] #2 Panning at minimum zoom does not repaint the graph-paper pattern
- [x] #3 Fit and closer zoom retain the five-cell graph-paper hierarchy in all themes
- [x] #4 Grid visibility changes only with scale; pure pan preserves world geometry, camera behavior, selection, routes, and layer mode
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
1. Keep grid visibility in the existing iso scale domain: retain the five-cell tile while requiring its major pitch to remain at least six screen pixels.
2. When the grid is below that threshold, remove its field from paint and stop rewriting its SVG pattern transform during pure pan.
3. Verify with a scale invariant, browser DOM mutation evidence, FPS/pan interaction, themes, Fit, and F2; then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added one scale-domain rule: the complete graph-paper grid is useful only while its five-cell major pitch is at least six screen pixels. Reused the same exported five-cell constant for rendering and visibility.

The map now removes the grid field from display below the threshold and skips patternTransform writes entirely while panning at that scale. Fit and closer views keep the existing projected pattern.

Added the scale invariant at the six-pixel boundary: 0.049 hides the full grid and 0.05 retains it for a 120-world-pixel major tile.

Browser verification on the production page: Fit kept the grid visible; the first Zoom out reached k=0.048618 and removed the grid field from display. A subsequent drag changed the camera transform while the grid patternTransform remained byte-for-byte unchanged. Selection, routes, work pins, theme, and F2 layer mode remained active; browser console stayed clean.

Reference comparison: Tanks uses two independent mechanisms: a fixed CSS gradient paper texture and finite Three.js GridHelper geometry rendered by WebGL. Groma keeps its world-space grid rather than adding a screen-fixed decoration or WebGL dependency; the minimum sufficient fix is to stop painting and moving the SVG pattern only after its major cells become too dense to help.

Cold simplicity review: the flow is scale rule -> map move -> hide field and skip pattern mutation. The shared five-cell constant prevents the rendering tile and visibility threshold from drifting. No new component, CSS selector, renderer, dependency, or UI state is needed; nothing can be collapsed without duplicating the tile invariant or restoring the expensive pan mutation.

Verification: bun run check exited 0; TypeScript, 81 Node tests, and 184 Bun tests passed. Biome reported only existing complexity warnings and no errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the infinite graph-paper SVG field from paint below a scale-derived usefulness threshold and stopped rewriting its pattern transform during distant pan. Fit and closer views keep the existing five-cell hierarchy across themes and layer mode. Verified through browser DOM/camera interaction and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
