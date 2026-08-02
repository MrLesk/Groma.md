---
id: TASK-17.5.3
title: Prove Vue-family semantic-zoom renderers
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:41'
updated_date: '2026-07-30 20:50'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - package.json
  - bun.lock
  - src/spikes/semantic-zoom/vite.config.mjs
  - src/spikes/semantic-zoom/proofs/vue-flow-proof.jsx
  - src/spikes/semantic-zoom/proofs/yh-ui-flow-proof.jsx
  - src/spikes/semantic-zoom/proofs/vue-network-graph-proof.jsx
  - src/spikes/semantic-zoom/proofs/vnodes-proof.jsx
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/styles.css
  - test/semantic-zoom-comparison.test.mjs
  - e2e/semantic-zoom-proofs.spec.js
parent_task_id: TASK-17.5
priority: high
type: spike
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects Vue Flow, YH UI Flow, Vue Network Graph, and vnodes in the disposable Revision 04 library comparison, each candidate receives the same approved seven-component Groma scene and is exercised through its own documented public APIs. These candidates survived official-documentation screening, so each requires a live browser harness; a failure is valid only when the harness reproduces a runtime/browser error or exposes a decisive public-API limitation. The result updates the existing 131-candidate comparison without selecting a winner or changing the production viewer.
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
1. Add a focused comparison test requiring Vue Flow, YH UI Flow, Vue Network Graph, and vnodes to leave live-proof-required, and confirm the expected red failure.
2. Add only the four pinned Vue-family packages plus the Vue runtime and Vite tooling required to mount their native components inside the disposable comparison.
3. Implement four isolated candidate proof mounts that consume the shared fixture and shared controls through each library’s documented node, relationship, viewport, wheel, and pan APIs.
4. Exercise each mount in the browser at Context 0.38, Containers 0.82, and Components 2.15; retain a live proof only when fixed geometry, native interactions, readable cards, and semantic relationship emphasis all pass, otherwise record the reproduced public-API/runtime failure.
5. Run focused browser/unit checks, full project checks, diff checks, and record exact verification in Implementation Notes without finalizing the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD evidence:
- Added the assigned Vue-family terminal-evidence test first. `node --test --test-name-pattern="assigned Vue-family" test/semantic-zoom-comparison.test.mjs` failed with `vue-flow still needs a live proof`, then passed after the comparison evidence was implemented.
- Browser QA exposed Vue Network Graph component-label overflow; a containment assertion failed before the node template split component labels into two SVG text lines, then passed.
- Browser QA exposed the vnodes terminal-error alert below the proof stage; a stage-intersection assertion failed before the alert was positioned inside the stage, then passed.

Candidate outcomes:
- Vue Flow 1.48.2: live proof. Native Vue Flow nodes use the shared 15 stable IDs, parent containment, fixed world coordinates and dimensions; 18 native straight relationships remain library-routed. Documented viewport methods drive Context 0.38, Containers 0.82, Components 2.15, plus/minus/slider controls; native wheel zoom and pane drag pan both changed the viewport. Components shows a normalized 54×30 component card, readable primary cards, and mixed relationship/node opacity without relayout.
- YH UI Flow 1.0.63: live proof. Native YH nodes consume the same 15-node scene with parentId/extent containment and 18 native relationships. Documented viewport methods and native wheel/pan worked. The library virtualizes offscreen nodes: Context renders all 15 DOM IDs; Components focuses Viewer and shows 6 visible nodes while retaining the full input and all 18 relationships. The component card is 54×30 and cards/relationships remain readable with semantic emphasis.
- Vue Network Graph 0.9.23: live proof. Native fixed-layout nodes and 18 `.v-ng-line` paths consume the shared scene; documented zoom-level, zoom methods and panTo power the controls while native wheel/pan worked. Its documented node-template slot renders the shared card shape; relationship geometry remains native. Components preserves the 54×30 card and the final two-line label is contained and readable.
- vnodes 2.0.0: reproduced terminal runtime failure, with the native mounted harness retained. The native Screen/Node/Edge components render 15 scene elements and 18 native `path.edge` relationships, but documented `Screen.zoomTo({x,y,scale})` fails because the library calls svg-pan-zoom `pan(x, y)` instead of passing the required point object. Browser error: `Failed to set the 'e' property on 'SVGMatrix': The provided double value is non-finite.` The comparison records runtimeFailure with source `https://github.com/tiagolr/vnodes/blob/master/src/components/Screen.vue#L49-L54`; no fallback, private API, camera replacement, or geometry replacement was added.

