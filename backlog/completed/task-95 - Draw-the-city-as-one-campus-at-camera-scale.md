---
id: TASK-95
title: Draw the city as one campus at camera scale
status: Done
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 21:46'
labels: []
dependencies:
  - TASK-94
references:
  - test/fixtures/openclaw-view
  - src/semantic-view.ts
  - backlog/docs/doc-2 - OpenClaw-upper-band-semantic-layout.md
documentation:
  - docs/viewers/index.md
priority: high
type: feature
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Viewers must share one city: the laid-out wrappers from code up, shown at camera scale. One named C4 level plus the unnamed next software layer as underlay. Titles live in screen space. People and external systems are marks with a stable world anchor whose drawn size follows the named level.

When an architect opens a viewer at a C4 level, Groma shows that campus, matching the approved OpenClaw Context paper. This replaces the collapse-to-peer-card fork (name-only 44×40 system cards). Ghost still means planned. Underlay is not a ghost.

Do not add cone arrows, chrome/map-first changes, 1:1 code, or Create/Edit/Accept Markdown in this work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One campus geometry: software wrappers stay the world-layout union from code up; camera scale is the only shrink
- [x] #2 A C4 level names that level of internal software and shows the next software layer as unnamed underlay, never as planned ghosts
- [x] #3 People and external systems are marks: stable world anchors, drawn size follows the named level
- [x] #4 Titles are screen-space; docking a named system names its children and keeps neighbor anchors still
- [x] #5 Web SVG and TUI cells show the same OpenClaw Context campus
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
1. TASK-95.1 encode the city contract in semanticView.
2. TASK-95.2 and TASK-95.4 paint the same Context campus in SVG and TUI cells.
3. TASK-95.3 dock the focused system title in screen space.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Children delivered the contract, SVG Context proof, TUI raster, and docked titles. Cone arrows, chrome/map-first, and 1:1 code were out of scope.

Verification on main after merges: bun test semantic-view, openclaw-view, campus-svg, tui-campus, projection, projection-routes, navigation — 38 pass before 95.3 merge; campus-svg 8 pass in the 95.3 worktree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Viewers share one campus: world-layout wrappers at camera scale, one named C4 level plus underlay, people and externals as marks, titles in screen space. OpenClaw Context is SVG at /context.svg and the same contract in groma view; docking a system names its containers at /containers.svg. Verified with bun test on the campus, projection, and OpenClaw fixtures. Spec and quality reviews approved on each child.
<!-- SECTION:FINAL_SUMMARY:END -->
