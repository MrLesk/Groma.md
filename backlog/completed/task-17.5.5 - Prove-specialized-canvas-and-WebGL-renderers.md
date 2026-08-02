---
id: TASK-17.5.5
title: Prove specialized canvas and WebGL renderers
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:41'
updated_date: '2026-07-30 23:02'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - package.json
  - bun.lock
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/styles.css
  - src/spikes/semantic-zoom/proofs/rgui-proof.jsx
  - src/spikes/semantic-zoom/proofs/meta2d-proof.jsx
  - src/spikes/semantic-zoom/proofs/specialized-limitations.jsx
  - test/semantic-zoom-comparison.test.mjs
  - e2e/semantic-zoom-proofs.spec.js
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17.5
priority: high
type: spike
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects RGUI, Grafloria, Flowscape Core SDK, Xenolith Graph Pixi renderer, Meta2D Core, and AntV F6 in the disposable Revision 04 library comparison, each candidate receives the same approved seven-component Groma scene and is exercised through its own documented public APIs. These candidates survived official-documentation screening, so each requires a live browser harness; a failure is valid only when the harness reproduces a runtime/browser error or exposes a decisive public-API limitation. The result updates the existing 131-candidate comparison without selecting a winner or changing the production viewer.
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
1. Exercise RGUI, Grafloria, Flowscape Core SDK, Xenolith Graph Pixi renderer, Meta2D Core, and AntV F6 through their pinned public packages against the shared Revision 04 scene and comparison controls.
2. Keep RGUI as the live specialized survivor through its public graph, native Canvas renderer, component content scale, exact authored geometry, containment, relationships, and native viewport controls.
3. Retain terminal public evidence for the other candidates: Grafloria’s executable Vite package-entry failure; Flowscape’s visible native NodeRect hierarchy and NodeLine relationship limitation; Xenolith’s public graph/viewport without a graph mount; Meta2D’s public scale geometry mutation; and F6’s native combo hierarchy followed by its browser Canvas failure.
4. Keep the 131-candidate comparison and outcome documentation synchronized, and verify the specialized browser flow, executable Grafloria harness, comparison contract, full repository suite, production build, and diff integrity.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Correction during implementation: an initial API read treated RGUI’s exported snapNodeSize(54, 30) => 56×32 helper as mandatory rendering behavior. Parent screening established that authored graph geometry is retained and snapping/layout are opt-in. The RGUI harness therefore keeps the exact authored 54×30 geometry and calls neither snapping nor layout; its live mounted public path, not the standalone helper, determines the outcome.

Implemented and verified the specialized batch through pinned public packages only. RGUI 3.16.0 is a live proof: its public graph retains 15 elements, 18 relationships, parent IDs, and exact authored geometry; the native Canvas renderer shows meaningful pixels and passes landmarks, plus/minus/slider, wheel zoom, and drag pan. Meta2D Core 1.1.28 is a live proof: 15 native parented node pens plus 18 native connectLine pens retain the architecture-model calculated world rect at x 858, y 294, width 54, height 30; native Canvas layers and viewport controls pass. Grafloria 0.3.9 reproduces a package-entry runtime failure: Vite dependency optimization reports 24 MISSING_EXPORT errors because its published entry exports TypeScript-only declarations including PropertyDefinition and PropertyEditorType as values. Flowscape Core SDK 2.0.2 mounts 15 native hierarchical nodes and its camera, but its NodeLine requires caller-owned endpoint geometry and exposes no source/target relationship model. Xenolith 0.7.0-beta.3 retains 15 graph nodes, 18 edges, exact positions/sizes, parent metadata, and a public viewport, but renderNode/renderEdge are per-element calls with no graph mount or owning containment; completion would require prohibited custom Pixi rendering and endpoint geometry. AntV F6 0.0.19 accepts the exact 15-node, 18-edge input, then reproduces TypeError: t.setGlobalAlpha is not a function against browser CanvasRenderingContext2D and draws zero pixels.

Verification: node --test test/semantic-zoom-comparison.test.mjs (9/9 passed); focused Playwright grep for RGUI, Meta2D, and specialized terminal evidence (3/3 passed); production Vite spike build passed; npm test (116/116 passed). The F6 exception and Grafloria package-entry failure are expected terminal evidence. The in-app Browser could not create a usable tab (Tabs can only be moved to and from normal windows), so browser proof used the repository Playwright fallback. Acceptance criteria and Definition of Done intentionally remain unchecked for parent review and the required cold simplicity/specification/quality gates.

Correction after a stronger cross-landmark invariant check: Meta2D is a mounted public-API limitation, not a live proof. Its initial parented scene is exact, but public scale(2.15) rewrites the top-level Groma pen from the authored x/y/width/height and propagates non-camera geometry changes to nested calculated rectangles. The harness and documentation now retain that reproduced mutation as terminal evidence. The revised focused Playwright suite passes 3/3 with this invariant.

