---
id: GROM-57
title: Restore agile delivery through net simplification
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-19 13:43'
updated_date: '2026-07-19 14:48'
labels: []
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
documentation:
  - DEVELOPMENT.md
priority: high
type: chore
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove premature and disproportionate infrastructure that has made the first useful Groma loop slow to deliver. This is one coherent subtraction-first cleanup before any further feature work. Preserve stable opaque identity, intent/evidence separation, scanner blindness, deterministic readable canonical state, intent and the last complete blueprint across failed or ambiguous scans, component/node separation, bounded deterministic output, and local-only no-upload behavior. Prefer deletion, direct composition, fewer files and protocols, and focused behavioral tests; do not introduce a replacement framework, policy engine, scoring system, or generalized architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Production and test code are materially reduced, with removed concepts and lines summarized objectively
- [x] #2 The immediate built-in TypeScript/Bun workflow remains composable without local third-party package acquisition, scaffolding, trust-ledger, or conformance breadth
- [x] #3 Canonical writes retain normal runtime validation, stable identity, deterministic serialization, atomic publication, and fail closed on ambiguity without same-process hostile-intrinsic or Proxy defense machinery
- [x] #4 Failed, cancelled, incomplete, or ambiguous scan work cannot erase curated intent or replace the last complete published blueprint; durable scan machinery is limited to what that promise requires
- [x] #5 Bounded blueprint reads remain reconstructable from canonical state while disposable projection persistence, repair, integrity-tree, and premature sharding machinery are removed or collapsed
- [x] #6 Premature schema migration, custom executable-format verification, certification benchmark, and oversized frozen self-blueprint verification are removed in favor of proportionate current-format and end-to-end checks
- [x] #7 Architecture and development documentation describe the simplified current boundary without changing MANIFESTO.md or claiming the future scan/reconcile/visual loop is delivered
- [ ] #8 Focused tests and the repository check demonstrate the preserved behavior and one ready-for-review PR is green and merged before the task is closed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove isolated premature surfaces first: automatic-blueprint certification fixtures, frozen self-blueprint verifier, custom executable-format parsing, and unreleased schema-migration commands/providers. 2. Collapse Host composition to built-in and explicitly supplied official plugins; delete local package acquisition, scaffolding, trust/lock, loader, and conformance breadth while retaining the shared runtime API used by built-ins. 3. Replace durable disposable-projection bundles, Merkle proofs, repair and continuity with one bounded in-memory projection rebuilt from canonical state, keeping the existing shared bounded query semantics. 4. Replace durable provisional scan journaling, recovery, heartbeat expiry and lane quarantine with bounded in-process execution that publishes only a successfully completed snapshot to the consumer; keep cancellation and atomic canonical publication downstream. 5. Replace same-process hostile-value/Proxy/intrinsic defenses with ordinary shape validation and owned copies at canonical boundaries, pruning tests that assert implementation defenses rather than product behavior. 6. Update current architecture/development documentation, retain a few high-value compiled CLI and scanner fixtures, run focused checks then the proportionate repository gate, quantify net deletion, and perform one independent complete audit before the ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-module simplification. Supported semantic boundary: the built-in TypeScript/Bun scanner reports only its documented bounded static syntax; ambiguous or unsupported syntax yields partial/no evidence. Only completed scans are eligible for reconciliation/publication. The cleanup does not promise crash-resumable provisional scans, third-party package acquisition, hostile same-process object containment, pre-release schema compatibility, custom binary parsing, persistent disposable projections, or organization-scale certification.

Implemented subtraction-first cleanup: 96 changed files, 69,305 lines removed and 1,334 added overall. Removed local plugin packages and package declarations, schema migration, durable observation recovery, evidence sharding, persistent projection bundles/Merkle/repair/checkpoints, custom executable parsing, the certification benchmark, and frozen self-blueprint/foundation proof suites. Replaced them with built-in-only scanner composition, completed-snapshot-only in-process scan execution, an in-memory reconstructable projection, ordinary same-process validation, and focused compiled verification. One bounded independent audit confirmed the same major seams; no repeated open-ended review loop was started. bun run check passes: formatting, types, boundaries, 386 tests, native build/smoke, and compiled crash-recovery workflow. bun run check:targets cross-compiles four targets, runs the host-compatible workflow, and restores the native artifact. Two automatic Codex review passes identified seven valid refresh, reservation, shutdown, and cancellation races. The fixes invalidate failed projection refreshes, serialize projection publication, reserve scan keys before asynchronous setup, prevent post-shutdown scan starts, clean synchronous cancellation registration, and propagate cancellation through completed-snapshot consumption; focused regressions cover each behavior. Claude was invoked once as required, but its sandbox could not read the pull request or local diff and it returned no substantive findings.
<!-- SECTION:NOTES:END -->
