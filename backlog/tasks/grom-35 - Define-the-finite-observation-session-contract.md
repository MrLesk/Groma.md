---
id: GROM-35
title: Define the finite observation-session contract
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 06:28'
labels: []
milestone: m-3
dependencies:
  - GROM-21
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/core/observation.ts
  - src/core/index.ts
  - src/core/README.md
  - src/core/tests/observation.test.ts
  - src/plugin-sdk/scanner.ts
  - src/plugin-sdk/index.ts
  - src/plugin-sdk/README.md
  - tests/fixtures/conforming-scanner.ts
  - tests/scanner-sdk.test.ts
priority: high
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give blind scanners a versioned, bounded way to report partial evidence and provenance without seeing the existing blueprint, choosing canonical identities, or mutating intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The public contract represents session begin, bounded observation batches, heartbeat, completion, failure, source identity, project identity, declared scope, coverage, and provenance
- [x] #2 Observations can report defensible subsets of component candidates, inputs, outputs, actions, relationships, and raw documentation evidence without completing a component
- [x] #3 Observation keys are stable only within their declared source and scope and cannot be supplied as canonical component IDs or bindings
- [x] #4 Contradictory records, invalid keys, undeclared scope, invalid provenance, stale epochs, and records after completion fail with stable diagnostics
- [x] #5 A scanner receives project resources and configuration but no blueprint entities, curated intent, aliases, bindings, or reconciliation decisions
- [x] #6 Contract tests cover large bounded batches, cancellation, heartbeat expiry, and partial contributions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a versioned Core observation-session contract for begin, bounded batches, heartbeat, completion, failure, cancellation, and explicit expiry, binding project/source identity, declared scope, epoch, coverage, and provenance.
2. Define a sparse observation-record union for component candidates, inputs, outputs, actions, relationships, and raw documentation evidence; validate, defensively copy, deterministically order, and freeze accepted state without reusing canonical graph/model IDs or bindings.
3. Enforce stable scoped observation keys and atomic lifecycle rules with stable diagnostics for contradictory records, invalid keys/provenance/scope, stale epochs, terminal writes, bounds, cancellation, and heartbeat expiry.
4. Publish a selective scanner SDK facade with a read-only bounded project-resource/configuration request, cancellation, and observation sink, explicitly excluding blueprint entities, intent, aliases, bindings, reconciliation, and mutation capabilities.
5. Add hostile-value, large-batch, lifecycle, partial-contribution, cancellation/expiry, and external-package-shaped contract tests; document the semantic boundary and run focused plus full repository verification and independent review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context classification: L2 public Core/SDK semantic contract. Core owns the finite in-process observation vocabulary and lifecycle; the SDK narrows scanner authority. External transport grammar remains deferred, persistence belongs to GROM-36, and scanner execution/orchestration belongs to GROM-39. No Application, Persistence, Host composition, canonical graph entity, binding, alias, or reconciliation API was added.

Implemented groma.observation/v1 with immutable project/source/epoch/scope binding; sparse component, member, relationship, and documentation contributions; source/scope-local keys; scope-root-bound fingerprint provenance with optional half-open byte ranges; atomic deterministic batches and replay/contradiction semantics; explicit coverage, heartbeat, completion, failure, cancellation, and logical expiry; completed-only frozen snapshots; stable diagnostics; descriptor-only hostile-value containment; and cumulative record, batch, signal, character, provenance, and text bounds. Published groma.scanners/v1 / groma.scanner/v1 through groma/plugin-sdk with canonical configuration, fail-closed cancellation, scoped read-only bounded resources, owned bytes/pages/diagnostics, and a one-way observation sink that withholds completed snapshots.

Independent contract audit approved the lifecycle, blindness, provenance, partiality, bounds, and diagnostic semantics. Independent quality review found two final defects: post-acceptance receipt validation reread scanner-owned batch properties, and returned enumeration entries did not enforce maxDepth. Both were fixed with descriptor-captured expectations, hostile Proxy coverage, and LocalResourceProvider-compatible depth semantics; the quality re-review approved. Objective evidence: focused Core/SDK/plugin suite passed 33 tests / 210 assertions; final bun run check passed formatting, strict TypeScript, architecture boundaries, 904 tests / 6,689 assertions, native build, binary smoke, Iteration 1A/1B, and self-blueprint verification. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the finite blind-observation contract and public scanner authoring boundary. Groma now accepts bounded, sparse, provenance-backed scanner evidence through atomic finite sessions without exposing curated blueprint meaning or mutation authority; only successful completion yields coverage and a frozen evidence snapshot. Verified by 33 focused tests / 210 assertions, the complete 904-test / 6,689-assertion repository gate, build/smoke and Iteration 1A/1B/self-blueprint checks, plus independent contract and quality approval.
<!-- SECTION:FINAL_SUMMARY:END -->
