---
id: TASK-3
title: Verify the Markdown foundation
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:16'
labels: []
milestone: m-0
dependencies:
  - TASK-2
references:
  - README.md
  - groma/plans/01-markdown-foundation/README.md
  - 'https://c4model.com/'
priority: high
type: task
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 01 is the gate that proves Groma architecture works as repository-owned documentation before any application exists. Validate the groma/observed tree created by TASK-2 against the contract from TASK-1, and demonstrate that a person unfamiliar with Groma can navigate the files and review a component change through Git. This task must not introduce a viewer, watcher, scanner, layout engine, or reconciliation system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Automated validation rejects duplicate stable IDs, unknown parent IDs, invalid C4 containment, and broken relationship links
- [ ] #2 The validation passes for groma/observed and every complete revision under groma/plans
- [ ] #3 A reader can identify Groma, its users, its architecture workspace, and its Git relationship directly from the Markdown files
- [ ] #4 A representative component description or relationship change produces a focused, understandable Git diff
- [ ] #5 No runtime viewer, watcher, source scanner, persisted layout, or reconciliation machinery is introduced
<!-- AC:END -->
