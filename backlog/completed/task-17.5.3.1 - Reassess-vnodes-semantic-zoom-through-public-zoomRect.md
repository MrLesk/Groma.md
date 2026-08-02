---
id: TASK-17.5.3.1
title: Reassess vnodes semantic zoom through public zoomRect
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 20:51'
updated_date: '2026-07-30 21:07'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
  - 'https://github.com/tiagolr/vnodes/blob/master/src/components/Screen.vue'
modified_files:
  - src/spikes/semantic-zoom/proofs/vnodes-proof.jsx
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/styles.css
  - test/semantic-zoom-comparison.test.mjs
  - e2e/semantic-zoom-proofs.spec.js
parent_task_id: TASK-17.5.3
priority: high
type: spike
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects vnodes in the disposable Revision 04 library comparison, Groma must exercise the documented public `Screen.zoomRect(rect, { zoom })` API against the same approved seven-component semantic-zoom scene. The reassessment determines whether vnodes can replace its current `zoomTo` runtime-failure outcome with a live proof at the exact Context 0.38, Containers 0.82, and Components 2.15 landmarks. The reviewed `zoomTo` evidence remains valid history; this task changes the comparison outcome only if the complete supported product flow passes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The selectable vnodes harness uses the shared stable IDs, containment, dimensions, fixed world coordinates, and all 18 native relationships without relayout or geometry changes.
- [x] #2 Visible Context 0.38, Containers 0.82, Components 2.15, plus, minus, and continuous-slider controls use documented public `zoomRect` behavior and reach their exact requested scales.
- [x] #3 Native wheel zoom and drag pan work alongside the controls, while semantic visibility and relationship emphasis change without card-size or geometry jumps and primary-level cards remain readable.
- [x] #4 Browser evidence updates the 131-candidate comparison from vnodes runtime failure to live proof only if the complete flow passes; otherwise it records the reproduced `zoomRect` API/runtime limitation with an authoritative source.
- [x] #5 The reassessment adds no fallback, private API, custom camera, custom relationship or scene geometry, cross-library adapter, compatibility behavior, hardening, benchmark, or production-viewer change.
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
1. Keep the focused vnodes browser proof as the regression boundary for the complete shared-scene flow through public Screen.zoomRect.
2. Drive the initial view, Context 0.38, Containers 0.82, Components 2.15, plus, minus, and slider through Screen.zoomRect(rect, { zoom }), using rectangles derived only from the approved shared fixture.
3. Retain the existing native Screen, Node, and Edge integration, fixed world geometry, semantic styling, native wheel zoom, and native drag pan.
4. Record vnodes as a live proof with the authoritative Screen.zoomRect source because the complete browser flow passes.
5. Verify the focused comparison and browser proof, full semantic-zoom browser suite, full project check, disposable build, and task-scoped whitespace.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research and public API evidence:
- Confirmed installed vnodes 2.0.0 and read its complete public Screen implementation. Screen.zoomRect(rect, { zoom }) computes the centered native pan, calls svg-pan-zoom.zoom, and passes the required point object to svg-pan-zoom.pan: https://github.com/tiagolr/vnodes/blob/master/src/components/Screen.vue#L85-L105.
- The reassessment uses only the existing native Screen, Node, and Edge components. Context targets the bounds of all approved scene elements, Containers targets the approved system/container bounds, and Components targets the four authored Viewer components. These rectangles are inputs to the documented API; no renderer, camera replacement, relationship geometry, scene geometry, fallback, private access, compatibility behavior, hardening, benchmark, or production-viewer behavior was added.

TDD and correction history:
- Replaced the old terminal browser expectation with the complete zoomRect proof expectation first. `npm run test:semantic-zoom:browser -- --grep="vnodes proves"` failed while the harness still called zoomTo and reproduced `Failed to set the e property on SVGMatrix: The provided double value is non-finite` from mount and controls.
- After switching only the public camera calls, the test exposed that vnodes emits its zoom callback before the HTML-layer CTM update. A disposable browser probe showed the native transform progresses 0.38 -> 0.82 -> 2.15 with normalized 54x30 cards and no errors. The test was corrected to poll rendered geometry at the actual CTM boundary; no synchronization fallback or production workaround was added.
- Added the comparison-result expectation before changing evidence. `node --test --test-name-pattern="vnodes records live proof" test/semantic-zoom-comparison.test.mjs` failed with actual runtime-failure versus expected live-proof, then passed after the evidence row changed to the authoritative zoomRect source.

Browser outcome:
- The selected vnodes proof mounts all 15 stable-ID elements and all 18 native `path.edge` relationships from the shared fixture. Literal browser assertions preserve Architecture model at x=858, y=294, 54x30 and Viewer at x=820, y=210, 630x760; the component remains visibly contained in Viewer.
- Plus and minus reach exact 1.2x steps; the continuous slider reaches its exact requested scale; named controls reach 0.38, 0.82, and 2.15. Normalized component geometry remains 54x30 at every landmark, the Components card renders above 100 px wide with visible label text, and relationship opacity remains mixed by semantic level. Native wheel zoom and native drag pan both change the vnodes transform and mark their interaction status observed. No page or console errors occur.
- The 131-candidate comparison now records vnodes as live-proof. Counts are 13 live-proof, 104 api-limitation, 1 runtime-failure, and 13 live-proof-required.

Verification:
- Focused comparison: `node --test test/semantic-zoom-comparison.test.mjs` -> 7 passed.
- Focused browser: `npm run test:semantic-zoom:browser -- --grep="vnodes proves"` -> 1 passed.
- Full browser: `npm run test:semantic-zoom:browser` -> 14 passed.
- Full project: `npm run check` -> architecture validation passed for 5 revisions / 51 elements / 52 relationships; 114/114 tests passed.
- Disposable build: `bunx vite build src/spikes/semantic-zoom --outDir <temporary-directory>` -> 3927 modules built successfully. Existing third-party warnings remain for LiteGraph direct eval, ProjectStorm Path namespace usage, and aggregate chunk size.
- `git diff --check` plus no-index whitespace checks for all five task-touched untracked files passed. Scope search confirms vnodes uses zoomRect only and no vnodes runtime alert remains.

Review and finalization evidence:
- Cold simplicity review: PASS. Specification review: PASS. Quality review: PASS. No authority-backed blocking findings remain.
- One unrelated source-watcher test transiently failed while the full check ran concurrently with the browser suite; it passed in isolation, and a subsequent sequential full check passed 114/114. Classified non-blocking because the failure was outside this task and did not reproduce sequentially.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reassessed vnodes 2.0.0 through documented public Screen.zoomRect and promoted it from the retained zoomTo runtime failure to live proof. The native 15-element, 18-relationship scene reaches exact 0.38/0.82/2.15 landmarks plus shared controls, preserves fixed normalized geometry and readable semantic emphasis, and supports native wheel zoom and drag pan without prohibited fallback or custom camera/geometry. Verified by focused comparison 7/7, focused browser 1/1, full browser 14/14, sequential project check 114/114, successful 3,927-module disposable build, task-scoped whitespace checks, and passing simplicity/specification/quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
