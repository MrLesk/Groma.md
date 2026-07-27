---
id: TASK-2
title: Materialize the first observed architecture revision
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:16'
labels: []
milestone: m-0
dependencies:
  - TASK-1
references:
  - README.md
  - groma/plans/01-markdown-foundation/README.md
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma separates current materialized architecture from desired revisions. Using the component contract delivered by TASK-1, create groma/observed as the current counterpart to groma/plans/01-markdown-foundation. Materialize exactly the five elements in that plan: Human architect, Coding agent, Groma, Architecture workspace, and Git. Preserve their stable IDs, C4 containment, readable descriptions, and relative relationship links. Do not add runtime code, a viewer, or scanning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma/observed contains Human architect, Coding agent, Groma, Architecture workspace, and Git with the same stable IDs as Revision 01
- [ ] #2 The observed tree is organized by system ownership and C4 containment, matching the plan tree where elements correspond
- [ ] #3 All directories under groma/plans remain unchanged and separate from groma/observed
- [ ] #4 Every relationship in groma/observed is a working relative Markdown link
<!-- AC:END -->
