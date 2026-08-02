---
id: TASK-26
title: Show plan progress through Git revisions
status: To Do
assignee: []
created_date: '2026-08-02 19:53'
labels: []
milestone: m-4
dependencies:
  - TASK-24
  - TASK-25
references:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per the lifecycle contract display model, Groma composes a selected plan with the architecture at a selected revision, where revisions are the Git commits. Provide the first progress surface as plain terminal output so both humans and agents can read it without a browser: list the revisions that changed groma/observed, and show for one selected plan which element Markdown remains to implement. This is the surface that lets an agent or the architect review a plan or check progress in one command instead of reading directories, backlog history, and raw diffs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A command lists the revisions that changed groma/observed with commit identifier, date, and subject
- [ ] #2 A command shows the remaining additions and changes of one selected plan composed with current observed
- [ ] #3 Output is plain text or Markdown readable in a terminal and needs no running server or browser
- [ ] #4 bun run check passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
