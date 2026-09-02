---
id: TASK-241
title: Edit the architecture from the web and the CLI through one core
status: To Do
assignee: []
created_date: '2026-09-02 21:15'
labels:
  - cli
  - web
  - core
dependencies: []
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
priority: high
type: feature
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma becomes editable without breaking the rule that every operation lives in core once and reaches the CLI and the web with the same meaning. The storage model changes first: one tree under groma/ with four folders (actors, externals, systems, drafts), OKF status draft or stable in every file, a draft tag instead of a second document, one file per id that never moves. Then five verbs, add, draft, edit, remove and accept, replace create and relate (12 commands become 13), and the web details pane offers, on the selected thing, exactly the verbs the CLI allows on it. The scanner alone creates stable systems, containers and components; people add actors, externals, drafts, relations and groups and describe anything. Design authority with the intent map, rules and build order: the referenced page. Subtasks are the slices in the order they must land; the storage slice waits for TASK-238.1 to be committed, by agreement with the terminal facelift work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every editing operation exists once in core and is reachable from the CLI and the web with the same input and the same success or refusal sentence
- [ ] #2 No command or web control hand-creates a stable system, container or component; they come only from a scan or an accepted draft
- [ ] #3 The CLI has 13 top-level commands: init, web, export, view, scan, scanner, instructions, agent-instructions, add, draft, edit, remove, accept
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
