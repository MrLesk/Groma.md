---
id: GROM-7
title: Implement the technology-neutral graph kernel
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 22:07'
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
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the implemented graph identity, relation, diagnostic, and bounded-read contracts.
2. Move Core tests into src/core/tests, CLI tests into src/cli/tests, and tooling tests into scripts/tests without changing behavior.
3. Update relative imports and document the boundary-local test convention.
4. Run targeted tests, the architecture checker, the full local gate, and four-target cross-compilation.
5. Require the ready GROM-7 PR checks to pass before re-finalizing the task.
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
<!-- SECTION:NOTES:END -->
