---
id: TASK-95
title: Draw the city as one campus at camera scale
status: In Progress
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 20:49'
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
- [ ] #1 One campus geometry: software wrappers stay the world-layout union from code up; camera scale is the only shrink
- [ ] #2 A C4 level names that level of internal software and shows the next software layer as unnamed underlay, never as planned ghosts
- [ ] #3 People and external systems are marks: stable world anchors, drawn size follows the named level
- [ ] #4 Titles are screen-space; docking a named system names its children and keeps neighbor anchors still
- [ ] #5 Web SVG and TUI cells show the same OpenClaw Context campus
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
