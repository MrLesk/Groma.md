---
id: TASK-197
title: Restore Web map pan frame rate
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 19:23'
updated_date: '2026-08-27 19:29'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/map.ts
priority: high
type: bug
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the grid density change, moving and zooming the Web architecture map has a massive frame-rate regression. Restore smooth camera interaction while keeping the readable grid hierarchy; if the grid effect cannot stay cheap, simplify or remove it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sustained pan at Fit and close zoom remains responsive without the new patterned-field repaint cost
- [x] #2 Zooming between 50% and 244% does not cause a sustained frame-rate collapse
- [x] #3 The grid remains visually calm in light, dark, and Blueprint, or is removed where it cannot be rendered cheaply
- [x] #4 Camera geometry, selection, routes, work pins, and layer mode remain unchanged
- [x] #5 Browser performance evidence and the repository check pass
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
1. Move the patterned grid back out of the architecture camera so panning does not repaint it together with buildings, routes, labels, and pins. 2. Retain TASK-196's cheap density changes: six-pixel minor threshold, single major tile boundaries, and complete distant removal; update the separate grid transform only in the existing animation-frame camera application. 3. Verify Fit, 244%, and 50% camera interaction, F3 frame-rate recovery, all three themes, selection and F2; run focused and full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: TASK-196 moved the SVG pattern-filled field inside the camera group. Every camera transform then invalidated the pattern together with the complete architecture scene, producing the reported pan regression.

Moved the field back to a root-level SVG rect while leaving the architecture in its own camera group. Retained the six-pixel minor-grid threshold, single major tile boundary, and complete distant removal. The existing requestAnimationFrame camera scheduler remains the only update loop.

Browser QA at http://localhost:4753/?system=groma, 1280x720 on a 120 Hz display: the DOM confirms the grid rect is a direct SVG child and has no camera ancestor. Repeated zoom camera updates held 120 FPS; 244% held 120 FPS with minor rows hidden; 51% held 120 FPS with the field display removed. F2's complete layer transition sampled 93 FPS and recovered to 120 FPS. Selection, task pins, SYSTEM/CONTAINER/COMPONENT layers, and Blueprint remained intact. Page identity and meaningful content passed, with no framework overlay, console warning, or console error.

Cold simplicity review: the fix reverses only the invalidating DOM placement. Camera events still follow event -> one scheduled frame -> map.move; the camera transforms architecture, while the sibling grid receives only its lightweight alignment transform when visible. No state, event, renderer, dependency, test concept, or compatibility path was added. Removing more would discard the requested grid or the established distant optimization.

Verification: focused TypeScript/lint and 18 iso tests passed. bun run check exited 0; TypeScript, 81 Node tests, and 185 Bun tests passed. Biome reported only existing complexity warnings and no errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored smooth Web camera movement by taking the patterned grid out of the architecture camera group, while retaining the calmer zoom hierarchy and distant removal. Browser QA held the display's 120 FPS through repeated camera updates and recovered from F2 animation to 120 FPS; the complete repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
