---
id: GROM-35
title: Define the finite observation-session contract
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 07:03'
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

Claude review approved the contract, security posture, atomicity, and scanner blindness. Two narrow follow-ups were independently accepted: remove a hidden derived per-record character ceiling so the exported maxCanonicalCharacters bound is authoritative, and state that coverage declares inspected scope/kinds rather than emitted-record presence. Added a provenance-rich record above the former hidden cap with exact-bound success and one-character-under atomic failure. The suggested inspector/helper consolidation was not applied because Core and SDK have deliberately distinct canonicalization semantics and no correctness defect was identified. Post-review validation passed 34 focused tests / 215 assertions and the complete 905-test / 6,694-assertion gate.

Codex automated PR review produced three findings. Independent contract and quality audits confirmed two actionable GROM-35 defects: empty resource-enumeration pages bypassed the configured page-character cost when fixed/cursor overhead alone exceeded the bound, and Core accepted control characters in scope/provenance resource locators that the supported scanner resource authority could not address. Both were fixed with exact-bound/cursor-overhead and tab/LF/CR/Unicode regressions. The candidate metadata proposal was not applied: observation hints are bounded source evidence rather than prevalidated Standard Model payload, and model-specific canonical validation belongs to GROM-41 reconciliation; Core documentation now makes that boundary explicit. Claude independently approved the final-head contract after calling out the same locator consistency issue. Independent remediation re-review approved. Post-remediation verification passed 35 focused tests / 225 assertions and the complete check: formatting, strict TypeScript, architecture boundaries, 906 tests / 6,704 assertions, native build and smoke, Iteration 1A/1B, and the 43-component self-blueprint.

Final implementation gate for cff44d6: GitHub Actions run 29634816591 passed Quality gates, Cross-platform binaries, and Native Windows binary. The required exact-head Claude review approved with only non-blocking diagnostic naming/documentation suggestions; no correctness or security defect was identified. The fresh Codex review completed with a +1 reaction after the two actionable findings were fixed and independently re-reviewed. GROM-35 is ready to merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the finite blind-observation contract and public scanner authoring boundary. Groma now accepts bounded, sparse, provenance-backed scanner evidence through atomic finite sessions without exposing curated blueprint meaning or mutation authority; only successful completion yields coverage and a frozen evidence snapshot. Verified by 35 focused tests / 225 assertions, the complete 906-test / 6,704-assertion repository gate, build/smoke and Iteration 1A/1B/self-blueprint checks, independent contract and quality approval, and Claude plus Codex review with the two actionable correctness findings applied and the model-layer suggestion rejected as architecturally out of scope.
<!-- SECTION:FINAL_SUMMARY:END -->
