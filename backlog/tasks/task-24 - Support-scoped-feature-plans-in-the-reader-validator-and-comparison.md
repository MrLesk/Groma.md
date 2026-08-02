---
id: TASK-24
title: 'Support scoped feature plans in the reader, validator, and comparison'
status: To Do
assignee: []
created_date: '2026-08-02 19:53'
labels: []
milestone: m-4
dependencies: []
references:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per the lifecycle contract (docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md), a plan holds only unimplemented element Markdown and may refer to parents and relationship targets supplied by observed architecture; it does not copy elements to be self-contained. The current reader and validator require every plan to be a complete self-contained model, and the comparison treats observed-only elements as planned removals. Compose a selected plan with observed so that validation resolves plan parents and links against the composed model, observed alone still validates as a complete model, and comparison of a composed plan reports additions and changes only. Planned removal syntax stays deliberately absent per the contract first-contract boundaries. The release gate and comparison fixtures that prove the planned-removal state need realignment to the contract states. Coordinate with the in-flight semantic zoom worktree changes before touching shared viewer or test files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A plan directory containing only new or changed element Markdown validates when its parents and relationship targets resolve against the composed observed model
- [ ] #2 groma/observed alone continues to validate as a complete model
- [ ] #3 Comparison of observed with a composed scoped plan reports plan-only elements as additions and same-path differences as changes, and reports no removals
- [ ] #4 bun run check and the release gate pass with fixtures aligned to the contract states
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
