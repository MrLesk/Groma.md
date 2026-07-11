---
id: GROM-7
title: Implement the technology-neutral graph kernel
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 20:45'
labels:
  - core
  - graph
milestone: m-1
dependencies:
  - GROM-5
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the smallest Core graph foundation needed by 1A: stable opaque identity, typed entities and relationships, safe reference resolution, deterministic ordering, and bounded graph primitives. Names and paths remain attributes rather than identity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The kernel mints stable opaque identifiers for every supported entity kind without deriving identity from a name or path
- [x] #2 Entities and relationships can be created, resolved, and ordered deterministically through technology-neutral contracts
- [x] #3 Dangling, wrong-kind, malformed, or ambiguous references return actionable diagnostics and never select a target by guesswork
- [x] #4 Public graph reads require explicit bounds or an exact identifier and do not expose an unbounded load-the-world operation
- [x] #5 Core graph tests cover identity stability across rename and move simulations, invalid relations, deterministic order, and bound enforcement
- [x] #6 The graph kernel has no imports from the standard model, Bun, local resources, Markdown, the host, or CLI code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define opaque entity identifiers, entity kinds, relationship primitives, and typed diagnostics.
2. Implement deterministic identity minting and exact resolution without name-based identity.
3. Implement relationship validation and bounded graph access primitives.
4. Add tests for rename continuity, malformed and wrong-kind references, ambiguity, ordering, and limits.
5. Verify the Core dependency boundary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started as a stacked branch from completed GROM-6 while draft PRs #1 and #2 await review.

Context-hunter classification: L2 foundational data semantics with no prior Core analogue. Implemented model-neutral kind and relation tokens, opaque ent_/rel_ identities from an injected 128-bit entropy source, immutable opaque snapshots, exact resolution, and bounded deterministic pages and traversal. Alias persistence remains deferred to the 1B Alias Store.

The kernel rejects malformed IDs and tokens, unknown references, wrong kinds, duplicate identities, invalid directions, unresolvable page anchors, invalid limits, entropy failures, and exhausted collision retries with actionable diagnostic codes. Duplicate identity is rejected while loading so ambiguity never enters a readable snapshot.

Local bun run check passes: architecture boundary scan confirms Core has only Core-relative imports; 18 tests pass with identity stability across rename and move payloads, exact typed relations, invalid relation cases, deterministic ASCII ordering, pagination limits, and bounded traversal; standalone build and smoke also pass.

GitHub Actions run 29167588295 passed on the first pushed kernel revision: Quality gates 11s, Linux x64 baseline 8s, macOS arm64 8s.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the technology-neutral Graph Kernel with injected opaque identity generation, model-neutral entity and relation tokens, immutable snapshots, exact fail-closed resolution, and explicitly bounded deterministic reads. Added diagnostics for malformed, dangling, wrong-kind, ambiguous, collision, direction, and bound failures plus 8 Core tests. The full 18-test repository gate and both target-binary CI jobs pass.
<!-- SECTION:FINAL_SUMMARY:END -->
