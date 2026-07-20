---
id: GROM-75
title: Report structural scale signals from blind scanners
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 17:45'
updated_date: '2026-07-20 18:31'
labels:
  - pivot
  - scanner
  - plugin-sdk
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanners measure, never classify: deciding whether something is a domain or a part is judgment, and judgment is intent. The plugin SDK evidence contract gains deterministic structural signals that are objective, countable, and blind — subtree size (files, exports), declared-boundary markers (package manifests, workspace roots, project references), entry-point markers (bins, served routes), and reuse breadth (imported by how many distinct sibling subtrees). The built-in TypeScript scanner emits them. As part of this, source-boundary demotes from a projected component type to a boundary-marker signal: it always named how a thing was found, not what it is. No scale vocabulary appears anywhere in the SDK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The plugin SDK evidence contract defines the structural signal fields with deterministic semantics and no scale vocabulary
- [x] #2 The built-in TypeScript scanner emits the signals, and the same source tree yields identical signal output across runs
- [x] #3 The scanner stops projecting source-boundary as a component type; the observation persists as a declared-boundary signal without identity churn for existing observed components
- [x] #4 Scanners remain blind: no blueprint access is added anywhere on the signal path
- [x] #5 bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the plugin SDK evidence contract and the built-in TypeScript scanner to map where candidates and projections are produced and how candidate keys derive (identity-churn risk for AC3).
2. Add deterministic structural signal fields to the SDK evidence contract with exact semantics: subtree file and export counts, declared-boundary marker, entry-point marker, reuse breadth across sibling subtrees.
3. Emit the signals from the TypeScript scanner; stop projecting source-boundary as a component type while keeping candidate identity stable.
4. Determinism and no-blueprint-access tests; bun run check green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Signals live as an optional signals record on component-candidate observations, defined in core (ComponentCandidateStructuralSignals: declaredBoundary, entryPoint, exportCount, fileCount, reuseBreadth — all optional, counts are non-negative safe integers, markers are booleans) and validated fail-closed in the session record inspection; the SDK re-exports the contract and contains no scale vocabulary. The TypeScript scanner attaches signals in a deterministic post-pass before the record sort: fileCount from boundary file lists, declaredBoundary for package and source-boundary candidates (the boundary observation is literally the marker), reuseBreadth as distinct importing candidates from the existing imports aggregation. The post-pass charges the enlarged records against the observation character budget — the scanner asserts re-measured totals never exceed charged totals, which the first version tripped. Candidate keys embed source-boundary only as an opaque hashed key-namespace token, so dropping the candidate type projection preserves every key: the self-scan of this repo proved no identity churn (ent_d444bd275e715ef4271bf65e5e3603f2 kept its id, actions, and relationships; only type: source-boundary left its frontmatter) while evidence projections now carry the signals. Supported boundary: the scanner emits declaredBoundary, fileCount, and reuseBreadth; entryPoint and exportCount stay contract-only until the scanner can defend them as direct observations (partial contributions are the manifesto norm). Four existing pins updated to the new shape, one extended to assert signal content; bun run check green at 449 tests plus the compiled Iteration 1A workflow; canonical self-scan diff committed with the change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanners now measure instead of classify: the plugin SDK defines deterministic structural signals on component candidates, the TypeScript scanner emits declaredBoundary, fileCount, and reuseBreadth, and source-boundary is demoted from a projected component type to the declared-boundary signal with candidate identity provably unchanged on this repo's own blueprint. GROM-76 can now derive scale proposals from these signals.
<!-- SECTION:FINAL_SUMMARY:END -->
