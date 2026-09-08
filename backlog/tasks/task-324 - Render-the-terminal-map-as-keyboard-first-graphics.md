---
id: TASK-324
title: Render the terminal map as keyboard-first graphics
status: Done
assignee:
  - '@openai'
created_date: '2026-09-08 17:12'
updated_date: '2026-09-08 17:48'
labels: []
dependencies: []
references:
  - projection
  - screen
  - navigation
  - src/viewers/tui/graphics-raster.ts
modified_files:
  - src/viewers/tui/graphics-camera.ts
  - src/viewers/tui/graphics-scene.ts
  - src/viewers/tui/graphics.ts
  - package.json
  - bun.lock
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/panes/screen.ts
  - src/view-host.ts
  - src/cli.ts
  - src/viewers/tui/keys.ts
  - test-bun/tui-graphics.test.ts
  - docs/viewers/tui/graphics.md
  - docs/viewers/tui/index.md
  - docs/viewers/tui/validation.md
  - .github/workflows/tui-graphics-research.yml
  - src/viewers/tui/graphics-raster.ts
type: feature
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The terminal-specific cell layout loses the spatial character of the web map. Provide an integrated graphical map on the isolated research/tui-graphics-prototype branch while keeping all primary navigation possible without a mouse.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The existing view entry point renders the composed web map geometry as terminal graphics when supported, with readable text fallback.
- [x] #2 Keyboard controls support spatial selection, scope navigation, pan, zoom, fit, and graphics/text switching without hijacking search or reading panes.
- [x] #3 Mouse selection, drag pan, and wheel zoom share the keyboard selection and camera model.
- [x] #4 Rendering is bounded, does no raster work while idle, and releases resources on resize, mode change, and exit.
- [x] #5 Focused tests, repository checks, build, and an interactive terminal validation are recorded with honest platform limitations.
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
1. Reuse the pure web projection and resvg rasterization inside the existing terminal map viewport.
2. Add a keyboard-first camera and actual-geometry hit testing; retain normal pane navigation and text fallback.
3. Validate fixtures and the mounted viewer, run the repository check and compiled build, document controls and limitations, then publish only this branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: native asynchronous resvg renders the shared web projection and facade patterns into an OpenTUI ImageRenderable. Iso/2D, keyboard spatial/cyclic selection, scope navigation, Shift-arrow pan, zoom/fit, and optional mouse input share state. Text fallback and Work overlays remain available. Pure render changes do not alter OKF Markdown, C4 identities, scanner behavior, or core layout.

Validation: bun run check passed (110 Node tests, 366 Bun tests, 683 assertions in Bun); 11 new concurrent graphics tests. New/changed handlers meet the Biome complexity limit. Linux standalone build and scripts/smoke-compiled-build.ts passed. tui-test 0.1.0-beta.3 drove source and copied standalone binaries against a disposable fixture Git checkout at 200x60 and 120x36. Actual mouse selection, SGR wheel zoom, drag, keyboard pan, and zero-code Ctrl+C exits were checked. High-resolution Kitty/Sixel, SSH and tmux visual certification remain explicitly unverified. A tool-call time limit terminated one full-check invocation; an uninterrupted rerun passed without changing tests or timeouts.

Review: specification and quality review followed the CLI → existing viewer → shared geometry → capped async raster → image viewport path. Removed nested high-complexity handlers. Tests found resvg panics for offscreen SVG markers; explicit triangle arrows fix the regression. The 2D scene is a non-mutating full-footprint copy. Frame generation checks, one in-flight render, one pending frame and retained native image cleanup cover the supported lifecycle. No browser, alternate architecture graph or generic game engine was added. No separate-agent review facility was available; reviews were performed by the implementer.

Terminal validation note: tui-test mouse scroll emits SGR coordinates 1,1 rather than the preceding pointer position in 0.1.0-beta.3. Its verbose PTY trace established this; explicit ESC[<64;109;30M proved real wheel input at the map. The application required no workaround. Temporary dependency/tool preparation workflows are removed from the delivered tree.

Publication CI reproduced slow first rasterization: the default native font discovery repeated across concurrent rendered viewports. Four mounted tests exceeded their unchanged 3-second first-frame deadline, while the two standalone native raster tests completed in about 4.2 seconds. Investigating explicit host font selection before final publication; no timeout or assertion relaxation.

Corrected the CI first-frame regression by selecting one installed UI font once and passing an explicit fontFiles list with loadSystemFonts disabled. Common Windows/macOS/Linux font candidates are used; unrecognized hosts retain resvg discovery. The same raster helper is exercised by mounted and native raster tests. All original timing deadlines and assertions remain unchanged. Fresh local check: 110 Node + 366 Bun tests, 0 failures; focused graphics tests: 11 pass in 916 ms total. Rebuilt and smoke-tested the standalone executable, copied it away from node_modules, and repeated actual PTY mouse selection/wheel/drag and keyboard pan/exit verification successfully. High-resolution physical terminal host certification remains outside this prototype.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated a keyboard-first graphical map into groma view, with optional mouse selection, pan and zoom, Iso/2D, and readable text fallback. Verified shared geometry/camera/lifecycle through 11 focused tests, all 476 repository tests, Linux standalone build/smoke, and actual source/compiled terminal sessions. High-resolution terminal-host visual certification is a documented prototype limit.
<!-- SECTION:FINAL_SUMMARY:END -->
