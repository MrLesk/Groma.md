---
id: TASK-16
title: Declutter the Groma implementation without changing its supported behavior
status: To Do
assignee: []
created_date: '2026-07-28 17:47'
labels: []
dependencies: []
references:
  - docs/superpowers/specs/2026-07-28-simplicity-review-design.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce accidental complexity across Groma's current implementation while preserving the documented supported product flows. Start from the cold read-only review produced with Claude Fable 5, but treat every recommendation as a hypothesis to validate against the README, architecture contracts, completed task acceptance criteria, and tests. Prefer deletion, inlining, and removal of unused configuration. Do not add behavior, compatibility, edge-case handling, fallback/recovery, hardening, or future-facing abstractions. The intended stopping point is the simplest implementation that still supports Markdown validation, plan-versus-observed viewing, C4 navigation, live Markdown reload, and the Revision 03 source-to-Markdown-to-viewer flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The documented Markdown validation, plan comparison, C4 navigation, live reload, and Revision 03 source-to-Markdown-to-viewer flows behave exactly as before
- [ ] #2 The resulting production and test code contains fewer lines, modules, configuration channels, or duplicated validation concepts, with each removal justified by supported-flow evidence
- [ ] #3 An unfamiliar reviewer can trace each supported entry point through responsibilities and state to its result without relying on conversation context
- [ ] #4 No new behavior, backwards compatibility, edge-case handling, fallback or recovery behavior, hardening, or future-facing abstraction is introduced
- [ ] #5 npm run check, npm run test:release-gate, and npm run test:viewer:browser pass after the simplification
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
