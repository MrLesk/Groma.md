---
id: GROM-8
title: Implement the standard v0.1 blueprint model
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 01:44'
labels:
  - model
milestone: m-1
dependencies:
  - GROM-7
  - GROM-19
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the official standard-model plugin contract over the graph kernel. The model represents every architectural node as a recursively nestable component with an open type token, zero or one structural parent, the approved minimal meaning vocabulary, and partial semantic contributions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The model represents components, open type tokens, optional structural parents, intent, inputs, outputs, actions, relationships, lifecycle metadata, and desired state with stable identifiers
- [x] #2 Root components have no parent, every non-root component has exactly one parent, and deterministic child views support recursive same-type or mixed-type containment
- [x] #3 The structured component vocabulary does not introduce independent schemas for requirements, state, guarantees, triggers, or effects
- [x] #4 Partial create or update inputs preserve omitted fields and do not require every component field to be populated
- [x] #5 Normalization and ordering produce the same semantic model for equivalent input regardless of property insertion order
- [x] #6 Unknown namespaced extension metadata survives model parse, normalization, mutation, and serialization round trips
- [x] #7 The standard model is supplied through an explicit model capability and is not embedded as meaning inside the graph kernel
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the standard component entity contract over Core graph data: kind component, open type, optional single parent identity, optional intent, inputs, outputs, actions, lifecycle, desired state, ordinary graph relationships, and preserved extension data.
2. Expose the model through an explicit StandardModelCapability factory with parse, normalize, sparse-patch, serialize, and deterministic child-view operations; keep global invariants out of this task for GROM-9.
3. Normalize canonical records and embedded item ordering without closing lifecycle, desired-state, component-type, or extension vocabularies.
4. Preserve omitted fields during sparse mutations and preserve unknown extension metadata through parse, normalization, mutation, and serialization.
5. Add boundary-local tests for roots, same-type and mixed-type recursion, the Shopify hierarchy, a full Ordering component, sparse components and patches, equivalent-input determinism, extensions, relationship identity, and Core independence.
6. Run focused tests, full quality gates, four-target verification, independent spec and quality review, then publish a ready task-linked PR and complete Claude/Codex review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 foundational model contract. Reuses Core GraphData, stable EntityId/RelationId, Result diagnostics, and boundary-local test conventions. Architecture decisions: component kind is the graph-level discriminator; model type, lifecycle, and desired state remain open tokens; parent is standard-model structural metadata resolved by later invariants; ordinary relationships retain Core graph identity; global single-parent/acyclic enforcement remains GROM-9.

Implemented the explicit standard-model capability in src/standard-model. Component entities use Core kind component with optional parent payload identity (absence is a root), canonical stable-ID inputs/outputs/actions, open type/lifecycle/desired tokens, sparse null-clearing patches, namespaced extension preservation, deterministic bounded child views, and read-only Core-relation views. Added 9 model tests covering sparse roots, recursive Shopify containment, full Ordering meaning, deterministic normalization, sparse patches, extension round trips, relationship identity, vocabulary limits, and Core independence. Local verification passed: bun run check (36 tests, 124 assertions), bun run check:targets (macOS arm64, Linux x64 baseline, Windows x64 baseline, Windows arm64), immediate bun run smoke, and git diff --check. Acceptance criteria remain unchecked pending independent and external review.

Quality-review corrections: serialize now copies the complete public component value through Core before reading it, validates component and embedded-item public shapes, requires nested extension keys to remain namespaced, and prevents extensions from shadowing identity or standard fields. Added accessor, component id/name collision, item id/name collision, invalid extension, and relationship authority regressions. Child views now ignore non-component records from heterogeneous bounded Core pages while continuing to diagnose malformed component-kind records. Verification passed with 38 tests and 136 assertions plus all four binary targets and immediate native smoke.

PR #6 validation passed: local bun run check with 38 tests and 136 assertions, four-target check:targets, immediate native smoke, GitHub Actions run 29175596593 (Quality gates and Cross-platform binaries), independent spec review, and independent quality review after correcting heterogeneous child views and public extension serialization. Codex bot accepted the ready PR with no comments. Claude was invoked for text, naming, simplicity, and user-perspective review and returned no written feedback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the explicit standard v0.1 model capability over Core with sparse recursively nestable components, open structural and lifecycle tokens, stable embedded and relationship identities, deterministic normalization and child views, safe sparse patches, and namespaced extension round trips. Kept Core model-neutral and deferred transaction-wide containment invariants to GROM-9. Verified locally, across four binary targets, in GitHub Actions, and by independent and automated review.
<!-- SECTION:FINAL_SUMMARY:END -->
