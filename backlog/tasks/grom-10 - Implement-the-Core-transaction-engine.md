---
id: GROM-10
title: Implement the Core transaction engine
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
labels:
  - core
  - transactions
milestone: m-1
dependencies:
  - GROM-7
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement deterministic semantic transactions with expected revisions, registered invariants, atomic capability-boundary commits, monotonic graph generations, typed events, and explicit recovery outcomes. Core coordinates provider contracts but knows no filesystem or Markdown technology.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A mutation can carry expected content revisions and returns a conflict without writing when any expectation is stale
- [ ] #2 All registered invariants run against the complete proposed transaction before a store commit begins
- [ ] #3 A successful transaction advances the graph generation exactly once and publishes one typed committed event after durable success
- [ ] #4 Validation, conflict, provider failure, and indeterminate recovery outcomes are distinct typed diagnostics and never report a partial success
- [ ] #5 Core defines storage preparation, commit, and recovery contracts without importing local-resource, Markdown, or journal implementations
- [ ] #6 Fault-injecting provider tests cover rejection before prepare, failure during commit, recovery reporting, event ordering, and concurrent stale revisions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define mutation, revision, generation, provider, invariant, event, and outcome contracts.
2. Implement deterministic validation and expected-revision conflict detection.
3. Coordinate prepare and commit through the canonical-store capability.
4. Publish events only after confirmed durable success and expose explicit recovery states.
5. Add an in-memory fault-injecting provider test suite and verify technology neutrality.
<!-- SECTION:PLAN:END -->
