---
id: TASK-13
title: Refresh observations when supported source changes
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:35'
labels: []
milestone: m-2
dependencies:
  - TASK-8
  - TASK-11
  - TASK-12
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect the bounded TypeScript observer from TASK-11 and the Markdown emitter from TASK-12 to local filesystem events for the exact supported source scope defined by TASK-10. After a supported source change settles, run one fresh complete observation and replace only the generated components subtree owned by the scanner/emitter under TASK-10; all hand-authored and unrelated observed elements remain untouched. Filesystem changes outside the supported source scope are ignored without invoking the observer and are not errors. The architecture viewer remains source-blind: its existing Markdown watcher from TASK-8 notices changes inside groma/observed and rebuilds the view through the normal Comark reader and C4 model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding, modifying, or removing a supported source element runs one complete TASK-11 observation and refreshes only the TASK-10-owned generated components subtree through TASK-12
- [ ] #2 One settled supported source change produces one complete generated subtree; no incremental graph mutation or rename reconciliation engine is introduced
- [ ] #3 A filesystem change outside the TASK-10 supported source scope is ignored without invoking the observer, refreshing Markdown, or reporting an observer error
- [ ] #4 The open viewer updates only because Markdown files under groma/observed changed and contains no source-observer integration
- [ ] #5 Hand-authored people, systems, containers, unrelated components, and every named plan directory remain byte-identical across source refreshes
<!-- AC:END -->
