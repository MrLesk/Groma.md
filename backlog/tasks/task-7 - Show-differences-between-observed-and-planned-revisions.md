---
id: TASK-7
title: Show differences between observed and planned revisions
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-6
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
priority: high
type: feature
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma plans are complete desired architecture snapshots under groma/plans/<revision>, while groma/observed is the current materialized snapshot. Extend the viewer from TASK-6 to compare one selected plan with observed architecture by stable element ID. The comparison is a disposable projection: it reads both directories, classifies differences, and never modifies either set of Markdown files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An element present only in the selected plan is classified and drawn as a ghost addition
- [ ] #2 An element with the same stable ID but different architecture content is classified and drawn as a planned modification
- [ ] #3 An element present only in groma/observed is classified and drawn as a planned removal
- [ ] #4 An element with equivalent architecture content in both snapshots remains visible without change emphasis
- [ ] #5 Comparison works at system, container, and component views and never writes to either revision
<!-- AC:END -->
