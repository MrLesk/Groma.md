---
id: TASK-17.5.2
title: Prove mainstream framework-neutral graph renderers
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:41'
updated_date: '2026-07-30 20:18'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17.5
priority: high
type: spike
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects AntV X6, vis-network, LiteGraph.js, Drawflow, diagram-js, and Butterfly DAG in the disposable Revision 04 library comparison, each candidate receives the same approved seven-component Groma scene and is exercised through its own documented public APIs. These candidates survived official-documentation screening, so each requires a live browser harness; a failure is valid only when the harness reproduces a runtime/browser error or exposes a decisive public-API limitation. The result updates the existing 131-candidate comparison without selecting a winner or changing the production viewer.
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
1. Add a focused comparison invariant that requires terminal evidence for all six assigned candidates while preserving the 131-row inventory.
2. Add exact-version dependencies and independently selectable native mounts for AntV X6, vis-network, LiteGraph.js, Drawflow, diagram-js, and Butterfly DAG using the shared Revision 04 fixture and landmarks.
3. Implement public-API live proofs for X6 and Butterfly DAG; retain mounted native evidence for vis-network, LiteGraph.js, Drawflow, and diagram-js with their decisive public-model limitations, without custom rendering, geometry, camera, adapters, or fallback behavior.
4. Verify the passing proofs through native camera deltas, landmark geometry and style stability, readable cards, and relationship output; verify the four limitations through mounted public API or serialized native evidence.
5. Record the six outcomes in the 131-candidate comparison and experiment document, then run focused and full browser/tests, architecture validation, a disposable production build, and tracked/untracked deliverable checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD evidence: added `the assigned framework-neutral candidates all have terminal proof evidence` first and observed `node --test test/semantic-zoom-comparison.test.mjs` fail specifically with `antv-x6 still needs a live proof`; the pre-existing 131-row and React-family checks remained green.

Implementation: added exact current package versions and six independently selectable mounts. AntV X6 3.1.7 and Butterfly DAG 5.1.0-beta.38 render the shared 15-element/18-relationship fixture with native containment, fixed authored dimensions/coordinates, public templates/styles, native viewport APIs, and the shared controls. vis-network 10.1.0, LiteGraph.js 0.7.18, and Drawflow 0.0.60 mount 15 nodes and 18 relationships but reproduce flat/non-owning public models. diagram-js 15.23.2 mounts 15 nested shapes and reproduces `must supply { waypoints } with connection`; no caller-authored custom relationship geometry was added. The human experiment document records these outcomes without selecting a winner.

Correction history from focused browser replay: X6 v3 `centerCell` requires a Cell rather than an ID; corrected calls to use `getCellById`. Butterfly Group retains template data under its documented `options` object; corrected the group data and delayed ready state until native zoom reached Context. LiteGraph replaces duplicate single-slot connections; assigned one native input/output slot per authored relationship, producing all 18 native links. vis-network initially rendered the fixed world offscreen; centered the native viewport on the authored world and disabled automatic resize, producing visible Canvas pixels without resize-loop errors.

Verification to date: focused comparison 5/5; architecture validation passed all 5 revisions including Revision 04 at 15 elements/18 relationships; focused new Playwright 3/3; complete semantic-zoom Playwright 10/10; full `npm test` 112/112; disposable Vite production build completed; production preview mounted all six candidates with empty page/console errors. Build emitted existing third-party warnings from ProjectStorm namespace import and LiteGraph direct eval plus the bundle-size advisory. `git diff --check` and explicit untracked-file whitespace checks reported no whitespace errors.

### Cold simplicity review

- Result: one small simplification accepted. The reviewer found that X6 React translation state and Butterfly React offset state duplicated camera evidence already read directly from each native public instance.
- Applied: removed the mirrored translation/offset state updates and the data-camera-x/data-camera-y stage attributes from both live proofs. Native scale/move observers still update only user-visible zoom level and interaction status.
- Focused verification after the simplification: comparison tests 5/5 passed; framework-neutral Playwright tests 3/3 passed; git diff --check passed; no stale mirrored-camera identifiers remain in either proof.
- Scope stayed limited to deletion; no behavior, fallback, renderer, geometry, camera layer, or test path was added.

Targeted simplicity re-review: PASS. The reviewer confirmed the original mirrored-camera finding is fully resolved, the native public instances remain the single camera-evidence path, and the deletion introduced no focused comparison, browser, or whitespace regression.

### Quality review corrections

- Public evidence blocker: the terminal-attempt browser test had read vis-network internals through network.body.data and LiteGraph private _nodes/_groups arrays. The corrected vis-network mount supplies public DataSet instances and the test now verifies 15 positions through Network.getPositions(), 18 connected edge IDs through Network.getConnectedEdges(), and the flat 15-node/18-edge DataSet model. LiteGraph now verifies its 15 nodes, 18 links, and zero groups through LGraph.serialize(). No adapter or candidate behavior changed.
- Artifact blocker: the generated untracked src/spikes/semantic-zoom/dist directory was moved outside the repository to /tmp/groma-semantic-zoom-dist.muJAPI/dist. The production build was rerun with its output directed to /tmp/groma-semantic-zoom-build.2raTHc, so the deliverable contains no generated dist artifact.
- Fresh verification after both corrections: focused comparison 5/5; focused framework-neutral Playwright 3/3; complete semantic-zoom Playwright 10/10; full npm test 112/112; architecture validation passed 5 revisions; disposable production build passed with the previously recorded third-party warnings.
- Final deliverable audit: git diff --check and git diff --cached --check returned no errors; a separate scan of every untracked file found no trailing whitespace; src/spikes/semantic-zoom/dist is absent; the focused browser test contains no network.body.data, graph._nodes, or graph._groups access.

Targeted quality re-review: PASS. The reviewer confirmed both original quality blockers are resolved: mounted evidence now uses documented public APIs, the generated repository dist artifact is absent, and the corrections introduced no focused regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added independently selectable public-API attempts for all six mainstream framework-neutral candidates while preserving the 131-row comparison. AntV X6 and Butterfly DAG pass the fixed-world semantic-zoom proof; vis-network, LiteGraph.js, Drawflow, and diagram-js retain mounted native evidence for decisive model/API limitations. Verified with comparison 5/5, focused Playwright 3/3, complete semantic-zoom Playwright 10/10, npm test 112/112, five-revision architecture validation, a disposable production build, tracked/untracked deliverable checks, and passing simplicity, specification, and targeted quality reviews. No production viewer behavior was changed and no commit was created.
<!-- SECTION:FINAL_SUMMARY:END -->
