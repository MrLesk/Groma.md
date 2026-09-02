---
id: TASK-241.5
title: Author relations from the web
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
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relationships are the one thing with two ids, so they carry the word relation on every verb. groma add relation <a> <b> --description <prose> --technology <text> writes the one relationship per ordered pair on the source document, groma edit relation <a> <b> rewords it and groma remove relation <a> <b> removes it; relate and relate --remove are deleted. In the web, Relate to on a selected element takes the target from a map click and opens the sentence form; clicking a route opens the same form with Remove.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma add relation <a> <b> --description <prose> --technology <text> writes one relationship per ordered pair on the source document and refuses a duplicate pair with one sentence naming groma edit relation
- [ ] #2 groma edit relation <a> <b> rewords the description or technology; groma remove relation <a> <b> removes the row; relate no longer exists
- [ ] #3 In the web, Relate to on a selected element takes the target from a map click and opens the sentence form; clicking a route opens the same form with Remove; groma view <a> prints the row the web wrote
- [ ] #4 Tests cover add, edit, remove and the duplicate-pair refusal with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
