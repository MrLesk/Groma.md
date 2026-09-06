---
id: TASK-191
title: Group Web grid cells into larger graph-paper squares
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 18:41'
updated_date: '2026-08-27 18:44'
labels: []
dependencies: []
references:
  - iso-map
  - shell
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/atoms/theme.ts
type: enhancement
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses the Web map, Groma shows graph paper where five quiet minor cells form one clearly stronger major cell. Both levels remain part of the projected world grid, so they move and scale with the architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every five minor grid cells form one major grid interval
- [x] #2 Major grid lines are clearly stronger than minor grid lines in light, dark, and Blueprint themes
- [x] #3 The grid remains anchored to world geometry during pan, zoom, projection changes, and layer mode
- [x] #4 At distant zoom levels minor lines may hide while the major grid remains visible
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
1. Reuse the existing projected minor/major SVG pattern and make each tile five cells wide.
2. Keep minor lines quiet while giving major boundaries a stronger screen-constant stroke and theme token.
3. Verify all three themes plus pan, zoom, projection, and F2 behavior in the real browser, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed the existing projected grid tile from four to five cells and gave its major boundary a 1.5 px screen-constant stroke while minor lines remain 1 px.

Strengthened only the existing major-grid palette token in light, dark, and Blueprint. Minor grid colours and all architecture geometry colours remain unchanged.

Browser QA at http://localhost:4747 verified: the pattern is 120 world px (5 × the 24 px cell pitch); four minor divisions sit inside each major interval; major stroke is 1.5 px and minor stroke is 1 px on screen. Light, dark, and Blueprint all show the intended hierarchy. At Fit, computed display is minor=none and major=inline; after zooming to 244%, both are inline. F2 produced System, Container, and Component layers and recomputed the grid pattern transform for the separated projection. Console had no warnings or errors.

Cold simplicity review: the flow is theme palette -> existing projected SVG pattern -> camera-corrected minor/major strokes. Inlined the two one-use stroke constants; retained named minor and major paths because their camera updates now differ. No extra grid layer, component, CSS selector, test, or documentation was needed. Targeted re-check passed: Biome clean on both changed files, TypeScript clean, and 19 focused tests passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed the existing projected Web grid from a four-cell tile to graph-paper-style five-cell major intervals. Major boundaries now use a 1.5 px screen-constant stroke and stronger theme tokens while minor lines remain quiet and hide at distant zoom. Verified all themes, zoom levels, and F2 in the browser with a clean console; full repository checks passed with 81 Node and 180 Bun tests, alongside existing lint warnings only.
<!-- SECTION:FINAL_SUMMARY:END -->
