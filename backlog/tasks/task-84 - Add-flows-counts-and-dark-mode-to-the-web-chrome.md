---
id: TASK-84
title: 'Add flows, counts, and dark mode to the web chrome'
status: To Do
assignee: []
created_date: '2026-08-17 20:50'
labels: []
dependencies: []
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web sidebar shows only the element tree and the header only the wordmark, so nothing surfaces the person commands or the size of the world at a glance. List the person commands above the element tree in the sidebar, each activatable by click, and give the header the observed system name with flow and element counts plus a light/dark toggle. Approved example: the reference demo chrome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The sidebar lists every person command above the element tree; clicking one activates its flow and the active row is highlighted
- [ ] #2 The header shows the observed system name with live counts of flows and elements
- [ ] #3 A header toggle switches the whole viewer between light and dark themes; map, chrome, and details all follow
- [ ] #4 Sidebar flow activation and the theme switch are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
