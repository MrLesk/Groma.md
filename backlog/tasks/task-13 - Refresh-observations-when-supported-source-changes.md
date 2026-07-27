---
id: TASK-13
title: Refresh observations when supported source changes
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-2
dependencies:
  - TASK-11
  - TASK-12
references:
  - README.md
  - groma/plans/03-code-observation/README.md
priority: high
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect the bounded TypeScript observer from TASK-11 and the Markdown emitter from TASK-12 to local filesystem events for the exact source scope defined by TASK-10. After a supported source change, run one fresh complete observation and replace the generated groma/observed snapshot. The architecture viewer remains source-blind: its existing Markdown watcher from TASK-8 notices the changed component files and rebuilds the view through the normal Comark reader and C4 model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding, modifying, or removing a supported source element runs a complete TASK-11 observation and refreshes groma/observed through TASK-12
- [ ] #2 One source change produces one settled observed snapshot; no incremental graph mutation or reconciliation engine is introduced
- [ ] #3 The open viewer updates only because files under groma/observed changed and contains no source-observer integration
- [ ] #4 All named plan directories remain byte-identical across source refreshes
- [ ] #5 A source file outside the TASK-10 supported scope does not trigger fallback observation
<!-- AC:END -->
