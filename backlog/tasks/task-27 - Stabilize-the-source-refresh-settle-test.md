---
id: TASK-27
title: Stabilize the source-refresh settle test
status: To Do
assignee: []
created_date: '2026-08-02 20:04'
labels: []
dependencies: []
type: bug
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
test/source-refresh.test.mjs (the assertion near line 360 about observation cycles per settled source event) fails intermittently under full-suite load: the recorder captures one extra complete refresh cycle beyond the expected three. It passes when the file runs alone. The flake predates 2026-08-02: TASK-21 recorded one occurrence, and TASK-23 hit it twice in four full-suite runs. Investigate whether the quiet-period settling logic or the test recorder has a timing assumption that suite load violates, and stabilize the test without weakening what it proves about settled refresh behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The cause of the intermittent extra refresh cycle is identified and recorded
- [ ] #2 bun run check passes repeatedly (at least five consecutive full runs) with the test still proving one complete refresh per settled event group
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
