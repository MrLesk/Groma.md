---
id: TASK-17.5.1
title: Prove React-family and existing semantic-zoom renderers
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:41'
updated_date: '2026-07-30 19:43'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - package.json
  - bun.lock
  - playwright.semantic-zoom.config.mjs
  - e2e/semantic-zoom-proofs.spec.js
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/styles.css
  - src/spikes/semantic-zoom/zoom-controls.jsx
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/proofs/g6-proof.jsx
  - src/spikes/semantic-zoom/proofs/projectstorm-proof.jsx
  - src/spikes/semantic-zoom/proofs/rete-proof.jsx
  - src/spikes/semantic-zoom/proofs/gravity-proof.jsx
  - src/spikes/semantic-zoom/proofs/kgraph-proof.jsx
  - src/spikes/semantic-zoom/proofs/react-easy-diagram-proof.jsx
  - src/spikes/semantic-zoom/proofs/flowgram-proof.jsx
  - src/spikes/semantic-zoom/proofs/react-dag-editor-proof.jsx
  - test/semantic-zoom-comparison.test.mjs
parent_task_id: TASK-17.5
priority: high
type: spike
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects AntV G6, ProjectStorm React Diagrams, Rete, Gravity UI Graph, KGraph, React Easy Diagram, FlowGram, and Microsoft React DAG Editor in the disposable Revision 04 library comparison, each candidate receives the same approved seven-component Groma scene and is exercised through its own documented public APIs. These candidates survived official-documentation screening, so each requires a live browser harness; a failure is valid only when the harness reproduces a runtime/browser error or exposes a decisive public-API limitation. The result updates the existing 131-candidate comparison without selecting a winner or changing the production viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every named candidate has a selectable live harness using the shared stable IDs, containment, relationships, dimensions, fixed world coordinates, and Context 0.38, Containers 0.82, and Components 2.15 landmarks.
- [x] #2 Each harness supports native wheel zoom and drag pan plus visible shared plus, minus, continuous-slider, and named-landmark controls through the candidate's documented public zoom API.
- [x] #3 Each passing harness changes global visibility and emphasis without relayout, geometry jumps, or card-size jumps and shows readable primary-level cards and relationships.
- [x] #4 Each candidate ends with browser evidence or a reproduced runtime/API failure in the 131-candidate comparison; no candidate remains marked live-proof-required.
- [x] #5 The proof adds no custom SVG, Canvas, WebGL, geometry, camera, cross-library adapter, compatibility, fallback, hardening, benchmark, or production-viewer behavior.
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
1. Keep the shared 131-candidate evidence index, seven-component fixture, 18 authored relationships, and Context 0.38, Containers 0.82, and Components 2.15 landmarks as the common proof contract.
2. Give each assigned renderer its own disposable candidate module using only its documented scene, viewport, visibility, style, and template APIs; share only fixture data, landmarks, visible controls, and comparison presentation.
3. Preserve live public-API proofs for G6, Rete, Gravity UI Graph, KGraph, React Easy Diagram, and FlowGram; preserve the smallest mounted reproducers for ProjectStorm's React 19 runtime failure and Microsoft React DAG Editor's 150×150 built-in node limitation.
4. Exercise every live proof in the browser through fresh Context load, named landmarks, plus, minus, slider, native wheel zoom, and drag pan; assert native camera/config deltas, fixed viewport-normalized geometry, level-aware readable relationships, and empty page/console errors.
5. Verify the eight terminal outcomes and 131-row invariant with focused comparison and browser tests, then run architecture validation, the complete test suite, disposable production build, diff checks, cold simplicity review, specification review, and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented terminal mounted evidence for all eight assigned candidates without a cross-library adapter. Browser-pass live proofs: AntV G6, Rete, Gravity UI Graph, KGraph, React Easy Diagram, and FlowGram. ProjectStorm 7.0.4 reproducibly fails inside CanvasWidget under React 19 with 'A React Element from an older version of React was rendered.' Microsoft React DAG Editor mounts and exercises its public viewport, but its built-in rect enforces 150x150; exact authored 54x30 cards require the AC5-prohibited custom SVG node renderer, so it is recorded as a decisive API limitation. Browser exercise covered named 0.38/0.82/2.15 landmarks, plus, minus, slider, native wheel, and drag pan for passing proofs; fixed 15-element/18-relationship mapping remained intact. Verification: focused comparison 4/4; npm test 111/111; architecture validation 5 revisions, 51 elements, 52 relationships; Vite production build passed with the reproduced ProjectStorm dependency Path warning; git diff --check clean. Required cold simplicity review and one targeted re-review passed after deleting a FlowGram write-only ref, a redundant KGraph viewport read, and unreachable ProjectStorm control state. Task remains In Progress for fresh specification and quality review; no commit created.