Browser evidence:
- Focused Playwright: `npm run test:semantic-zoom:browser -- --grep="vue-flow preserves|yh-ui-flow preserves|vue-network-graph preserves|vnodes retains"` -> 4 passed.
- Full Playwright: `npm run test:semantic-zoom:browser` -> 14 passed.
- Manual in-app browser screenshots: `/tmp/task-17-5-3-vue-flow.png`, `/tmp/task-17-5-3-yh-ui-flow.png`, `/tmp/task-17-5-3-vue-network-graph.png`, `/tmp/task-17-5-3-vnodes-runtime-failure.png`.

Verification:
- `node --test test/semantic-zoom-comparison.test.mjs` -> 6 passed.
- `npm run check` -> architecture validation passed (5 revisions, 51 elements, 52 relationships); 113/113 tests passed.
- Disposable `bunx vite build src/spikes/semantic-zoom` -> 3927 modules built successfully after dependency cleanup. Existing third-party warnings remain for ProjectStorm Path namespace usage, LiteGraph direct eval, and aggregate chunk size; they do not affect these candidates and browser checks pass.
- `git diff --check` -> passed.
- Comparison result counts after this batch: 12 live-proof, 104 api-limitation, 2 runtime-failure, 13 live-proof-required. All four assigned candidates now have terminal evidence.

Scope: each proof is isolated; no cross-library adapter, production-viewer behavior, custom relationship renderer/geometry, replacement camera, compatibility path, fallback, hardening, or benchmark was added. The task remains In Progress with AC/DoD unchecked pending the orchestrator-run simplicity, specification, quality, and finalization reviews.

Targeted simplicity re-review preparation:
- Cold simplicity review found four unused DOM expando properties (`__candidateVueFlow`, `__candidateYhUiFlow`, `__candidateVueNetworkGraph`, and `__candidateVnodes`) plus their matching cleanup deletions. Repository search confirmed these properties were assigned and deleted but never read. Removed only those eight statements; the existing internal instance refs and all accepted behavior/evidence remain unchanged.
- Targeted verification after the simplification: focused Vue-family Playwright -> 4 passed; `node --test --test-name-pattern="assigned Vue-family" test/semantic-zoom-comparison.test.mjs` -> 1 passed; `git diff --check` -> passed; repository search confirms none of the four expando names remains.

Final review:
- Quality review PASS. No authority-backed blocking findings remain after the targeted simplicity fix and verification.
- Non-blocking product follow-up: the quality reviewer found that vnodes also publicly exposes `zoomRect(rect, { zoom })`; a disposable probe reached the Containers 0.82 and Components 2.15 scales. This does not invalidate the reproduced `zoomTo` runtime failure or change this reviewed implementation, but warrants a separate reassessment of vnodes through that documented public API before retaining its comparison outcome.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added isolated native proof harnesses for Vue Flow, YH UI Flow, Vue Network Graph, and vnodes against the shared semantic-zoom scene. Browser evidence qualifies the first three as live proofs and reproduces the documented vnodes `zoomTo` runtime failure; focused Playwright passed 4/4, the full browser suite passed 14/14, project checks passed 113/113, and the disposable Vite build succeeded. Simplicity and quality review findings are resolved or recorded as a separately scoped vnodes `zoomRect` follow-up.
<!-- SECTION:FINAL_SUMMARY:END -->
