---
id: TASK-186
title: Anchor Blueprint decorations to the map grid
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 15:12'
updated_date: '2026-08-27 15:19'
labels: []
dependencies: []
references:
  - page
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/atoms/theme.ts
  - test-bun/theme.test.ts
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blueprint map decorations must move and scale with the architecture grid. Remove viewport-fixed map ornaments so panning or zooming never leaves decorative geometry floating over the blueprint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Blueprint has no viewport-fixed circles, corner marks, or other map ornaments
- [x] #2 All remaining map decorations are rendered in SVG/grid coordinates and therefore move and scale with pan and zoom
- [x] #3 Blueprint chrome, palette, compass, theme cycle, and layer mode remain unchanged
- [x] #4 Focused checks and browser QA verify Blueprint before and after pan and zoom without console errors
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
1. Remove the Blueprint map pseudo-elements whose geometry is fixed to the viewport, including radial circles and registration corners.
2. Keep the palette, chrome treatment, SVG grid opacity, compass, and theme/layer behavior unchanged.
3. Run focused tests and bun run check, then verify in the browser that the Blueprint grid pans and zooms without any stationary map ornament.
4. Run the required simplicity and full-context architecture reviews before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Removed the Blueprint #map pseudo-elements, so the fixed radial circles and registration corners no longer exist.
- Removed the unused registration palette token and its test assertion.
- Focused theme/page tests pass. The first full check had one transient 20-second web-live watcher timeout; the exact test file then passed 5/5. A complete rerun of bun run check passed: 81 Node tests and 177 Bun tests.
- Browser QA at /?system=groma&theme=blueprint confirmed both pseudo-element contents are none. Pan and zoom changed the camera transform from matrix(0.0606, 0, 0, 0.0606, 556.4, 294.7) to matrix(0.0757, 0, 0, 0.0757, 668.5, 339.37). The Blueprint grid, compass, three F2 layer labels, and theme remained present; console warnings/errors: 0.

- Cold simplicity review passed. It confirmed direct deletion is the smallest implementation, the registration cleanup is complete, the remaining theme test still covers useful shared behavior, and no blocking or optional findings remain.

- Specification review passed every acceptance criterion and Definition of Done item. It found no blocking findings or follow-ups.
- Quality review passed with no findings. It confirmed the deletion is isolated, the remaining SVG/grid path is correct, tests retain useful coverage, and final staging must exclude TASK-183's F2 Help hunk.

- Full-context architecture review passed with no recommended-now changes or follow-ups. It confirmed the simpler and safer architecture is direct deletion: theme colors stay in atoms/theme.ts, Blueprint geometry stays in the iso domain, painting uses one camera path, and the SVG grid receives the same camera translation and scale. A new decoration abstraction would add a concept without supporting visible behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed Blueprint's viewport-fixed circles and registration corners so every remaining map decoration follows the SVG grid/camera. Deleted the unused registration theme token and obsolete assertion. Verified with focused tests, a clean bun run check (81 Node and 177 Bun tests), browser pan/zoom and F2 interaction, zero console errors, and passing simplicity, specification, quality, and full-context architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
