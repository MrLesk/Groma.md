---
id: TASK-505
title: Keep the web map grid soft and unchanged while panning
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:54'
updated_date: '2026-09-23 21:52'
labels: []
dependencies: []
references:
  - map
  - grid
  - map-sharing
modified_files:
  - src/viewers/web/iso/grid.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/style.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/svg.ts
  - src/viewers/web/sharing/cover.ts
priority: medium
type: enhancement
ordinal: 586000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex noticed on 2026-09-23 that when panning the web map in Safari at low zoom, the graph-paper grid looks softer than when the map is at rest. Alex prefers the soft look and wants it as the default: the resting grid's lines are too visible, and nothing about the grid should change while the map moves.

Cause, verified with on-screen captures in Safari: the grid's position follows every camera frame, but its line widths and its visibility are refreshed only when the map settles, 250 ms after the last motion. After a zoom-out the lines keep the width set for the earlier zoom, so a pan that continues without a pause shows thinner lines (0.37 px after zooming from 400% to 147%), which snap back to one pixel when the map stops. A pure pan changes nothing but the grid's position.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Below 100% zoom, the resting grid draws its lines as softly as Safari drew them while panning, in every theme
- [x] #2 Panning never changes how the grid looks: moving and resting show the same lines
- [x] #3 The grid still fills the map pane and moves exactly with the map while panning and zooming
- [x] #4 Alex confirms the grid look and its stability in Safari
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
1. iso/grid.ts owns the whole viewport grid. The tile constants and the row-spacing threshold move there from scale.ts: MIN_GRID_PITCH_PX and MIN_MAJOR_GRID_PITCH_PX (both 6 px) become one constant, and GRID_ROW_PITCH, which equals PLANE, goes. New rule: a grid line is one screen pixel wide but never wider than 1/24 of its row spacing on screen, so dense rows at low zoom draw proportionally thinner lines and the grid keeps one weight as the map zooms out; the minor rows also arrive thin when zooming in instead of at full weight.
2. gridPattern(camera, view) draws the grid for one camera as SvgNodes, like every other shared map drawing: the tile transform, both line widths and the minor rows' visibility. Share covers serialise it with markup; the live map's createGrid() exposes follow(camera, view), which toggles the full-pane field and patches the pattern, so only changed attributes are written. The pattern-space mark() helper moves from style.ts to svg.ts beside node(), since grid.ts and style.ts both draw tile marks.
3. iso/map.ts builds the grid with createGrid() and calls grid.follow in move() on every camera change, above the unchanged-camera return because a repaint can change the projection without moving the camera. commitCamera no longer touches the grid, the data-minor-grid-hidden attribute on the map root goes (an ancestor attribute restyles the whole map), and isSheet stops testing the grid rect, which can never be a pointer target.
4. iso/style.ts drops the data-minor-grid-hidden rule and imports mark().
5. docs/viewers/web/index.md describes the thinning rule and the grid following every frame.
6. Tests: none added. The rule is a drawing weight checked on screen in Safari, Alex asked for tests of core business logic only, and no existing test covers the grid.
7. Verify in Safari with on-screen captures: zooming out and panning without a pause shows the same lines as the settled map, and the resting grid at the lowest visible zoom is soft. Check alignment and widths in Chrome, run bun run check, then Alex confirms in Safari.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned. iso/grid.ts now owns the viewport grid: the tile, the 6 px row-spacing threshold (one constant replacing the two equal scale.ts constants), the line-width rule min(1 / k, rowPitch / 24) in tile units, the pattern markup shared with share covers, and createGrid().follow(camera, view), which map.ts calls from move() on every camera change. commitCamera no longer touches the grid, and the minor rows hide through a style on their own path instead of data-minor-grid-hidden on the map root.

Safari 27 evidence, on-screen captures of the live window (not WebDriver snapshots, which re-render the page): before the change, zooming from 400% to 147% and panning without a pause kept the major stroke at 1/k for 400% (0.37 px on screen) until the map settled, then it snapped to 1 px, a clearly stronger grid. After the change the same gesture keeps the major stroke at 5 tile units throughout (0.28 px on screen at 150%), and the mid-motion and settled captures look the same. WebDriver snapshots of the resting grid at 150% in the same empty region: mean luminance over the background 19 fell from 2.61 to 1.21 (the lines draw as device-pixel hairlines instead of 1 CSS px lines). At 889% the minor rows show at 0.33 px and the major rows at 1 px.

bun run check in the shared tree passes: biome lint, the scrollbar lint, typecheck, 16 Node tests, and 725 Bun tests across 135 files (45 skipped, 0 failed, 336 s).

Headless Chrome on a static export (scratch grid-align.mjs): settled at 400%, 150% and 800%, and mid-motion right after zooming out to 150% or in to 800% and panning, the grid pattern's translate and scale equal the camera the map shows (the committed SVG transform combined with the cached layer's CSS transform, within 0.01 px because the CSS string is read back with six significant digits), and the line widths equal min(1 / k, 1) for minor rows and min(1 / k, 5) for major rows at the shown k, with minor rows hidden below 6 px spacing. Alex tried the change in Safari and replied 'looks good' (2026-09-23).

Alex approved all three findings of the end-of-task review (2026-09-23), which ran as a general-purpose agent with a written brief because the full-context fork was unavailable: the grid is drawn as SvgNodes by gridPattern and patched in place (covers serialise the same nodes), the dead grid hit test in isSheet is gone, and a comment in move() explains why grid.follow runs before the unchanged-camera return. After the refactor the Chrome alignment check passes again on a fresh export, reading the attributes patch writes, and the share covers' grid pixels match the earlier export exactly (an empty strip is identical; the only differing pixels sit inside the map, where other work in the shared tree changed the architecture). The web sharing, export and pointer tests pass.

Final bun run check in the shared tree passes: typecheck, 16 Node tests, and 725 Bun tests across 135 files (45 skipped, 0 failed); biome reports warnings only in files outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map's graph-paper grid now looks the same in motion and at rest, with soft lines at low zoom. Its line widths and visibility used to refresh only when the map settled, so after a zoom-out a continuing pan drew thinner lines (the soft look Alex liked) that snapped back to one pixel when the map stopped. iso/grid.ts now owns the grid: gridPattern draws it for one camera as SvgNodes, with each line one screen pixel wide but never wider than 1/24 of its row spacing, so dense rows draw hairlines and the grid keeps one weight at every zoom; share covers serialise the same nodes, and createGrid().follow patches position, widths and visibility on every camera move, never at settle. Verified with Safari on-screen captures (mid-motion and settled identical, the resting grid at 150% soft), a Chrome check that the grid tile and widths match the shown camera mid-motion and at rest, an unchanged cover grid, bun run check, and Alex's check in Safari.
<!-- SECTION:FINAL_SUMMARY:END -->
