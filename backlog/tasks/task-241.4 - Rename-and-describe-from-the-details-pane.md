---
id: TASK-241.4
title: Rename and describe from the details pane
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
priority: high
type: feature
ordinal: 278000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A title cannot change anywhere today, and the project popover is the only web write, posting to PUT /project with no CLI twin. groma edit <id> gains --title and --technology and reaches the reserved id project, so groma edit project --title --overview edits groma/project.md and the popover posts the same input. In the web details pane, title, description, overview and technology are editable in place and a Draft selector tags the element with a draft; each control posts the same input the CLI builds, and a refusal appears under its field. The web reaches core through one route per verb, each taking the input type the CLI builds from its flags, and one guard test keeps the CLI and the web importing writes only from one core authoring module.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma edit <id> --title <text> renames any element or draft record without changing its id; --technology <text> sets the technology; --draft <id> tags the element
- [ ] #2 groma edit project --title <text> --overview <markdown> edits groma/project.md; the web project popover posts the same input; PUT /project is gone
- [ ] #3 In the web details pane, title, description, overview and technology are editable in place and a Draft selector tags the element; a refusal sentence appears under the field it belongs to
- [ ] #4 One route per verb accepts the same input type the CLI builds; a test asserts that no viewer file imports the write modules directly
- [ ] #5 Tests cover rename, technology, the draft tag and the project record with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
