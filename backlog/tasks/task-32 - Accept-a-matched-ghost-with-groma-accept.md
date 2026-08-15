---
id: TASK-32
title: Accept a matched ghost with groma accept
status: To Do
assignee:
  - '@accept'
created_date: '2026-08-15 13:40'
updated_date: '2026-08-15 13:41'
labels: []
dependencies:
  - TASK-31
references:
  - docs/product-model.md
documentation:
  - docs/product-model.md
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma accept <id>`, Groma applies that planned ghost only if a scan has matched it. No match: the command fails and the ghost stays planned. A scan never accepts on its own. Groma may scan first if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `groma accept <id>` applies a matched ghost into observed
- [ ] #2 No scan match: the command fails and the ghost stays planned
- [ ] #3 A scan never accepts a ghost by itself
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
