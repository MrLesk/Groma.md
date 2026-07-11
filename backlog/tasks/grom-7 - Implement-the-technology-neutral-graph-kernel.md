---
id: GROM-7
title: Implement the technology-neutral graph kernel
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
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
- [ ] #1 The kernel mints stable opaque identifiers for every supported entity kind without deriving identity from a name or path
- [ ] #2 Entities and relationships can be created, resolved, and ordered deterministically through technology-neutral contracts
- [ ] #3 Dangling, wrong-kind, malformed, or ambiguous references return actionable diagnostics and never select a target by guesswork
- [ ] #4 Public graph reads require explicit bounds or an exact identifier and do not expose an unbounded load-the-world operation
- [ ] #5 Core graph tests cover identity stability across rename and move simulations, invalid relations, deterministic order, and bound enforcement
- [ ] #6 The graph kernel has no imports from the standard model, Bun, local resources, Markdown, the host, or CLI code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define opaque entity identifiers, entity kinds, relationship primitives, and typed diagnostics.
2. Implement deterministic identity minting and exact resolution without name-based identity.
3. Implement relationship validation and bounded graph access primitives.
4. Add tests for rename continuity, malformed and wrong-kind references, ambiguity, ordering, and limits.
5. Verify the Core dependency boundary.
<!-- SECTION:PLAN:END -->
