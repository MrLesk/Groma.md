---
id: GROM-14
title: Implement the local transaction journal and recovery
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
labels:
  - persistence
  - transactions
  - recovery
milestone: m-1
dependencies:
  - GROM-10
  - GROM-12
  - GROM-13
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide crash-safe multi-resource transactions for the official local host. The journal stages a complete target generation, records recoverable commit progress, and ensures startup observes either the complete prior generation or the complete new generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A transaction records its base generation, target generation, target resources, expected revisions, and staged replacements before any canonical target changes
- [ ] #2 The committed generation marker advances only when all target resources form the complete new generation
- [ ] #3 Recovery is idempotent and deterministically finishes or rolls back an interrupted transaction without creating a mixed generation
- [ ] #4 Concurrent writers are coordinated so stale or competing transactions fail without overwriting committed work
- [ ] #5 Journal and staging artifacts contain no volatile metadata that would create canonical Git churn and are cleaned after a confirmed outcome
- [ ] #6 Fault-injection tests terminate the transaction at every durable phase and prove that restart exposes exactly the old or new complete graph
- [ ] #7 The resulting generation and recovery outcome satisfy the Core transaction-provider contract and leave a future projection watermark integration point
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the local journal record and durable phase state machine.
2. Stage replacements and expected revisions through the local resource provider.
3. Coordinate target replacement and committed generation advancement.
4. Implement idempotent startup recovery and artifact cleanup.
5. Run exhaustive phase-boundary and competing-writer fault tests against the Markdown store.
<!-- SECTION:PLAN:END -->
