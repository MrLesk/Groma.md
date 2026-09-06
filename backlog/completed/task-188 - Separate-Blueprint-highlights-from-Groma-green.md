---
id: TASK-188
title: Separate Blueprint highlights from Groma green
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 15:40'
updated_date: '2026-08-27 15:45'
labels: []
dependencies: []
references:
  - shell
  - page
  - iso-map
  - flow-controls
  - project-editor
  - work-overlay
modified_files:
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/page.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/work/island.ts
  - src/viewers/web/work/pins.ts
  - test-bun/theme.test.ts
type: enhancement
ordinal: 200000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect uses the Web viewer in Blueprint theme, Groma shows selected, focused, and active-flow states in a near-white blueprint highlight while keeping Groma green for brand and positive completion status. Hover remains visually quieter and distinct from durable selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Blueprint selected map surfaces and routes use a near-white blue highlight instead of Groma green
- [x] #2 Blueprint focus and active interactive states use the same highlight language while green remains for brand and completion status
- [x] #3 Map hover uses a quieter mid-cyan signal and remains distinct from selection; panel hover washes remain unchanged
- [x] #4 Light and dark themes keep their current appearance and all changed foreground/background pairs meet 4.5:1 contrast
- [x] #5 Theme cycling, selection, F2 layers, flows, work status, pan, and zoom keep their existing behavior
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
1. Separate the shared green brand/status token from a theme-specific interaction highlight.
2. Route focus, selection, active-flow geometry, and active controls through the highlight roles.
3. Keep Blueprint panel hover wash unchanged and move map hover strokes to the quieter map-line role.
4. Preserve green for the Groma mark and completed-state surfaces.
5. Add token/contrast tests, verify all themes and interactions in the browser, then run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design decision: Blueprint uses near-white blue for durable interaction emphasis, mid-cyan for transient map hover, and green only for product identity and positive/completion status.

- Implemented one theme-specific interaction highlight role while keeping the existing green accent as the brand and positive-status role. Light and dark map to the current green, so their appearance does not change; Blueprint reuses its existing white-blue ink for highlight instead of adding another colour.
- Browser QA at `http://localhost:4747/?system=groma&theme=blueprint`: selected geometry and active flow routes/checks resolve to `#D8F3FF`; map hover rules resolve to the quieter `#64B7D6`; completion surfaces remain `#1D9E75`; the panel hover wash remains `rgba(89, 203, 244, 0.09)`. F2 showed three layers and preserved selection/flow state; theme cycling kept green highlights in light/dark and white-blue only in Blueprint; selection moved to Coding agent, zoom changed 100% to 125%, Fit restored the map, and the console remained clean.
- Focused tests pass: 15 tests across theme, page, work pins/badges, and layer mode.

- Direct simplicity review (no agents, per request): the flow is palette → CSS variables → existing map/control/work CSS. Both `highlight` and `highlightText` are required because light-theme green is suitable as geometry/background but needs a darker value as text. Reusing Blueprint ink avoids a new decorative colour. No state, module, selector family, or compatibility path was added; all changed source files remain below 500 lines. No simpler change preserves brand/status green and the three interaction levels as clearly for a junior developer.
- Repository check is currently blocked outside TASK-188 by incomplete TASK-183 layer-mode work in the shared workspace: `createLayerView`/`sceneForLayerMode` exports are missing and projected-map signatures are changing. Before that external edit, TASK-188 focused tests passed 15/15. After it, the task-owned theme, pin, and badge tests pass 10/10; only the page bundle test reaches the unrelated missing export. Browser validation of the built TASK-188 flow completed before the external break and had no console warnings or errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated Blueprint interaction emphasis from Groma green. Selected/focused surfaces, active flows, active controls, and selected work pins now use the theme highlight; Blueprint resolves it to white-blue while light/dark retain green. Transient map hover uses mid-cyan, panel hover is unchanged, and green remains for Groma identity and completed status. Browser QA verified selection, flows, F2, theme cycling, zoom/Fit, status colour, and a clean console; task-owned tests passed, while the full check remains externally blocked by incomplete TASK-183 layer exports in the shared workspace.
<!-- SECTION:FINAL_SUMMARY:END -->
