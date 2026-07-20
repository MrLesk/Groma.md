---
id: GROM-60
title: Navigate the visual blueprint as a pannable zoomable sheet
status: Done
assignee:
  - '@claude'
created_date: '2026-07-19 22:02'
updated_date: '2026-07-19 22:13'
labels:
  - visualization
  - first-run
milestone: m-4
dependencies: []
references:
  - brand/STYLE.md
  - src/cli/blueprint-html.ts
priority: high
type: feature
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare groma currently renders the bounded blueprint as a scrolling document. The approved visual direction (brand/STYLE.md and brand/references/blueprint-ui-direction.png) presents the blueprint as one technical drawing sheet, and the curated intent of the Visual Blueprint Renderer component (ent_d7033f59c9cc3d88f6716f0240136fa1) already names disposable zoom as an expected view capability. Give the disposable local HTML artifact canvas navigation: the whole bounded main layer is one sheet that the user pans and zooms to move around, instead of scrolling a page. This closes the recorded intent-implementation gap and makes larger bounded blueprints explorable at a glance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The artifact presents the bounded main layer as one fixed-layout sheet inside a full-viewport stage; the page body no longer scrolls
- [x] #2 Pointer drag on the drafting surface pans the sheet; component selection and folding still work with plain clicks at any pan or zoom state
- [x] #3 Pinch-zoom or ctrl/cmd+wheel zooms toward the cursor within fixed bounds; plain wheel or trackpad scroll pans
- [x] #4 Keyboard-only navigation is possible: arrow keys pan, plus and minus zoom, and a labeled Fit control (also on key 0) fits the whole sheet in the viewport
- [x] #5 Pan and zoom state is disposable view state: it is never persisted or written to canonical files, and reloading the artifact restores the deterministic default view
- [x] #6 The artifact stays one self-contained deterministic HTML file with no network requests, within CLI_MAX_RENDERED_BYTES, and renderBlueprintHtml output stays byte-identical across runs
- [x] #7 Renderer tests cover the navigation affordances, the disposable-view constraint, and determinism
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Restructure the artifact body: a fixed-design-width sheet (title header + plates) becomes a transformed stage inside a full-viewport, overflow-hidden canvas viewport; the drawing-specification panel moves to thin fixed overlay chrome with the existing Focus/Reset controls plus new Zoom In, Zoom Out, and Fit controls.
2. Add view-state JS (translate x,y + scale only, kept in memory): pointer-drag pans with a small movement threshold so plain clicks still select and fold; plain wheel/trackpad scroll pans; ctrl/cmd+wheel (pinch gesture) zooms toward the cursor within fixed bounds (0.2x-3x); two-pointer touch pinch zooms; arrow keys pan; plus/minus zoom; 0 and the Fit button fit the sheet; focusin pans the focused element into view for keyboard users; stray native scroll on the viewport is neutralized so the transform stays the single source of view state.
3. Initial view is computed at load as Fit; nothing is persisted (no storage APIs), HTML output stays a pure deterministic function of the overview.
4. Extend renderer tests: navigation affordances present (viewport, stage, fit/zoom controls with accessible names), determinism double-render, no storage or network tokens, byte bound respected.
5. Verify with bun run check, then render the self-blueprint artifact and exercise drag, zoom, keyboard, selection, folding, and focus in a browser.
Supported boundary: pointer, wheel, keyboard, and basic two-pointer pinch on current desktop and mobile browsers; no inertia, rotation, minimap, or view-state persistence; reduced-motion users get the same instant (non-animated) transforms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the canvas in src/cli/blueprint-html.ts: the sheet (title header + plates) is a fixed 1480px-wide stage inside a full-viewport overflow-hidden canvas; the drawing-specification panel is fixed overlay chrome with new Zoom out, Zoom in, and Fit controls next to Focus and Reset. View state is translate+scale in memory only. Drag pans with a 4px threshold and click suppression so plain clicks still select and fold; plain wheel pans; ctrl/cmd+wheel (pinch gesture) zooms toward the cursor clamped to 0.1x-3x; two-pointer pinch zooms; arrows pan 64px; +/- zoom; 0 and Fit fit the sheet, reserving the overlay panel width when the viewport is wide enough; focusin pans focused elements into view; stray native scroll on the viewport is reset to zero.
Validation: bun run check green (413 tests, formatting, typecheck, boundaries, verify:1a compiled black-box suite). Browser verification on the generation-140 self-blueprint artifact: drag pan from empty surface and from a component header (no accidental selection or fold), zoom buttons, click selection at 1.56x zoom updating the specification panel, key 0 refit with selection preserved, fit avoiding panel occlusion at 1280px. Scripted DOM-event verification: ctrl-wheel zoom toward (300,250) with clamps at 3x and 0.1x, plain-wheel pan, ArrowRight pan, minus-key zoom out, reload restoring the deterministic fit view.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bare groma's local artifact now presents the bounded blueprint as one fixed-layout technical sheet on a pannable, zoomable canvas instead of a scrolling page. Pointer drag, wheel, pinch or ctrl/cmd+wheel, arrow keys, +/-, 0, and labeled Fit/Zoom controls navigate it; selection, folding, and focus keep working at any view state; pan and zoom stay in-memory disposable view state and the HTML artifact remains one deterministic self-contained file. Verified with the extended renderer test suite, the full bun run check gate (413 tests plus the compiled Iteration 1A black-box workflow), and interactive plus scripted browser verification of the generation-140 self-blueprint artifact.
<!-- SECTION:FINAL_SUMMARY:END -->
