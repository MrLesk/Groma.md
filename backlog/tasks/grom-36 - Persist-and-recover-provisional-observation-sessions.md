---
id: GROM-36
title: Persist and recover provisional observation sessions
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 09:52'
labels: []
milestone: m-3
dependencies:
  - GROM-35
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/core/README.md
  - src/core/observation.ts
  - src/core/payload.ts
  - src/core/tests/observation.test.ts
  - src/persistence/README.md
  - src/persistence/index.ts
  - src/persistence/local-observation-journal.ts
  - src/persistence/tests/fixtures/observation-crash-child.ts
  - src/persistence/tests/local-observation-journal.test.ts
priority: high
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make scan execution crash-safe by journaling provisional sessions separately from canonical evidence and exposing only successfully completed snapshots to reconciliation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Provisional observations, session epoch, scope, coverage, heartbeats, and completion state survive process interruption without appearing as committed evidence
- [x] #2 Only one valid completed snapshot per active epoch becomes eligible for reconciliation
- [x] #3 Expired, superseded, failed, contradictory, and incomplete sessions are abandoned with actionable diagnostics and cannot imply missing evidence
- [x] #4 Recovery after interruption exposes either the prior committed evidence or one complete newly reconciled result, never a partial scan
- [x] #5 Session cleanup is deterministic and cannot delete canonical intent, prior completed evidence, or another source session
- [x] #6 Crash and restart tests cover begin, batch append, heartbeat, completion, handoff, abandonment, and cleanup boundaries
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the internal Core observation contract with a versioned immutable compact checkpoint: exact resolved bounds, canonical begin data, and an ordered sequence of Core-owned accepted transitions. Batch transitions retain only newly accepted unique records while preserving empty/replay-only batch transitions; checkpoint restoration validates the envelope and replays exclusively through the existing ObservationSession methods.
2. Add a Persistence-owned asynchronous local observation journal using one bounded deterministic operational file per logical source lane at groma/observation-sessions/<lane-hash>.json. Derive the lane from projectId plus source id/instance, retain the full identity in the checkpoint, negotiate a LocalResourceProvider-compatible session profile before begin, and use exact canonical JSON, local coordination, staged replacement/readback, and stable diagnostics.
3. Fence lifecycle and delivery: make begin durable before exposing a handle; acknowledge each Core signal only after durable publication; poison the handle after unconfirmed publication; reject stale/concurrent lane operations before body inspection; durably abandon failed, cancelled, expired, contradictory, superseded, and recovered-incomplete sessions; expose only replay-validated completed snapshots through one deterministic at-least-once handoff token; require acknowledgement before epoch-scoped cleanup.
4. Implement bounded restart recovery and deterministic cleanup. Recovery validates every lane independently, never resumes an interrupted scanner, reoffers the identical completed token/snapshot until acknowledgement, and never treats active/abandoned/corrupt state as coverage or absence. Cleanup removes only the exact acknowledged or abandoned lane file and preserves intent, transaction state, prior evidence sentinels, projections, newer epochs, and other sources.
5. Add Core hostile-value/checkpoint equivalence tests plus Persistence lifecycle, concurrency, bounds, provider-fault, and real child-process crash/restart tests for begin, batch, heartbeat, completion, handoff, abandonment, acknowledgement, and cleanup. Document the operational-vs-canonical boundary, then run focused tests, typecheck, architecture boundaries, the full repository/build/smoke/Iteration/self-blueprint gates, diff/backlog checks, and independent contract and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started after GROM-35 merged as PR #36 at 71d4b57.

Context classification: L2 high-risk durability boundary. Core owns one versioned compact checkpoint made from canonical begin data, exact resolved bounds, and accepted transitions. Restoration captures hostile containers once within explicit character, depth, and value budgets, memoizes shared containers, reserves shallow parents, and replays only through ordinary ObservationSession methods. Persistence stores one bounded operational file per project and source lane at groma/observation-sessions/<lane-hash>.json. It never turns provisional scanner output into canonical evidence.

The local journal durably fences begin and every accepted signal, compares the complete expected checkpoint before inspecting a handle body, poisons handles after uncertain publication, uses proven-dead exact-lane coordination, and treats unresolved retained leases as settlement-only. Active supersession is a durable retry boundary. Completed available or pending handoffs cannot be overwritten; deterministic tokens are reoffered until acknowledgement. Recovery returns exact acknowledged cleanup requests, abandons interrupted sessions without implying absence, and cleanup targets only one eligible lane and epoch while reclaiming known orphan stages.

Review remediation added stateful alias and reserved-parent hostile cases, canonical completed/superseded corruption rejection, same-revision divergent checkpoint fencing, default-lock immediate recovery, exact byte-preservation checks, orphan-stage recovery, retryable and thrown release settlement, and release-success-then-throw competitor contention. Real child processes exit inside provider write, flush, rename, file-sync, directory-sync, and removal phases and prove exact old-or-new recovery with complete records, coverage, and stable tokens.

Final parent verification: bun run check passed format, TypeScript, architecture boundaries, native build and smoke, Iteration 1A and 1B, and self-blueprint. Direct bun test passed 934 tests and 6,889 assertions across 42 files. Original acceptance and quality reviewers approved the final diff. git diff --check and Backlog doctor are clean. External framing, scanner orchestration, project registry, canonical evidence and bindings, reconciliation, CLI wiring, and extreme-scale sharding remain assigned to later tasks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented bounded Core-owned observation checkpoints plus a crash-safe per-source local journal. Recovery exposes only replay-validated completed snapshots, durably abandons incomplete sessions, fences concurrent and superseded epochs, preserves unacknowledged handoffs, reclaims known orphan stages, and cleans only exact eligible lane state. Verified with hostile alias/corruption tests, provider-phase real-process crash tests, lease-contention probes, 934 repository tests / 6,889 assertions, the complete build/smoke/Iteration/self-blueprint gate, and independent acceptance and quality approval.
<!-- SECTION:FINAL_SUMMARY:END -->