Correction pass repaired only the five specification-review findings. Rete now uses its native area translation as the pan signal, cancels node translation so authored geometry stays stable, and renders classic library connections with context, containers, and components relationship emphasis. FlowGram now enters its documented mouse-friendly editor state, clears geometric hover at capture so the native grab starts through the full-size system boundary, and records wheel or pan only after config zoom or scroll actually changes; line classes come from public relationship data. KGraph now lets its native pane receive drag through the system boundary and records pan only after viewport x or y changes. React Easy Diagram now uses the documented diagramPan setting, routes gestures to the native diagram through node and secondary-link hit layers, observes DiagramState zoom and offset changes, and uses the default library link renderer with relationship-level classes. Gravity UI Graph now uses documented block-center connection ports, making architecture-model to canvas and the other relationships readable at the approved component-card geometry. Wrapper pointer and wheel false positives were removed. Focused Playwright behavior tests prove Rete node geometry stability plus viewport movement, FlowGram zoom and scroll changes, KGraph viewport movement, React Easy Diagram offset movement, relationship opacity separation, and Gravity connection-canvas pixels: 5 of 5 passed repeatedly. Browser QA found no console warnings or errors, page errors, or Vite error overlay on the five routes. The in-app Browser exposed navigation and DOM inspection but not the documented screenshot or pointer APIs, so the permitted repository Playwright fallback performed interaction and screenshot validation. Final checks: focused comparison 4 of 4; architecture validation 5 revisions, 51 elements, 52 relationships; npm test 111 of 111; disposable Vite production build passed with only the already reproduced ProjectStorm dependency warning; git diff --check clean. One unrelated source-refresh watcher observation failed transiently, then its exact test passed and the complete suite passed on rerun. The required cold simplicity review removed unused connection render state and Gravity anchor machinery before the final checks. G6, ProjectStorm, and React DAG proof behavior was unchanged, the 131-candidate invariant remains intact, and all eight assigned candidates retain terminal evidence. Task remains In Progress and uncommitted for targeted specification re-review.

Final FlowGram blocker correction: the original review finding reproduced exactly after Components settled. All 18 line wrappers existed with correct relationship classes, but the exact architecture-model to canvas primary path remained d="" for the full Playwright timeout. The strengthened browser test now targets that relationship through its FlowGram from-node and to-node data attributes and requires the primary path, not its arrow glyph or wrapper, to have real M-prefixed geometry. Root cause tracing showed the line layer first computed before FlowGram registered its built-in line contributions, leaving render data empty. An initial child-effect hypothesis also ran before plugin ready, failed unchanged, and was removed. The live fix uses the existing public onReady lifecycle and FlowGram public line manager switchLineType primitive, the same primitive exposed by its documented toolbar hook, to select a registered built-in line renderer and force native line-data recomputation after plugin setup. No custom SVG, geometry, renderer, or adapter was added. RED: the exact path stayed empty and the targeted test failed 1 of 1. GREEN: the targeted test passed 1 of 1; runtime inspection found 18 of 18 non-empty primary paths, architecture-model to canvas had M-prefixed geometry, 0.92 settled component emphasis, and a non-zero SVG box. Visual inspection showed built-in orthogonal connections between the approved component cards with no console errors or Vite overlay. Cold simplicity review passed with no authority-backed finding; its direct Playwright attribute assertion and one-line lifecycle rationale were applied. Final verification: focused browser 5 of 5, focused comparison 4 of 4, npm test 111 of 111, architecture validation 5 revisions with 51 elements and 52 relationships, disposable Vite production build passed with only the already reproduced ProjectStorm dependency and chunk-size warnings, and git diff --check clean. FlowGram remains a live proof, TASK-17.5.1 remains In Progress and uncommitted, and this handoff is limited to the original relationship-geometry blocker for final targeted review.

