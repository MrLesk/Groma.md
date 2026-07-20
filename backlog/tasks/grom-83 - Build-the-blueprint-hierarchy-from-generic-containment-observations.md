---
id: GROM-83
title: Build the blueprint hierarchy from generic containment observations
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 20:57'
updated_date: '2026-07-20 21:08'
labels:
  - pivot
  - scanner
  - reconciliation
milestone: m-5
dependencies: []
priority: high
type: feature
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanners must report structure in a technology-neutral vocabulary: not package.json, directories, or modules, but simply that one candidate contains another. Core reserves a single relationship token, contains, that every scanner in any language emits (Go module to package to file, Java artifact to package to class, npm package to source boundary). Reconciliation recognizes it as structural containment and gives observed components their observed parent instead of a flat relationship, so a first scan produces a real hierarchy. Curated parents always win; evidence only owns what a human has not changed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The plugin SDK and core define one reserved, documented, technology-neutral containment relationship token that carries no language or packaging vocabulary
- [x] #2 The built-in TypeScript scanner emits containment for package-to-boundary and workspace-to-package instead of technology-named relationship types
- [x] #3 Reconciliation materializes observed containment as component parents rather than ordinary relationships, and never overwrites a curated parent
- [x] #4 Observed containment cycles or multiple parents fail closed, leaving the components unparented with an actionable diagnostic
- [x] #5 A scan of this repo produces the groma package as a root containing its source boundaries; bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reserve a technology-neutral containment relationship token in core observation contracts and re-export from the plugin SDK.
2. TypeScript scanner emits containment for package-to-boundary and workspace-to-package; emit the entryPoint signal where directly observable.
3. Reconciliation classifies containment records out of ordinary relationships, resolves them to component ids, and applies parent to evidence-owned components with cycle and multi-parent fail-closed handling.
4. Extend the component projection so parent participates in owned-value tracking; curated parents win.
5. Self-scan proof plus bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core reserves observedContainmentRelationshipType (the token contains), documented as the one structural claim every scanner can make in any language; the SDK re-exports it and the TypeScript scanner now emits it for both workspace-to-package and package-to-boundary instead of the technology-named workspace-member and source-boundary tokens. Reconciliation partitions containment records out of ordinary relationship records, resolves them through resolveObservedStructure into a parent map plus depth map, and applies parent to components in a structural pass that runs once every candidate has an identity. Ownership follows the existing evidence-owned rule: a structural value moves only when the component still holds what the last scan projected, so a curated parent or scale is never overwritten. Two bugs found and fixed while building it: newly created components never received the structural values because the merge only handled patches, and ownedUpdate silently dropped the structural fields from the stored projection, which broke rescan idempotence by making evidence forget what it had projected. Supported boundary: reconciliation writes parent directly through the transaction adapter rather than the reparent operation, so the scale containment invariant in operations is not re-checked there; it cannot be violated by construction because parent and scale are derived from the same forest in one pass. Evidence: a self-scan of this repo produces groma as a system root containing its eight source boundaries, and the document tree now mirrors the architecture (groma/components/groma/core.md). New tests cover hierarchy derivation, curated-value survival across rescans, and the ambiguous-container fail-closed path; bun run check green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanners now report structure in one technology-neutral way — that a component contains another — and reconciliation turns those observations into a real blueprint hierarchy. A scan of this repo yields groma as a system root over its eight source boundaries with no human annotation.
<!-- SECTION:FINAL_SUMMARY:END -->
