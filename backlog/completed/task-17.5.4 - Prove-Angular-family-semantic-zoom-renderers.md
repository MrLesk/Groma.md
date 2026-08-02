---
id: TASK-17.5.4
title: Prove Angular-family semantic-zoom renderers
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 17:41'
updated_date: '2026-07-30 21:55'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - package.json
  - bun.lock
  - src/spikes/semantic-zoom/proofs/angular-family-proofs.jsx
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/styles.css
  - test/semantic-zoom-comparison.test.mjs
  - e2e/semantic-zoom-proofs.spec.js
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17.5
priority: high
type: spike
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator selects Swimlane ngx-graph, Foblex Flow, and ngx-vflow in the disposable Revision 04 library comparison, each candidate receives the same approved seven-component Groma scene and is exercised through its own documented public APIs. These candidates survived official-documentation screening, so each requires a live browser harness; a failure is valid only when the harness reproduces a runtime/browser error or exposes a decisive public-API limitation. The result updates the existing 131-candidate comparison without selecting a winner or changing the production viewer.
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
1. Mount each Angular candidate from the existing comparison selector with the exact shared 15-element, 18-relationship fixture and shared zoom controls.
2. Give Foblex authored canvas-space node/group coordinates; use native setScale and centerGroupOrNode for Components, centering immediately after render readiness and queueing only pre-readiness requests.
3. Give ngx-vflow its native parent-relative node/group coordinates; use native fitView followed by zoomTo for the four Viewer components at Components 2.15.
4. On candidate switching, destroy the Angular ComponentRef while its injector is live, await application stability, then destroy ApplicationRef, including an in-flight bootstrap.
5. Mount ngx-graph through its public dagreCluster path and record the reproduced rank failure as terminal evidence without a custom layout or fallback; expose all outcomes in the comparison, browser coverage, and selection document.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TDD and correction history (2026-07-30): the Angular-family terminal-evidence assertion was added before the evidence rows. The first Foblex browser run failed because no native stage existed. Foblex then passed after mounting its public f-flow/f-canvas/fGroup/fNode/f-connection APIs. The first ngx-vflow run produced empty native paths until documented source/target handles were supplied; its native ResizeObserver then exposed card-size shrinkage until the authored public width/height inputs were represented explicitly. The initial ngx-graph attempt was expected to reveal automatic-layout displacement, but the exact clustered scene instead reproducibly fails inside the public native dagreCluster path with TypeError: Cannot set properties of undefined (setting rank) before nodes draw; the final evidence records that smaller observed fact and adds no custom Layout or fallback.

Browser evidence: Foblex Flow and ngx-vflow each mount all 15 authored elements and 18 non-empty native relationship paths; public plus/minus, slider, and 0.38/0.82/2.15 landmark controls work; native wheel zoom and background drag pan change their viewport transforms; the architecture-model card stays at normalized 54x30 across landmarks; relationship emphasis is mixed and primary cards remain readable; page and console error collections are empty. Swimlane ngx-graph mounts its native component and SVG with data evidence for all 15/18 inputs, then visibly records the exact dagreCluster rank crash.

Cold simplicity review: entry is the existing candidate selector, which mounts one proof; each passing React wrapper bootstraps only its Angular root, the root sends the fixture directly to that candidate native nodes/groups/edges, and candidate-specific controls call either FCanvas setScale or Vflow zoomTo before the native viewport reports the visible state. This is the simplest task-scoped flow found. The shared API-normalizing wrapper was removed so Foblex and ngx-vflow own their distinct native calls; only a presentation-only frame and Angular bootstrap plumbing remain shared. The unused animations provider was also deleted. The flow is readable from selector to candidate wrapper to native root to stage, with no custom renderer, camera, geometry, fallback, or future abstraction. No further deletion was identified without duplicating the shared visual shell or obscuring the native boundary.

Verification: node --test test/semantic-zoom-comparison.test.mjs: 8 passed; focused Playwright Angular loop: 3 passed; npm test: 115 passed; npm run validate:architecture: 5 revisions validated; disposable Vite production build: passed (4218 modules). Build output retains pre-existing Projectstorm namespace, LiteGraph eval, and chunk-size warnings outside this task. git diff --check and targeted trailing-whitespace scan are clean.

Targeted simplicity re-review (2026-07-30): accepted the sole cold-review deletion by removing the unused VflowProofRoot.zoom field and its viewport-subscription assignment. React already receives the native viewport zoom through onViewport, so visible behavior and candidate API ownership are unchanged. Reverification: comparison tests 8/8 passed; focused Angular Playwright 3/3 passed, including the expected visible ngx-graph dagreCluster failure evidence; git diff --check and the targeted trailing-whitespace scan passed. Ready for re-review limited to this finding and regressions caused by its deletion.

Targeted specification fixes (2026-07-30): three review findings were reproduced with browser regressions before production changes. Foblex rendered the architecture-model at a normalized 298,-236 delta from human-architect instead of the authored 1118,-26 because the harness rebased positions even though Foblex fGroupPosition/fNodePosition consume canvas coordinates. Both native inputs now receive authored x/y directly; browser evidence checks actual rendered component and container deltas (1118,-26 and 1080,-110), not data attributes.

