---
id: TASK-17.1
title: Prove the semantic-zoom library foundation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-29 20:29'
updated_date: '2026-07-30 16:31'
labels: []
dependencies: []
references:
  - groma/plans/04-semantic-zoom-viewer/README.md
modified_files:
  - package.json
  - bun.lock
  - src/spikes/semantic-zoom/index.html
  - src/spikes/semantic-zoom/fixture.mjs
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/styles.css
  - groma/plans/04-semantic-zoom-viewer/README.md
  - >-
    groma/plans/04-semantic-zoom-viewer/systems/groma/containers/viewer/container.md
  - >-
    groma/plans/04-semantic-zoom-viewer/systems/groma/containers/viewer/components/canvas.md
  - test/architecture-reader.test.mjs
  - test/validate-architecture.test.mjs
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the implementer opens each disposable candidate spike and pans or zooms its map, it must reproduce the approved example: a software-system card occupies a fixed boundary; zooming through the Containers landmark reveals three already-nested container cards without moving the boundary or making cards jump in size; zooming through Components repeats the effect for nested components across the map. Compare AntV G6, an MIT-licensed graph visualization library with nested combos and zoom behaviors, with MSAGL.js, an MIT-licensed graph library whose WebGL viewer provides tile-based semantic zoom and subgraphs. Judge them on this interaction, not feature lists. The result selects a library and records evidence; it does not build a reusable rendering abstraction or production viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each candidate uses the same deterministic fixture: the fixed Groma scene from Revision 04 plus synthetic component cards and relationships until the scene contains at least 500 components distributed across its containers. Both candidates receive identical component IDs, containment, relationships, and fixed world positions.
- [x] #2 The test scene supports pan and continuous zoom and proves whether Context, Containers, and Components can become globally primary at named zoom thresholds without changing their world geometry.
- [x] #3 The test proves whether Groma-style cards, nested boundaries, labels, and relationship lines remain crisp and readable at the level where they are primary, including while navigating the 500-component scene.
- [x] #4 The result names one selected library and records concise observed evidence in Implementation Notes for its camera, nested grouping, zoom-aware visibility, styling, React integration, and behavior with at least 500 components.
- [x] #5 If neither candidate demonstrates the approved interaction, work stops and the observed limitation is recorded in Implementation Notes; no custom SVG, Canvas, WebGL renderer, compatibility layer, fallback, or third candidate is implemented without approval.
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
1. Add only the two candidate libraries and a deterministic disposable fixture that expands Revision 04 to at least 500 components with fixed positions and relationships.
2. Mount AntV G6 and MSAGL.js in a small React comparison page, mapping the identical fixture into each library without changing Groma production viewer or building a shared renderer abstraction.
3. Exercise Context, Containers, and Components zoom levels in the browser, inspect crispness and geometry, capture component count and rendering evidence, and record the selected library or hard-stop limitation in Implementation Notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Selected AntV G6. The deterministic comparison fixture contains exactly 500 components and 508 relationships. It preserves Revision 04’s people, external systems, three containers, seven authored component IDs and containment, and all 18 authored relationships before appending synthetic data; both adapters receive that same fixture and use the same stable IDs.

Browser evidence at 1440×900: G6 mounted in React without application errors, supported wheel/pan plus the shared plus, minus, slider, and named landmarks, and switched Context (0.38×), Containers (0.82×), and Components (2.15×) globally. Observed initial render was approximately 220–263 ms and level switches approximately 75–110 ms. Groma cards, nested rectangular boundaries, labels, and relationship lines remained readable at their primary level. Comparing every card and system/container key-shape bound immediately before and after each visibility switch reported fixed geometry unchanged.

MSAGL.js received the same 500-component fixture but its public WebGL setGraph flow performs its own layout instead of accepting the supplied fixed world positions. With the authored cross-boundary relationships it failed layout/render with containsPoint/directed errors and provides no equivalent public C4 landmark control. It is rejected; no custom renderer or geometry adapter was added.

Correction history: the first synthetic fixture obscured authored component IDs and the first geometry metric covered nodes only. The cold simplicity review caught both; the fixture now preserves the authored scene and the metric covers card and nested boundary key-shapes.

Verification: disposable Vite production build passed; fixture assertion reported 500 components, 508 relationships, and preserved authored components; npm run check passed architecture validation for all five revisions and 107/107 tests. The comparison-only bundle warns about MSAGL transitive eval and bundle size; this is losing-candidate spike evidence, not production hardening scope.

Final verification rerun: one complete check intermittently observed an extra event in the pre-existing source-refresh timing test. The focused source-refresh suite then passed 5/5 and the complete gate passed 107/107 without any unrelated code change.

Selection-authority correction: this completed spike is valid evidence only for its G6/MSAGL comparison. It does not establish the best Groma renderer because React Flow and other candidates were outside its task scope. TASK-17.4 through TASK-17.7 now perform the approved complete selection process.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compared AntV G6 and MSAGL.js with one deterministic Revision 04 fixture expanded to 500 components and 508 relationships. Selected G6 because it preserves fixed card and nested-boundary geometry across readable global Context, Containers, and Components thresholds; rejected MSAGL because its public viewer relayouts the graph and fails on the authored cross-boundary scene. Verified through the live browser, a disposable Vite build, fixture assertions, architecture validation, and 107 passing tests.

Scope clarification: G6 is the winner only of this two-candidate comparison, not the final Groma library selection.
<!-- SECTION:FINAL_SUMMARY:END -->
