---
id: TASK-224
title: Fix web flow highlighting and animation frame rate
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 21:14'
updated_date: '2026-08-30 21:30'
labels: []
dependencies: []
references:
  - render
  - iso-map
  - flow-controls
modified_files:
  - src/viewers/web/iso/style.ts
  - test-bun/web-svg-performance.test.ts
priority: high
type: bug
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect activates a command flow in the web viewer, every component that is a direct endpoint of a highlighted relationship must receive the same active-path treatment as the actor and routes. The animated flow must remain smooth on the current Groma map instead of causing a severe FPS drop. The supplied screenshot is the approved failing example: green routes cross component buildings that remain neutral or dimmed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Activating a flow highlights every direct actor, system, container, and component endpoint in the active route union while unrelated architecture remains dimmed
- [x] #2 Activating several flows highlights the union of their direct endpoints without losing component emphasis
- [x] #3 On the current Groma map after settling, active-flow animation sustains at least 45 FPS and its median displayed FPS is no more than 10 FPS below the idle map
- [x] #4 Focused flow and SVG rendering tests plus rendered browser QA cover the corrected emphasis and performance regression
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
1. Correct active-flow building emphasis in the existing map stylesheet so nested component floor faces use the same highlight rule as actor and external buildings.
2. Preserve directional marching routes while one shared route-layer animation advances the dash in ten discrete steps.
3. Guard the stylesheet composition, run focused and repository checks, then verify single-flow, multi-flow, component styles, FPS, and main-thread cost in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline on the current 68-element, 69-relationship map at 2274% zoom: two active flows lit 38 routes and 29 buildings. Component buildings had lit/onpath classes and opacity 1, but their nested floor faces kept the neutral rgb(162, 166, 174) stroke while actor and external faces were green. The debug panel held 120 FPS on this machine, but CDP Performance metrics over five seconds showed active-flow TaskDuration 0.598352s and RecalcStyleDuration 0.112054s versus idle 0.042855s and 0.000146s, about 14x main-thread work.

Implemented the map-owned fix in two existing files. Lit component buildings now style every nested floor face, matching actors and external systems. Directional motion moved from one continuous animation per lit route to one paused route-layer animation that runs only while tracing; lit routes inherit ten discrete one-unit dash steps per 0.8-second cycle and non-lit/neutral routes pin their offset at zero. Reduced-motion behavior remains static.\n\nFocused verification: 31/31 action-path, flow activation, isometric map, and SVG performance tests pass; git diff --check passes. Browser QA at http://localhost:4751 verified page identity, meaningful content, no framework overlay, no console warnings/errors, two-flow URL restoration, 38 lit routes, 29 lit buildings, and all 105 component floor faces using rgb(29, 158, 117). The shared route-layer animation remained running with steps(10), and sampled dash offset advanced from -6px to -8px. At 2274% zoom, five seconds of active animation measured 0.147128s TaskDuration and 0.041504s RecalcStyleDuration versus the pre-fix 0.598352s and 0.112054s, a 75% TaskDuration reduction; the debug panel held 120 FPS, equal to idle.\n\nRepository check evidence: Biome completed with only the repository's existing complexity warnings, scrollbar validation passed, TypeScript passed, and the focused viewer suites pass. The full Node suite passes 89/91; its two scan-watch tests fail before the change-specific viewer suite with EMFILE. test/scan-watch.test.ts reproduces the same EMFILE when run alone, so this is an environment watcher failure outside TASK-224 rather than a flow regression.

Cold simplicity review passed with no blocking findings. The reviewer traced the existing flow from table activation through activeFlows and route union to lit/onpath SVG classes and the stylesheet. It found the two-file change to be the simplest scoped implementation, with no code, concept, indirection, or test to remove. I added only the suggested one-line comment explaining the inherited route-layer dash offset and reran the focused suite: 31/31 pass.

A separate full viewer run completed 184/196 tests. All flow, projection, map, and SVG performance tests passed. The 12 failures are limited to file-watch timeouts and Bun test servers failing to bind ephemeral port 0; web-live reproduces 0/9 with EADDRINUSE when isolated. This matches the earlier isolated EMFILE watcher failure and is an environment resource limitation, not behavior exercised by this stylesheet change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed active flow presentation in the existing isometric map stylesheet. Nested component floors now receive the same green emphasis as other direct endpoints, and all active routes share one stepped route-layer animation instead of creating one continuous animation per route. Verified two-flow endpoint union and all 105 component floor faces in the rendered browser, 120 FPS equal to idle, and a 75% reduction in five-second main-thread TaskDuration. The focused flow/SVG suite passes 31/31 and all flow, projection, map, and SVG tests pass in the wider viewer run. The repository-wide check remains limited by reproducible host EMFILE/EADDRINUSE watcher and ephemeral-server failures outside this change.
<!-- SECTION:FINAL_SUMMARY:END -->
