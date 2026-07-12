---
id: GROM-10
title: Implement the Core transaction engine
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 05:24'
labels:
  - core
  - transactions
milestone: m-1
dependencies:
  - GROM-7
  - GROM-11
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
1. Define immutable technology-neutral transaction requests, opaque content revisions, complete proposed-transaction views, registered invariant contracts, and confirmed/rejected/indeterminate outcome types in Core.
2. Validate and snapshot every mutation, expected revision, affected identity, current store snapshot, and provider response at runtime; reject duplicate or malformed revision expectations deterministically before provider prepare.
3. Read the current provider snapshot, detect immediately stale expectations, run every registered invariant against the same complete immutable proposal, and aggregate deterministic validation diagnostics before any prepare call.
4. Compute exactly one next graph generation and call an abstract provider prepare contract that atomically rechecks the base generation and expected revisions; map stale prepare races to conflict without canonical writes.
5. Coordinate commit and recovery with explicit confirmed/not-committed/indeterminate provider results. Return one canonical graph.committed event only after confirmed durable success, never expose a partial success, and never infer rollback after an uncertain commit.
6. Add boundary-local fault-injecting provider tests for malformed input, invariant aggregation/order, pre-prepare rejection, stale snapshot and concurrent prepare conflict, known commit failure, thrown/indeterminate commit, recovery to committed/not-committed/still-indeterminate, exact generation advancement, event ordering, and technology-neutral imports.
7. Run focused and full quality gates, all four standalone targets, independent specification and quality reviews, then publish a ready task-linked PR and complete Claude/Codex review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependency corrected before execution: the transaction engine publishes the committed-event contract owned by GROM-11, so GROM-11 must land first to avoid a competing event model.

Context-hunter classification: L2 foundational Core transaction boundary. GROM-11 is merged and supplies graph generations and committed-event contracts. GROM-10 will coordinate generic snapshot/revision, invariant, prepare, commit, and recovery capabilities only; filesystem, Markdown, local-resource, and journal technology remain outside Core. The full proposal and expected revisions must be validated before provider prepare. Confirmed durable success advances exactly one generation and returns one canonical committed event; uncertain provider completion remains an explicit indeterminate outcome rather than success or rollback fiction.

Implemented the Core transaction engine and technology-neutral provider protocol. Requests, provider snapshots, proposals, invariant diagnostics, prepare/commit responses, and recovery receipts are runtime-validated and defensively frozen. Provider prepare atomically rechecks base generation and revisions; committed and recovered events derive from provider-confirmed durable evidence. Added a fault-injecting provider suite covering stale expectations, full proposal invariant order/aggregation, concurrent prepare races, known and uncertain commit failures, all recovery outcomes, event ordering, forged shapes/accessors, immutable aliases, recovery forgery, and repeated idempotent recovery.

Quality-review hardening: bound provider result fields exactly to their status; malformed commit or recovery confirmations remain indeterminate. Added required configurable limits for affected identities, shared request GraphData depth/value occurrences, and independent snapshot-state depth/value occurrences. Structural copying counts repeated DAG paths, preflights dense arrays and affected-ID arrays before key enumeration when over limit, and preserves existing payload behavior when no structural budget is supplied. Invariant diagnostic details reject nested or oversized values descriptor-first. Added constructor, exact/N+1, deep-chain, shared-DAG, freezing, status-variant, and Proxy regressions. Verification: focused transaction suite 25 tests/143 assertions; full 95 tests/434 assertions; bun run check; all four standalone targets; git diff --check.
<!-- SECTION:NOTES:END -->
