---
id: TASK-73
title: Restyle the web viewer as the groma.md technical sheet
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 20:59'
updated_date: '2026-08-16 21:27'
labels: []
dependencies: []
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web viewer currently reads as a prototype: khaki floating panes, a tiny header, four clashing kind colors, and no typographic hierarchy. Restyle it to the approved Groma brand direction (groma/brand STYLE.md): a luminous warm-white technical drawing sheet with graphite linework, engineering-style monospace typography, and the single green accent #1D9E75. Composition follows an edge-to-edge drafting frame: header title strip with the groma.md lockup, hairline rules between panes instead of floating cards, uppercase letterspaced micro-labels for metadata and section headings, and drafting-style controls. Behavior is untouched; this is a visual restyle of existing chrome, panes, and city rendering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The page renders as one warm-white sheet: a single background, graphite hairline rules dividing header, panes, and footer, with no gaps, rounded corners, or shadows between panes
- [x] #2 Green #1D9E75 is the only accent: selection and hover outlines, tree selection rule, active action rule, and the lockup .md suffix; kind marks, legend, and all other chrome are monochrome graphite
- [x] #3 The map draws the city on a fine drafting grid; block faces are white with graphite hatching per kind and remain visually distinct without color
- [x] #4 Details and hierarchy panes use engineering typography: a prominent selection name, uppercase letterspaced micro-labels for kind/origin and section headings with hairline rules
- [x] #5 Footer controls (2D/3D, zoom readout, action caption) are styled as drafting controls with the active mode filled in ink
- [x] #6 All existing behavior is unchanged: selection, hover, person-command paths, live world updates, 2D/3D switching, zoom and pan
- [x] #7 bun test passes
- [x] #8 The camera orbits freely: right-drag (or ctrl/alt-drag) rotates through full 360-degree azimuth with elevation clamped between just above ground level and top-down, so the city is never seen from below
- [x] #9 PLAN and ISO controls reset the camera to the fixed plan and isometric projections; a FIT control re-fits the current view; orbiting away from a preset clears its active state
- [x] #10 Zoom works by scroll and by + / - map controls, and the zoom readout stays current
- [x] #11 The cursor signals interactivity: pointer over a selectable box, grab/grabbing for panning
- [x] #12 With no active person command the footer shows a quiet control hint; an active command replaces it with its caption and x clear
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
1. Rework src/viewers/web/atoms/theme.ts: warm-white paper, graphite ink, muted gray, hairline token, single green accent; delete the four kind colors.
2. Rewrite the stylesheet in page.ts: edge-to-edge grid (header strip / three panes / footer strip) divided by graphite hairlines, no gaps or cards; engineering monospace type scale; uppercase letterspaced micro-labels for meta, section headings, and legend; monochrome kind marks; selection carried by the green rule; footer controls with ink-filled active mode.
3. Restyle the city: white block faces with lighter graphite hatching per kind (hatch.ts), theme-sourced label ink (label.ts), and a fine drafting grid under the city (render.ts, rebuilt on world updates).
4. Verify in the browser at several sizes and selections against the brand direction, then run bun test.

5. User expanded scope mid-task: free camera orbit (never below ground), FIT control, +/- zoom buttons, PLAN/ISO preset naming, hover cursor, and a footer control hint. Implement in render.ts and page.ts, update docs/viewers/web/index.md, and re-verify in the browser across angles, zoom levels, and window sizes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified in Chrome against the live server (bun src/cli.ts web) with screenshots at 1200x800, 1600x900, and 1920x1080: single warm-white sheet with graphite hairlines and the lockup title strip; monochrome legend and marks with green only on selection, hover, tree rule, active action, and the .md suffix; drafting grid under white hatched blocks in Iso, Plan, and free-orbit views. Camera behavior exercised through synthetic pointer events: right-drag orbit rotates and clamps at 0.08 rad above ground and just under top-down (grid rendered as a radially fading mipmapped texture plane so grazing angles stay soft); Plan/Iso re-fit and clear pressed state on orbit; Fit re-fits the current view; +/- buttons and scroll drive the readout (244% observed, empty at fit). Cursor DOM check returned pointer over a box and default elsewhere. Hint and action caption both observed in the footer. bunx tsc --noEmit clean; bun test 142 pass. Cold simplicity review applied: css() reused for the grid stroke, preset projections assigned directly, dead per-kind mark classes dropped, one grouped micro-label CSS rule, setZoom() consolidating the three zoom paths, and the one-function web organisms/chrome.ts deleted (its git-tracked deletion staged so the repository self-scan test passes). Default Iso changed to true isometric (rotation pi/4, elevation atan(1/sqrt(2))).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restyled the web viewer as the groma.md technical sheet and added free camera control. Theme: warm-white paper, graphite ink, single green accent, kind colors deleted. Page: edge-to-edge hairline frame, lockup title strip, uppercase letterspaced micro-labels, monochrome legend, ink-filled active controls. City: white faces with pencil-weight hatching per kind, radially fading drafting grid, true-isometric default. Interaction: right/ctrl/alt-drag orbit clamped above ground, Fit/Plan/Iso controls, +/- zoom buttons, hover pointer cursor, footer control hint. Docs updated (docs/viewers/web/index.md). Verified with browser screenshots at three window sizes, synthetic pointer-event checks for orbit/zoom/cursor, bunx tsc, and bun test (142 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
