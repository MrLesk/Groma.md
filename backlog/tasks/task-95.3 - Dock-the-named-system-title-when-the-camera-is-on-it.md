---
id: TASK-95.3
title: Dock the named system title when the camera is on it
status: Done
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 21:46'
labels: []
dependencies:
  - TASK-95.2
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/campus-svg.ts
  - src/viewers/web/server.ts
  - test-bun/campus-svg.test.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the camera is on a named system, that system's title docks in screen space and its containers become the named level. Neighbor people, externals, and sibling systems keep their anchors.

This task is the dock/name switch only. It does not add cone arrows or chrome changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With the camera on OpenClaw, the OpenClaw title docks in screen space instead of remaining a world-scale plate label
- [x] #2 The six OpenClaw containers become the named level
- [x] #3 Any components stay underlay
- [x] #4 People and external systems stay marks at their anchors
- [x] #5 Fixture tests cover the dock and name switch, not decorative type
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
Consume semanticView(world, { level: 'containers', focusId: openclaw }). Do not change semantic-view or invent a second layout.

1. Extend campusSvg so a campus item matching view.focusId keeps its world-space wrapper rect and emits its name as an SVG <text data-dock> in an overlay layer outside the world viewBox. That title is not a world-unit plate label. Context stays a single viewBox SVG.
2. Title named items (the six OpenClaw containers) in the world layer. Marks keep world-layer titles at their semantic origins. Underlay stays untitled.
3. Tiny proof: GET /containers.svg?focus= (id or representationId; default first internal system) returns that campusSvg.
4. Fixture tests in test-bun/campus-svg.test.ts via loadArchitectureViewModel(openclawFixtureRoot). Assert the dock vs world-scale title, six named container titles, empty underlay, mark origins unchanged. No font/color asserts.
5. One sentence in docs/viewers/web/index.md for /containers.svg.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
campusSvg consumes semanticView at containers/focus. The focused campus keeps its world-space wrapper rect; its name is an SVG <text data-dock> in an overlay <g data-dock> outside the world viewBox. Named containers and marks keep world-layer titles. Underlay stays untitled. Context remains a single viewBox SVG.

GET /containers.svg?focus= (id or representationId; default first internal system) serves that view.

Simplicity: inlined the world-layer helper; folded the empty-underlay / no-component check into the named-level test; dropped extra plate-offset asserts.

Verification:
- bun test test-bun/campus-svg.test.ts test-bun/web-live.test.ts — 10 pass
- bunx tsc --noEmit — clean

Look at it: from test/fixtures/openclaw-view run `bun ../../../src/cli.ts web` and open /containers.svg?focus=openclaw.

Spec review: compliant. Quality review: approved. Orchestrator re-ran bun test test-bun/campus-svg.test.ts — 8 pass in the worktree. bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
When the camera is on OpenClaw, campusSvg docks the OpenClaw title in screen space and names the six containers. Marks keep their anchors. Served at GET /containers.svg?focus=openclaw. Verified with bun test test-bun/campus-svg.test.ts (8 pass) and bunx tsc --noEmit. Spec and quality reviews approved.
<!-- SECTION:FINAL_SUMMARY:END -->
