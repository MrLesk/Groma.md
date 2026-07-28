---
id: TASK-14
title: Verify plan-to-observed materialization
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:35'
labels: []
milestone: m-2
dependencies:
  - TASK-7
  - TASK-8
  - TASK-13
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
priority: high
type: task
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 03 is the release gate for Groma’s first complete plan-to-materialization story. Open the already-built Revision 02 viewer with the selected plan 03-code-observation and a controlled fixture whose plan contains one component absent from the TASK-10-owned generated subtree, so the TASK-7 comparison draws it as a ghost. Implement that component using only the TASK-10 TypeScript/Bun source shape and declare the exact stable C4 ID already present in the selected plan. Verify that TASK-13 observes the supported change, TASK-12 updates readable component Markdown and ## Source evidence under the owned observed subtree, and the already-open viewer changes that same ID from planned-only to observed without restart or source access.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The controlled fixture selects plan 03-code-observation in the Revision 02 viewer, begins with one stable component ID present only in that selected plan, and draws it as a ghost addition
- [ ] #2 Implementing a supported source declaration with that exact stable ID creates the matching component under the TASK-10-owned observed subtree and records readable ## Source evidence
- [ ] #3 The already-open Revision 02 viewer changes that element from ghost addition to observed without process restart or direct source access
- [ ] #4 One end-to-end test covers supported add, modify, and remove source changes and the corresponding Markdown and plan-03 visual comparison states
- [ ] #5 Repeating the workflow without source changes produces byte-identical generated Markdown and an equivalent C4 graph
- [ ] #6 The workflow preserves hand-authored and unrelated observed elements and modifies no named plan file
<!-- AC:END -->
