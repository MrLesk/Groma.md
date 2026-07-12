---
id: GROM-11
title: Define bounded query and graph-event contracts
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 01:58'
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
1. Define branded nonnegative graph generations, exact read results, validated bounded query requests, deterministic generation-bearing pages, opaque continuation cursors, and committed/gap event types in Core.
2. Canonicalize a technology-neutral query context and encode cursor state containing version, generation, query binding, and deterministic continuation anchor without exposing provider internals through the public type.
3. Validate positive capped limits and fail closed on malformed cursors, wrong query binding, and stale generation before a provider continues a page.
4. Define committed events with sorted affected entity/relation identities and an event-sequence helper that emits an explicit refetch-required generation gap instead of inferring missed changes.
5. Add boundary-local contract tests for exact reads, empty/exact-limit/continued pages, invalid bounds, cursor misuse/staleness, deterministic event identities, contiguous events, duplicates/out-of-order events, and generation gaps.
6. Run focused tests, full quality and four-target gates, independent reviews, then publish a ready task-linked PR and complete Claude/Codex review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reviewed for GROM-19: recursive containment remains Standard Model policy. GROM-11 intentionally keeps Core query and event contracts generic; model and application layers interpret bounded relation traversal as parent or child hierarchy.

Context-hunter classification: L2 foundational Core contract. Reuses Core stable IDs, canonical GraphData copying, Result diagnostics, and bounded graph conventions. This task defines portable contracts and deterministic helpers only; the fast projection provider remains 1B. Cursor opacity is an API boundary rather than secrecy, and cursor state is self-contained so short-lived CLI processes can continue pages.

Implemented provider-neutral query and event contracts in Core: branded safe graph generations; generation-bearing exact reads and bounded pages; self-contained canonical GraphData cursors with explicit character budgets and fail-closed version/query/generation validation; deterministic committed events; and contiguous-generation/refetch sequencing. Added 13 boundary-local contract tests covering 46 assertions. Full local quality gate passes with 51 tests total. Acceptance criteria remain unchecked pending independent and external review.
<!-- SECTION:NOTES:END -->
