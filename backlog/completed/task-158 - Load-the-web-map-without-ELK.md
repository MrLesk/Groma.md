---
id: TASK-158
title: Load the web map without ELK
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 19:56'
updated_date: '2026-08-23 20:41'
labels: []
dependencies: []
references:
  - world-loader
  - world-layout
  - sheet
  - web-server
  - backlog-plugin
  - render
modified_files:
  - src/types.ts
  - src/core.ts
  - src/world-layout.ts
  - src/element-order.ts
  - src/sheet/place.ts
  - src/sheet/scene.ts
  - src/sheet/route.ts
  - src/sheet/types.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/work/pins.ts
  - src/viewers/action-path.ts
  - src/viewers/web/url.ts
  - src/viewers/web/flow/details.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/tui/tree.ts
  - src/viewers/tui/navigation.ts
  - test-bun/web-no-elk.test.ts
  - test-bun/sheet-scene.test.ts
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/core/components/world-layout.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - test/plain-world.test.ts
  - test/world-layout.test.ts
  - test/core.test.ts
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer opens or refreshes the web viewer, Groma builds the semantic architecture world and web sheet without running ELK. Web ordering must come from architecture meaning rather than coordinates produced by another layout engine. The TUI may keep its current layout until a later shared-layout decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Starting and refreshing the web viewer does not import, initialize, or run ELK
- [x] #2 The web map preserves deterministic containment and element ordering from semantic architecture data, without reading ELK-produced bounds as ordering authority
- [x] #3 The TUI continues to load and navigate its current world without behavior changes
- [x] #4 Focused concurrent tests and a measured web load prove the web path skips ELK while preserving the supported map flow
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
1. Move stable relationship IDs into the semantic annotated architecture so they do not depend on a layout engine.
2. Let the sheet and web payload consume the annotated semantic model directly, using deterministic semantic sibling order with no bounds reads.
3. Keep loadArchitectureViewModel and its ELK world unchanged for the terminal viewer.
4. Add an import-boundary test proving the web server graph excludes world-layout and elkjs, verify semantic ordering, measure startup, and run the TUI and full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a geometry-free ArchitectureGraph contract. Annotated relationships now receive stable IDs in core before any layout. The web server loads that semantic graph and sends it directly to the existing sheet, whose sibling order is meaning rank plus representation identity and never reads bounds. loadArchitectureViewModel dynamically loads world-layout only for callers such as the TUI, so terminal behavior and its coordinate order remain unchanged.

Cold simplicity review found no blockers. Accepted its reductions: AnnotatedArchitectureModel now extends ArchitectureGraph, and the ordering test loads annotated architecture directly instead of invoking ELK. The full-context architecture review found no blockers and judged this the simpler, safer boundary for junior developers; it noted only a non-blocking pre-existing ownership issue where shared hierarchy state still lives under viewers/tui.

Objective evidence: the complete web-server bundle contains no elkjs, elk-worker, or world-layout code; an adversarial sheet test reverses elements and supplies false bounds but produces the identical sheet; 49/49 focused tests pass across web startup/refresh, sheet, core/world layout, and TUI lifecycle/navigation/tree; typecheck and diff check pass; the complete suite passes 270/270. Browser QA rendered the current 51-element Groma map with 12 flows and 56 routes. On the same small fixture, median start fell from about 314 ms with ELK to about 94 ms without it. The current Groma map still measured roughly 2.3–2.6 s, proving the remaining cost is in the web sheet pipeline rather than ELK.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web viewer now loads a semantic architecture graph and builds its sheet without importing or running ELK. Stable relationship IDs and semantic ordering no longer depend on layout geometry, while the TUI keeps its existing ELK world. Bundle, adversarial ordering, TUI lifecycle, browser, type, focused, and full-suite checks pass; measured startup confirms ELK is gone but also shows the current sheet pipeline remains the larger performance cost.
<!-- SECTION:FINAL_SUMMARY:END -->
