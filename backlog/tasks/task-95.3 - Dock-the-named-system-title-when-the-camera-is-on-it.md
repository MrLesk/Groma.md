---
id: TASK-95.3
title: Dock the named system title when the camera is on it
status: To Do
assignee: []
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 20:49'
labels: []
dependencies:
  - TASK-95.2
documentation:
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
- [ ] #1 With the camera on OpenClaw, the OpenClaw title docks in screen space instead of remaining a world-scale plate label
- [ ] #2 The six OpenClaw containers become the named level
- [ ] #3 Any components stay underlay
- [ ] #4 People and external systems stay marks at their anchors
- [ ] #5 Fixture tests cover the dock and name switch, not decorative type
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