Accepted cold simplicity cleanup applied for targeted re-review. Deleted Meta2D-only semantic orchestration and metadata (gromaKind, gromaWorld, gromaLevel, opacityFor, and applyLevel); the native mount, pixels, scale handler, and reproduced geometry mutation remain. Collapsed RGUI frame state to the tested rendered-node count. Removed the Flowscape raw relationship fixture restatement and its duplicate browser assertion, Xenolith expando fields not used by evidence, and F6 graphRef/__candidateF6 debug state. Outcomes and native mounted evidence are unchanged. Verification after cleanup: comparison 9/9 passed; specialized Playwright 3/3 passed; npm test 116/116 passed; production Vite build passed with only the pre-existing ProjectStorm/LiteGraph/chunk warnings.

Targeted specification blockers resolved with red/green evidence. RGUI: the prior public nodeHeight check exposed architecture-model at 54 × 90 because two native input rows set nodeMinHeight. The proof now uses the documented public component content scale (element.height / nodeMinHeight(node)); all two inputs, one output, parent ID, native edges, authored 54 × 30 world geometry, and 116.1 × 64.5 screen geometry at 2.15× remain asserted through public/native state. AntV F6: the public Graph data now mounts 11 component nodes, four native combos, and all 18 edges; Groma is the root combo, Architecture workspace/Viewer/Scanner are children, and component nodes retain their comboId. Public getCombos() verifies architecture-workspace:groma,scanner:groma,viewer:groma before the genuine t.setGlobalAlpha browser runtime failure. Focused blocker test first failed at RGUI 90px native height and F6 0 combos, then passed 2/2 after the fixes. Final verification: specialized browser suite 3/3, comparison 9/9, npm test 116/116, production Vite build passed with existing third-party Path namespace, direct eval, and chunk-size warnings; git diff --check passed. No custom renderer, custom relationship geometry, hidden ports, fallback, compatibility, or new abstraction was introduced. Acceptance criteria and Definition of Done remain unchecked for orchestrator finalization and targeted specification re-review.

Targeted quality blockers resolved with retained red/green evidence. Grafloria: added `scripts/reproduce-grafloria-entry.mjs`, which asks Vite `resolveConfig` plus `optimizeDeps` to resolve the installed pinned `@grafloria/renderer@0.3.9` entry in an isolated temporary cache. It succeeds only when the real optimizer error contains `Build failed with 24 errors`, `[MISSING_EXPORT]`, `PropertyDefinition`, and `PropertyEditorType`; no package patch or compatibility path is used. `test/semantic-zoom-grafloria-package-entry.test.mjs` executes that command, and the selectable browser panel names the same retained command. RED first failed because the executable did not exist and the panel did not name it; GREEN passes the executable and browser checks. Flowscape: public investigation showed `world.getNodes()` had five roots and recursive traversal had 15 nodes, but default center pivots turned the authored architecture-model rectangle into native world AABB -539,-551,54×30, and `NodeFrame` had no default renderer parent view, leaving Components at zero Canvas pixels. The smallest public correction uses a native `NodeRect` hierarchy with public `setPivot(0,0)`, then public camera `setPosition` plus `setScale` at each named landmark. Browser evidence now reads the public world recursively, verifies parent Viewer, exact local 38,84 and native world 858,294,54×30 geometry, public camera state, camera-transformed component centering, and nonzero native Canvas pixels at Context and Components. The terminal NodeLine relationship limitation is unchanged; no relationships, custom renderer, custom camera, or caller-owned line geometry were added. Visual evidence was inspected at 1600×1000 for both Context and Components. Verification: Grafloria executable 1/1; specialized Playwright 5/5; comparison 9/9; npm test 117/117; production Vite build passed with the existing third-party ProjectStorm Path, LiteGraph eval, and chunk-size warnings; git diff --check passed. Nonblocking Xenolith follow-up only: the proof directly imports `pixi.js`, which the renderer declares as a peer dependency but this repository does not declare directly; it is currently available transitively through the broader candidate installation. This does not change the accepted Xenolith API-limitation evidence and was not expanded into implementation. Acceptance criteria and Definition of Done remain unchecked for parent quality re-review.

Final gate evidence: cold simplicity review PASS; specification review and targeted re-review PASS; quality review and targeted re-review PASS. Fresh final verification passed: specialized Playwright 5/5, comparison 9/9, npm test 117/117, production Vite build exit 0 with only the recorded third-party ProjectStorm Path, LiteGraph eval, and chunk-size warnings, and git diff --check exit 0. The expected F6 setGlobalAlpha exception remains asserted terminal evidence. The Xenolith pixi.js peer/transitive dependency observation remains a nonblocking follow-up and is not unfinished TASK-17.5.5 scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the six specialized renderer proofs against the shared Revision 04 scene using pinned public packages. RGUI remains the live Canvas proof; Grafloria, Flowscape, Xenolith, Meta2D, and F6 retain executable browser or public-API terminal evidence without custom rendering, relationship geometry, compatibility, fallback, benchmark, or production-viewer behavior. Verified by all PASS review gates, specialized Playwright 5/5, comparison 9/9, full repository 117/117, production build exit 0, and git diff --check exit 0.
<!-- SECTION:FINAL_SUMMARY:END -->