The supported Foblex-to-ngx-vflow selector transition reproduced NG0205 Injector has already been destroyed, a detached-SVG d3 error, and a blank target. React teardown had destroyed ApplicationRef while scheduled Angular work still used its injector. The mount lifecycle now destroys ComponentRef while the injector remains live, waits for ApplicationRef stability before destroying the application, and applies the same ordering if bootstrap resolves after React disposal. The transition now mounts 15 ngx-vflow elements and 18 edges with empty page/console error collections; no recovery or fallback was added.

ngx-vflow Components initially reproduced 0/7 intersecting and 0/7 readable cards at zoom 2.15. Calling fitView and zoomTo in the same turn showed that the later writable viewport signal replaced the earlier native focus request; sequencing zoomTo from the first public viewportChange event preserved the native fit center. Fitting all seven components centered the wide inter-container gap and yielded only a clipped card, so the final native focus targets the four Viewer components that define the approved Components landmark focus before applying zoom 2.15. Browser evidence now records exactly 4 intersecting and 4 fully readable component cards while fixed node geometry remains unchanged.

Targeted re-review verification: comparison 8/8 passed; focused Angular, rendered-position, selector-transition, component-readability, and ngx-graph evidence Playwright tests 6/6 passed; npm test 115/115 passed; architecture validation passed for 5 revisions; disposable Vite production build passed with the previously recorded unrelated Projectstorm, LiteGraph, and chunk-size warnings; git diff --check and targeted whitespace checks passed. Task remains In Progress with acceptance and Definition of Done items unchecked.

Targeted quality fix (2026-07-30): a new real-viewport Foblex regression first reproduced Components at zoom 2.15 with 0/7 intersecting and 0/7 readable cards; the previous toBeVisible and normalized-size checks had accepted offscreen DOM. Foblex now uses only its documented public canvas methods: setScale applies exact zoom, then centerGroupOrNode focuses the central authored Viewer component (`canvas`), which places all four Viewer component cards fully inside the viewport without changing world coordinates. The first minimal focus attempt produced 4/4 cards but also the documented FF1009 warning because centering ran before Foblex completed its render lifecycle. A second failing assertion captured that warning. The final candidate-owned path queues the native focus until the public fNodesRendered event, then centers with animation disabled; no camera transform, geometry, adapter, warning suppression, fallback, or recovery was added.

Targeted quality re-review evidence: Foblex Components now has exactly 4 intersecting and 4 fully readable component cards at zoom 2.15 with no f-flow warnings. Comparison tests passed 8/8; focused Angular/browser coverage including Foblex and ngx-vflow native interaction, rendered coordinates, Foblex-to-ngx-vflow switching, both component-readability checks, and ngx-graph terminal evidence passed 7/7; npm test passed 115/115; architecture validation passed all 5 revisions; disposable Vite production build passed with the already recorded unrelated Projectstorm, LiteGraph, and chunk-size warnings; git diff --check and targeted whitespace checks passed. Task remains In Progress with acceptance and Definition of Done items unchecked.

Settled-load quality correction (2026-07-30): targeted re-review showed that the prior Foblex focus test clicked before initial fNodesRendered, so the queued center request was consumed and created a timing false-positive. The regression now waits 1500 ms for the initial Foblex render lifecycle to settle before selecting Components. Against the prior implementation it reproduced zoom 2.15 with 0/7 intersecting and 0/7 readable cards because setScale does not emit another fNodesRendered event.

The smallest lifecycle correction tracks whether initial nodes rendering has completed. A Components request made before readiness remains queued for fNodesRendered; a request made after readiness calls the same documented native centerGroupOrNode immediately after native setScale. There is no retry, timer in production, fallback, warning suppression, computed camera transform, geometry change, or additional adapter. Settled browser evidence now records exact zoom 2.15, exactly 4 intersecting and 4 fully readable Viewer component cards, no f-flow warnings, the authored -62/0 normalized delta between architecture-model and canvas, and the unchanged 54x30 architecture-model geometry.

Reverification: comparison tests passed 8/8; focused Angular/browser including settled Foblex focus, ngx-vflow focus, authored coordinates, selector switching, native interaction, and ngx-graph evidence passed 7/7; architecture validation passed all 5 revisions; the disposable Vite production build passed with the previously recorded unrelated warnings; git diff and targeted whitespace checks passed. The first parallel full-test run had one out-of-scope source-refresh watcher-count failure; that exact test passed 1/1 in isolation and an immediate unchanged full rerun passed 115/115, so no source-refresh change was made. Task remains In Progress with acceptance and Definition of Done items unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Proved the Angular renderer batch against the exact 15-element, 18-relationship scene: Foblex Flow and ngx-vflow preserve authored geometry, native interaction, exact landmarks, semantic emphasis, settled component readability, and clean selector switching; Swimlane ngx-graph records its reproduced native dagreCluster rank failure without a custom layout or fallback. Verification passed focused browser 7/7, comparison 8/8, full tests 115/115 on the unchanged rerun, architecture validation for all 5 revisions, the disposable Vite build, and diff checks. All specification, quality, simplicity, and targeted re-reviews passed. One unrelated source-refresh watcher-count failure was nonblocking because the exact test passed in isolation and the immediate unchanged full rerun passed.
<!-- SECTION:FINAL_SUMMARY:END -->
