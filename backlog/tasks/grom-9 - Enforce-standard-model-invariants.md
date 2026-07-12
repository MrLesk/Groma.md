---
id: GROM-9
title: Enforce standard-model invariants
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 05:56'
labels:
  - model
  - invariants
milestone: m-1
dependencies:
  - GROM-8
  - GROM-10
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
- [ ] #1 Every semantic mutation is checked for a valid component type, zero or one valid component parent, relationship targets, entity-kind compatibility, and stable embedded-item identity
- [ ] #2 Root components may omit a parent, non-root components resolve exactly one parent, and parents may contain children of the same or different types
- [ ] #3 Self-parenting, containment cycles, multiple structural parents, ambiguous identities, and ambiguous relationship targets fail closed with actionable diagnostics
- [ ] #4 Removing or reparenting a component fails unless the same atomic transaction leaves every child and relationship valid
- [ ] #5 Sparse updates preserve omitted curated fields and cannot silently erase existing intent or containment
- [ ] #6 The invariant contract can receive prior state and ownership context so later evidence and pinned-boundary protections do not require a new mutation path
- [ ] #7 Tests prove that identical invariants govern direct operation calls and host or CLI initiated mutations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a canonical Standard Model transaction envelope over the generic Core proposal: prior complete component/relation state, batched component create/patch/remove mutations, batched ordinary-relationship upsert/remove mutations, and explicit ownership/pinned-boundary context reserved for later evidence policy.
2. Build one registered Standard Model invariant that descriptor-validates the proposal envelope, rejects ambiguous or duplicate identities/mutation targets, and applies the complete batch in memory using the existing v0.1 normalize/parse/patch/relationship rules so sparse omissions preserve prior curated fields.
3. Validate the complete resulting graph after the batch: every entity is a valid component; roots omit parent; every present parent resolves to exactly one component; same-type and mixed-type nesting are allowed; self-parenting and cycles fail; every relationship identity/type/source/target/payload is valid and targets components; embedded item identities remain stable and unique.
4. Make component removal and reparenting atomic by validating children and ordinary relationships only against the final proposed graph. Reject partial removal, dangling children/relations, duplicate structural mutations, ambiguous state, and wrong-kind targets with actionable stable-ID diagnostics.
5. Preserve one semantic path by exposing a factory compatible with Core TransactionEngine.registerInvariant; prove direct operations and host/CLI-style wrappers invoke the same invariant. Validate ownership and pinned-boundary context shape without implementing scanners or reconciliation in Iteration 1A.
6. Add boundary-local tests for valid multiple roots, recursive same/mixed types, sparse patch preservation, atomic reparent/remove, valid cross-tree relationships, invalid tokens/parents/cycles/multiple mutations/ambiguous IDs/dangling or wrong-kind relations/embedded IDs/context, and shared transaction-path enforcement.
7. Run focused/full quality gates and all four standalone targets, independent specification and quality reviews, then publish a ready task-linked PR and complete Claude/Codex review gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependency corrected before execution: standard-model invariants register against the transaction boundary owned by GROM-10, so GROM-10 must land before GROM-9.

Context-hunter classification: L2 Standard Model semantic boundary. Reuse createStandardModelCapability normalization/patching and the generic Core ProposedTransaction/TransactionInvariant contracts. The invariant must interpret one complete batched mutation over one complete prior state, then validate the final graph so atomic reparenting/removal works and sparse omissions cannot erase intent. Ownership and pinned-boundary context are explicit forward-compatible data only; scanner/reconciliation behavior remains out of scope. Core remains model-neutral.

Implemented the GraphData-compatible Standard Model transaction envelopes and registered invariant factory. The bounded invariant safely validates context/state/mutation runtime shapes, reuses Standard Model normalize/parse/patch/relationship semantics, applies complete batches before final containment and endpoint validation, fails closed on ambiguous identities, and preserves the single Core TransactionEngine registration path. Pinned IDs are reserved context in 1A: sorted/unique and resolvable across prior or proposed state, without scanner/reconciliation authority policy. Added 14 focused tests including recursive containment, atomic reparent/removal, sparse preservation, relationship compatibility, cycles/ambiguity, unsafe shapes/bounds, and identical direct versus host-style engine rejection. Verification: focused 14 tests/40 assertions; full check 108 tests/472 assertions; all four standalone targets passed.

Final implementer verification after the compile-time GraphData envelope test and duplicate-relationship case: focused 14 tests/40 assertions; full check 109 tests/474 assertions; typecheck, formatting, architecture boundaries, native build/smoke, diff check, and macOS arm64/Linux x64 baseline/Windows x64 baseline/Windows arm64 target verification all passed.
<!-- SECTION:NOTES:END -->
