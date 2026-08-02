---
id: TASK-25
title: Migrate the cumulative plan directories to scoped feature plans
status: To Do
assignee: []
created_date: '2026-08-02 19:53'
labels: []
milestone: m-4
dependencies:
  - TASK-24
references:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The numbered directories under groma/plans are cumulative complete states from the pre-contract model, and groma/observed is stale: it records seven elements and lacks the shipped viewer container entirely. Materialize the architecture that is already implemented on main into groma/observed (the delivered viewer and scanner as committed, not the in-flight semantic zoom rebuild), then rewrite the still-open work as independent scoped feature plans per the contract layout: the semantic zoom viewer remainder and the terminal viewer. Implemented plan directories disappear entirely; Git history is their archive, so nothing moves to an archive folder. The observed additions are hand-authored architecture Markdown and need architect review before finalization. Sources: groma/plans/01..05 content, the lifecycle contract, and the shipped code under src.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 groma/observed describes the architecture implemented on main, including the shipped viewer container and its components
- [ ] #2 groma/plans contains only independent, unnumbered feature plan directories holding element Markdown still awaiting implementation
- [ ] #3 No plan directory keeps element Markdown that observed already satisfies, and no numbered or implemented plan directory remains
- [ ] #4 The human architect approves the materialized observed Markdown
- [ ] #5 bun run check passes and the viewer renders observed composed with each remaining plan
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
