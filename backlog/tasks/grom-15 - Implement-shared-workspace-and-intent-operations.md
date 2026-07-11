---
id: GROM-15
title: Implement shared workspace and intent operations
status: To Do
assignee: []
created_date: '2026-07-11 17:35'
updated_date: '2026-07-11 17:36'
labels:
  - operations
milestone: m-1
dependencies:
  - GROM-9
  - GROM-10
  - GROM-11
  - GROM-13
  - GROM-14
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose one presentation-neutral application path for initializing a workspace and creating, reading, listing, updating, and explicitly removing standard-model groups and components. Every mutation must use the same transaction, invariant, revision, persistence, and event contracts regardless of its future surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Initialization creates the minimal valid canonical Groma workspace transactionally and reports already-initialized or conflicting state without overwriting it
- [ ] #2 Group and component create, exact read, bounded list, sparse update, and explicit remove operations are available through typed presentation-neutral requests and results
- [ ] #3 Component operations support intent prose, inputs, outputs, actions, relationships, primary grouping, lifecycle, desired state, and unknown extensions without requiring a complete component
- [ ] #4 Every mutation accepts expected revisions where applicable, runs registered invariants, commits through the transaction engine and local journal, and returns the committed generation and new revisions
- [ ] #5 All list operations implement the bounded query contract with deterministic ordering and opaque continuation
- [ ] #6 No operation reads or writes Markdown, filesystem resources, or host state directly
- [ ] #7 Operation-level tests run against both in-memory fault fixtures and the official local persistence composition and produce equivalent domain results
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define workspace and standard-model operation request and result contracts.
2. Implement initialization and bounded read operations over injected capabilities.
3. Implement create, sparse update, and explicit removal as semantic transactions.
4. Return revisions, generations, cursors, and typed diagnostics without presentation concerns.
5. Run reusable operation suites against in-memory and local Markdown compositions.
<!-- SECTION:PLAN:END -->
