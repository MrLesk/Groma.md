---
id: GROM-9
title: Enforce standard-model invariants
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
labels:
  - model
  - invariants
milestone: m-1
dependencies:
  - GROM-8
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Register model-specific invariant checks at the transaction boundary so no current or future surface can bypass the standard blueprint guarantees. The invariant API must be ready to distinguish curated intent from later scanner-owned evidence without implementing scanning in 1A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every semantic mutation is checked for valid primary grouping, entity-kind compatibility, relationship targets, and stable embedded-item identity
- [ ] #2 Removing or changing a referenced entity fails with actionable diagnostics unless the same atomic transaction restores a valid graph
- [ ] #3 Sparse updates preserve omitted curated fields and cannot silently erase existing intent
- [ ] #4 The invariant contract can receive prior state and ownership context so later evidence and pinned-boundary protections do not require a new mutation path
- [ ] #5 Ambiguous identities, relationship targets, and group selections fail closed
- [ ] #6 Tests prove that identical invariants govern direct operation calls and host or CLI initiated mutations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the invariant registration and diagnostic contracts against proposed and prior graph state.
2. Implement standard-model structural, grouping, identity, and relation checks.
3. Reserve explicit ownership and conceptual-boundary context without adding scan behavior.
4. Exercise valid multi-entity transactions and invalid partial or ambiguous mutations.
5. Verify all mutation callers share the same invariant path.
<!-- SECTION:PLAN:END -->
