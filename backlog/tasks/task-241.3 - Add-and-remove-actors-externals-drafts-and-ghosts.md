---
id: TASK-241.3
title: 'Add and remove actors, externals, drafts and ghosts'
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
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People declare what no scan can see. groma add actor <name>, groma add external <name> and groma add draft <name> write stable records under actors/ and externals/ and the draft record under drafts/; groma add component <name> refuses with one sentence that names groma draft, because scanned software is never hand-created. groma remove <id> takes the id alone, since ids are unique: it removes a person, an external, a ghost or an empty draft, refuses while routes point at the element or ghosts carry the draft tag and names them, and refuses on a stable system, container or component naming the scanner as the owner. The web mirrors it: a plus button in the hierarchy pane offers Person, External and Draft, and the details pane shows Remove only where the verb would succeed. Each control posts the same input the CLI builds and shows the same refusal sentence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma add actor <name> --overview <markdown> and groma add external <name> --technology <text> --overview <markdown> write stable records under actors/ or externals/ and print ok and the id
- [ ] #2 groma add draft <name> --overview <markdown> writes drafts/<id>.md and prints ok and the id
- [ ] #3 groma add system|container|component <name> fails with one sentence naming groma draft and writes nothing
- [ ] #4 groma remove <id> removes an actor, an external, a ghost or an empty draft; it refuses and names the blockers while routes point at the element or ghosts carry the draft tag; on a stable system, container or component it refuses and names the scanner as the owner
- [ ] #5 The web hierarchy pane offers Person, External and Draft from one plus button, each posting the same input as the CLI; the details pane shows Remove only where the verb would succeed and shows the CLI refusal sentence otherwise
- [ ] #6 Tests cover every add target, the teaching error and every remove refusal with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
