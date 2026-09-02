---
id: TASK-241.6
title: Group and combine from the web
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
labels:
  - cli
  - web
  - core
dependencies:
  - TASK-241.1
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
parent_task_id: TASK-241
priority: medium
type: feature
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A group is a name on each sibling component and has no id of its own, so it carries the word group on every verb and is addressed as <container-id>/<group-kebab>. groma add group <name> <ids...> assigns siblings, groma edit group <address> --title <text> renames every member in one change and groma remove group <address> [ids...] removes members or dissolves the group. In the web, a multi-select offers Group as and Combine into, where the person picks the survivor, and clicking a group label offers rename and dissolve. Combine keeps the survivor id and the union of Code references, as edit --combine does today, because nothing hand-creates scanned software.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma add group <name> <ids...> assigns sibling components to one group and refuses when the ids do not share a container
- [ ] #2 groma edit group <container-id>/<group-kebab> --title <text> renames every member in one change; groma remove group <address> [ids...] removes the named members or dissolves the group when no ids are given
- [ ] #3 In the web, a multi-select offers Group as and Combine into with the survivor chosen by the person; clicking a group label offers rename and dissolve; every control posts the same input as the CLI
- [ ] #4 Combine keeps the survivor id and the union of Code references
- [ ] #5 Tests cover group add, rename, dissolve, the shared-container refusal and address resolution with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