Quality-review correction pass resolved only the two reported blockers. FlowGram root cause was onInit pre-seeding PlaygroundConfigEntity with 0.38 before the native pipeline existed, so onAllLayersRendered requested an unchanged value and never applied a native scale transition. Removing that pre-seed lets the existing public lifecycle call apply Context 0.38 and approved centering on fresh load. Focused browser evidence now independently requires data-zoom 0.38 and architecture-model viewport-normalized geometry 54 by 30 with approved offsets -242 and -261 before any interaction. G6 and Gravity no longer report interaction from wrapper input alone: both arm the relevant native input and mark evidence only after public/native camera scale or position changes. G6 samples its canvas camera after Graph AFTER_TRANSFORM; its documented drag-canvas enable option is true because the fixed-world system node otherwise covers the viewport and the default canvas-only target filter prevents native pan. Gravity consumes the direct public onCameraChange camera-state payload rather than incorrectly destructuring a nested camera field. Synthetic stage wheel and slider drag remain ready, while actual wheel and canvas drag produce zoom and x/y deltas before the visible status becomes observed. RED was 3 of 3 intended failures: G6 wrapper wheel false-positive, FlowGram fresh native geometry false, and Gravity wrapper wheel false-positive. An additional visual-QA RED pinned a G6 development-lifecycle page error caused by reading a partial/destroyed graph; the observer now uses the current graph ref and one native camera snapshot, and the focused test requires zero page errors. GREEN: focused correction browser 3 of 3 and complete browser 7 of 7. In-app Browser navigation and DOM inspection succeeded but its available locator/screenshot surface lacked boundingBox and screenshot, so the permitted repository Playwright fallback supplied geometry, pointer, screenshot, console, page-error, and Vite-overlay evidence. Fresh visual inspection found FlowGram 0.38 geometry and centering, G6 and Gravity Context views, and no candidate console warning/error, page error, or Vite overlay. Broad verification: focused comparison 4 of 4; npm test 111 of 111; architecture validation 5 revisions, 51 elements, 52 relationships; disposable Vite production build passed with only the already reproduced ProjectStorm dependency and chunk-size warnings; git diff --check and explicit untracked-file whitespace checks were clean. The required cold simplicity review initially found the fresh landmark needed an independent 0.38 assertion, G6 had a redundant ready gate, and FlowGram JSX alignment could be clarified; all three were applied. The one permitted targeted re-review passed, and post-simplification checks were focused browser 3 of 3, complete browser 7 of 7, comparison 4 of 4, and clean diff checks. TASK-17.5.1 remains In Progress and uncommitted for targeted quality re-review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the React-family semantic-zoom proof batch without committing. The 131-candidate comparison now contains terminal evidence for all eight assigned renderers: live public-API proofs for AntV G6, Rete, Gravity UI Graph, KGraph, React Easy Diagram, and FlowGram; a reproduced ProjectStorm React 19 CanvasWidget runtime failure; and a mounted Microsoft React DAG Editor limitation showing its normal nodes render at 150×150 instead of the authored 54×30. Browser tests prove fresh Context state, all landmarks and controls, native camera deltas, stable geometry, level-aware readable relationships, and no page/console errors. Focused browser tests passed 7/7, comparison tests 4/4, full tests 111/111, architecture validation passed all five revisions, the production build passed with known evidence-related warnings, and diff checks passed. Cold simplicity, specification, and quality reviews all passed after targeted corrections.
<!-- SECTION:FINAL_SUMMARY:END -->
