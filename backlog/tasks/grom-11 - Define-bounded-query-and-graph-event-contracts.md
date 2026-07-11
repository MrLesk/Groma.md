---
id: GROM-11
title: Define bounded query and graph-event contracts
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
labels:
  - core
  - queries
  - events
milestone: m-1
dependencies:
  - GROM-7
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the Core contracts shared by short-lived commands and later long-lived surfaces: exact reads, bounded deterministic pages, generation-bound opaque cursors, typed committed events, and recovery after generation gaps. The fast projection provider remains Iteration 1B.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every collection or traversal query requires a validated positive limit capped by a configured maximum
- [ ] #2 Result pages carry the graph generation and deterministic ordering needed to continue safely
- [ ] #3 Continuation cursors are opaque to callers, bound to their query and generation, and rejected when malformed, mismatched, or stale
- [ ] #4 Committed graph events identify the resulting generation and affected stable identities without exposing provider implementation details
- [ ] #5 The event contract explicitly signals a generation gap and directs consumers to refetch instead of guessing missed changes
- [ ] #6 Contract tests cover empty pages, exact-limit pages, continuation, invalid limits, cursor misuse, generation changes, and missed events
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define exact-read, bounded-page, cursor, graph-generation, and typed-event contracts.
2. Add validation for bounds and opaque cursor context.
3. Define deterministic continuation and generation-gap recovery semantics.
4. Supply reusable contract fixtures without implementing the 1B projection index.
5. Test pagination, cursor invalidation, event order, and recovery signals.
<!-- SECTION:PLAN:END -->
