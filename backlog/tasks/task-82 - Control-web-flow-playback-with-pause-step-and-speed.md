---
id: TASK-82
title: 'Control web flow playback with pause, step, and speed'
status: To Do
assignee: []
created_date: '2026-08-17 20:50'
labels: []
dependencies: []
priority: high
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An active person-command flow animates continuously but cannot be paused, stepped, or slowed, and nothing names the leg the payload is on. While a flow is active, show playback controls in the web header: pause/resume, trace one step, and 0.5x/1x/2x speed, plus a caption naming the current leg. Approved example: the reference demo's flow header controls and step captions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 While a flow is active the header names it and offers pause/resume, trace-one-step, and 0.5x/1x/2x speed controls; none of these appear when no flow is active
- [ ] #2 Pause freezes the travelling payload in place, resume continues it, and a speed change takes effect immediately
- [ ] #3 Trace one step advances the payload one relationship leg at a time and shows a caption naming that leg's source, target, and relationship label
- [ ] #4 Clearing the flow removes the controls and the caption
- [ ] #5 Playback state transitions are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
