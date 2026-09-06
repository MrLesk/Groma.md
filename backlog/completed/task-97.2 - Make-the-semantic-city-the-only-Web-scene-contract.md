---
id: TASK-97.2
title: Make the semantic city the only Web scene contract
status: Done
assignee:
  - '@luna'
created_date: '2026-08-19 06:32'
updated_date: '2026-08-19 07:29'
labels: []
dependencies: []
references:
  - web-viewer
  - scene
modified_files:
  - src/semantic-city.ts
  - src/semantic-view.ts
  - src/types.ts
  - src/viewers/web/campus-svg.ts
  - test-bun/semantic-view.test.ts
  - docs/viewers/creating-a-plugin.md
  - docs/viewers/index.md
  - docs/viewers/web/index.md
parent_task_id: TASK-97
priority: high
type: feature
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the production Web scene boundary so the renderer consumes one renderer-independent semantic city instead of reimplementing C4 visibility, promoted endpoints, route geometry, or focus rules. Reconcile the TASK-95 campus proof with the approved three-level SVG viewer. This slice may refactor shared contracts and tests but does not yet replace the visible main Web page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A single typed Web scene contract represents named items, underlay, marks, routes, labels, selection targets, focus scope, and projection-independent geometry
- [x] #2 The contract derives visible items and relationship endpoints from semanticView without a second renderer-specific disclosure algorithm
- [x] #3 Context, Containers, and Components fixture tests cover stable geometry and direct routes between visible semantic endpoints
- [x] #4 Durable viewer documentation explains the authoritative data path and which layer owns each decision
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
1. Preserve the accepted TASK-95 semantic roles and stable world-layout geometry in this slice; do not decide visual omission of underlay in renderer code.
2. Extend the shared semantic city with explicit selection targets plus projection-independent route and label geometry derived from semantic endpoints.
3. Keep endpoint promotion and route synthesis in one shared pure module used by semanticView; renderers consume the result without recomputing disclosure or endpoints.
4. Update the SVG campus serializer only enough to consume the completed contract; do not replace the production page yet.
5. Add fixture business-logic tests at Context, Containers, and Components for visible targets, promoted/direct routes, labels, immutability, and stable geometry.
6. Document ArchitectureWorld → semanticView/city → renderer ownership, including the rule that renderers own only projection, camera, paint, hit testing, interaction, and playback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Planning evidence: current production Web bypasses semanticView; the TASK-95 proof uses it but has no routes, labels, groups, selection targets, or interaction. The shared contract must own visibility, promoted endpoints, route/label geometry, and selection targets. Browser code may own only projection, camera, paint, hit testing, interaction, and playback.

The approved mockups and TASK-95 disagree about unnamed underlay and wrapper size. That visual/product choice is intentionally not encoded in TASK-97.2; this slice preserves TASK-95 roles while making all semantic geometry explicit so a later approved decision cannot be reimplemented ad hoc inside SVG paint.

Implemented the first semantic-city slice. Added the core semantic-city module for nearest attachable endpoint promotion, projection-independent orthogonal route synthesis, authored-bend endpoint attachment, and promoted label placement. semanticView now returns focusScope, non-underlay selectionTargets, and immutable routes while preserving TASK-95 roles and world-layout bounds. campusSvg consumes the semantic routes for SVG path geometry; no production Three.js, page styling, dependencies, or TUI behavior changed.

Fixture evidence: extended the shop fixture at Context, Containers, and Components for selection targets, direct/promoted endpoints, route/label geometry, stable entered-boundary bounds, and frozen-world immutability. Updated durable viewer docs for ArchitectureWorld → semanticView/semantic city → renderer ownership.

Verification: bun test test-bun/semantic-view.test.ts test-bun/campus-svg.test.ts — 19 pass; bun test test-bun/semantic-view.test.ts test-bun/openclaw-view.test.ts test-bun/campus-svg.test.ts test-bun/tui-campus.test.ts test-bun/projection.test.ts test-bun/projection-routes.test.ts test-bun/relationship-text.test.ts — 38 pass, 1 known pre-existing failure at test-bun/tui-campus.test.ts:77; bunx tsc --noEmit — clean; bun run check — 96 Node tests pass and 96 viewer tests pass with the same one unrelated tui-campus failure.

Cold simplicity review (task/diff/repository only): the flow is semanticView → shared semantic-city endpoint promotion and geometry → SemanticView routes/targets/scope → campusSvg path serialization. One concrete in-scope correction was accepted and applied: semanticView no longer performs a redundant sourceElement/targetElement existence lookup before promotedEndpoints; the shared helper is now the sole missing-endpoint authority. The review considered sharing the older TUI route helpers and collapsing edges/routes, but both were explicitly declined for this slice: TASK-97.2 is the Web scene boundary, TUI behavior is out of scope, and existing TUI consumers require edges while Web requires route geometry. No other simplicity correction was accepted. Focused verification after the correction: bun test test-bun/semantic-view.test.ts test-bun/campus-svg.test.ts test-bun/openclaw-view.test.ts — 22 pass; bunx tsc --noEmit — clean.

Finalization verification: spec review and quality review evidence are complete with no blocking findings. Acceptance #1 is evidenced by the typed semantic contract and 22 focused semantic/SVG/OpenClaw tests. Acceptance #2 is evidenced by shared semantic-city endpoint promotion and route synthesis, with the expanded review suite passing 38 tests and only the captured unrelated pre-existing tui-campus:77 failure. Acceptance #3 is evidenced by Context, Containers, and Components fixture business-logic coverage for targets, direct/promoted routes, labels, stable bounds, and immutability. Acceptance #4 is evidenced by the durable viewer documentation updates and clean diff-check. Definition of Done is satisfied: objective evidence recorded, relevant focused checks and typecheck pass, public contracts/docs updated, and the implementation plan plus correction/review history are recorded.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-19 06:52
---
Luna architecture review found a product-level conflict that must be resolved before implementation. TASK-95 requires unnamed next-level underlay and full world-layout wrapper bounds at every level. The approved mockups instead show only the named semantic scope, compact Context systems, and scope-local expansion on Enter. Implementing either in SVG paint would create a forbidden renderer-specific disclosure fork; the choice must change or reaffirm the shared semantic contract.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended semanticView into the renderer-independent Web semantic city with TASK-95 roles and bounds preserved, shared endpoint promotion, projection-independent routes and labels, selection targets, and focus scope. campusSvg consumes shared route geometry and viewer ownership docs were updated. Verified with 22 focused semantic/SVG/OpenClaw tests, clean TypeScript and diff checks, expanded review tests, and full-check evidence showing only the known pre-existing test-bun/tui-campus.test.ts:77 failure.
<!-- SECTION:FINAL_SUMMARY:END -->
