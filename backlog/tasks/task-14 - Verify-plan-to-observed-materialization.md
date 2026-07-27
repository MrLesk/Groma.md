---
id: TASK-14
title: Verify plan-to-observed materialization
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-2
dependencies:
  - TASK-13
references:
  - README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
priority: high
type: task
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 03 is the release gate for Groma’s first complete plan-to-materialization story. Start with a complete desired revision under groma/plans containing a component absent from groma/observed, so TASK-7 draws it as a ghost. Implement that component using only the TypeScript/Bun source shape defined by TASK-10. Verify that TASK-13 observes the change, TASK-12 updates readable Markdown under groma/observed, and the already-open Revision 02 viewer changes the component from planned-only to observed without a restart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The controlled fixture begins with one stable component ID present only in a selected plan, and the viewer draws it as a ghost addition
- [ ] #2 Implementing the supported source element creates a matching component with the same stable ID under groma/observed and links it to source evidence
- [ ] #3 The already-open viewer changes that element from ghost addition to observed without process restart or direct source access
- [ ] #4 One end-to-end test covers supported add, modify, and remove source changes and the corresponding Markdown and visual revision states
- [ ] #5 Repeating the workflow without source changes produces byte-identical observed Markdown and an equivalent C4 graph
- [ ] #6 No named plan file is modified by observation or materialization
<!-- AC:END -->
