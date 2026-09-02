---
id: TASK-241.2
title: Offer groma init and an empty-map invitation from groma web
status: To Do
assignee: []
created_date: '2026-09-02 21:16'
labels:
  - cli
  - web
dependencies: []
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
parent_task_id: TASK-241
priority: high
type: feature
ordinal: 276000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today groma web in a repository without a Groma directory dies with a stack trace whose last line says run groma init, and an initialized repository with no elements shows blank ground. When a human runs groma web on a TTY in a repository without Groma, Groma asks with the Clack prompt used by groma init whether to initialize now; Yes runs the init wizard and then opens the map, No exits with one line naming groma init. Without a TTY, Groma prints one sentence naming groma init and exits with a non-zero code. With a Groma directory and no elements, the web page shows an invitation instead of blank ground: the project name, one line saying the map is empty, the two ways forward (build something and let the scan find it, or draft the first system) and the Draft control, since there is nothing to select yet. The invitation leaves when the world gains its first element. The decisions "no Groma directory" and "empty world" are one core seam shared with the terminal twins TASK-239 and TASK-240. The init half needs nothing from the storage slice; the Draft control in the invitation needs the draft verb from TASK-241.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a TTY, groma web in a repository without a Groma directory asks with Clack whether to run groma init; Yes runs the same init wizard as groma init and then opens the browser map; No exits with code 0 and one line naming groma init
- [ ] #2 Without a TTY, groma web prints one sentence naming groma init and exits with a non-zero code; neither path prints a stack trace
- [ ] #3 With a Groma directory and no architecture elements, the web page shows the invitation with the project name, the empty line, the two ways forward and the Draft control, instead of blank ground
- [ ] #4 When a scan or a write yields the first element, the map replaces the invitation without a reload
- [ ] #5 The no-Groma and empty-world decisions live once in core and are the same functions groma view uses
- [ ] #6 Tests cover the non-TTY path, the TTY prompt through the init UI seam and the empty-state decision with fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
