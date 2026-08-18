---
id: TASK-95.2
title: Draw OpenClaw Context as an SVG campus
status: To Do
assignee: []
created_date: '2026-08-18 20:48'
labels: []
dependencies:
  - TASK-95.1
references:
  - test/fixtures/openclaw-view
documentation:
  - docs/viewers/web/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone opens the OpenClaw Context proof, Groma shows the campus as SVG: named systems, people, and external systems, plus container underlay inside OpenClaw. Titles are screen-space type, not photographed onto world planes.

This is the web proof of the city contract. It does not change TUI paint, add cone arrows, or redo chrome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An SVG of OpenClaw at Context names Operator, OpenClaw, WhatsApp, Telegram, and Anthropic
- [ ] #2 OpenClaw's six containers appear as unnamed underlay inside the OpenClaw wrapper
- [ ] #3 Titles are screen-space and stay sharp; they are not canvas textures on world planes
- [ ] #4 People and external systems are marks, not campus-sized plates
- [ ] #5 The proof uses the city contract from TASK-95.1
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
