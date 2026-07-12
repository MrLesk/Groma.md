---
id: GROM-7
title: Implement the technology-neutral graph kernel
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 00:15'
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
- [x] #7 Tests are organized in boundary-local tests directories so production module roots remain readable as each subsystem grows
- [ ] #8 Entity and relation payloads are defensively copied into deeply immutable data values so caller-owned aliases cannot mutate any existing snapshot
- [ ] #9 Bulk load validates into one local graph state and creates one snapshot without per-item map copies, with representative scale coverage
- [ ] #10 Payload validation rejects Array subclasses and arrays with custom prototypes according to the documented canonical graph data contract
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define and document the graph payload data contract, then defensively clone and deeply freeze entity and relation payloads at every mutation and load boundary.
2. Reject unsupported behavior-bearing shapes, including Array subclasses and arrays with custom prototypes, with actionable diagnostics.
3. Refactor bulk load to validate entities and relations into one local state and create one snapshot while preserving fail-closed diagnostics.
4. Add regression and representative-scale coverage, run all local and cross-target gates, and require fresh review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started as a stacked branch from completed GROM-6 while draft PRs #1 and #2 await review.

Context-hunter classification: L2 foundational data semantics with no prior Core analogue. Implemented model-neutral kind and relation tokens, opaque ent_/rel_ identities from an injected 128-bit entropy source, immutable opaque snapshots, exact resolution, and bounded deterministic pages and traversal. Alias persistence remains deferred to the 1B Alias Store.

The kernel rejects malformed IDs and tokens, unknown references, wrong kinds, duplicate identities, invalid directions, unresolvable page anchors, invalid limits, entropy failures, and exhausted collision retries with actionable diagnostic codes. Duplicate identity is rejected while loading so ambiguity never enters a readable snapshot.

Local bun run check passes: architecture boundary scan confirms Core has only Core-relative imports; 18 tests pass with identity stability across rename and move payloads, exact typed relations, invalid relation cases, deterministic ASCII ordering, pagination limits, and bounded traversal; standalone build and smoke also pass.

GitHub Actions run 29167588295 passed on the first pushed kernel revision: Quality gates 11s, Linux x64 baseline 8s, macOS arm64 8s.

Reopened with Alexs explicit authorization to standardize the current test layout in the GROM-7 PR. This is a mechanical refactor: Bun and TypeScript recurse into tests directories, while the architecture checker retains src/core/tests as Core and src/cli/tests as CLI.

Moved all current tests into owner-local directories: src/core/tests, src/cli/tests, and scripts/tests. Updated only relative imports and documented the convention in DEVELOPMENT.md. Bun still discovers all 18 tests recursively, TypeScript includes the nested files, and the architecture checker continues to classify Core and CLI tests by their owning boundary.

Validation after the move: targeted tests 18 pass; architecture boundaries pass; full bun run check passes; check:targets cross-compiles macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 and executes the local macOS target.

GitHub Actions run 29169983659 passed after the test layout change: Cross-platform binaries 9s and Quality gates 10s.

Reopened during mainline restoration after independent quality review reproduced mutable caller-owned payload aliases and quadratic bulk loading. The correction will enforce defensively copied immutable data payloads, build one validated snapshot per bulk load, retain representative scale coverage, and resolve the target-verifier artifact and support-policy inconsistencies.

Fresh quality review found that Array.isArray alone admits subclasses and custom-prototype arrays despite the documented plain-array payload contract. The correction will require the intrinsic Array prototype and add regression coverage.

Payload validation now requires Array.prototype exactly, rejecting both Array subclasses and manually replaced prototypes with unsupported-payload diagnostics. Focused graph tests and the full quality and target gates pass; acceptance criteria remain unchecked pending external review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the technology-neutral graph kernel with opaque stable identity, typed relations, actionable reference diagnostics, deterministic bounded reads, and boundary-local test directories. Verified with 18 passing Bun tests, architecture and type/format gates, standalone smoke testing, and cross-compilation for macOS arm64, Linux x64, Windows x64, and Windows arm64; ready PR checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
