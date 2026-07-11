---
id: GROM-12
title: Implement the local resource provider
status: To Do
assignee: []
created_date: '2026-07-11 17:34'
updated_date: '2026-07-11 17:36'
labels:
  - persistence
  - resources
milestone: m-1
dependencies:
  - GROM-5
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the official Bun-backed local resource capability used by configuration and canonical persistence without leaking filesystem concepts into Core. Provide confined reads, bounded enumeration, coordination, staged writes, and atomic replacement with explicit unsupported-context diagnostics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Callers use typed resource locators and capability methods rather than Bun file APIs or raw filesystem paths outside the provider
- [ ] #2 Workspace-scoped locators reject traversal or resolution outside the selected workspace boundary
- [ ] #3 Reads distinguish missing, unreadable, malformed-locator, and provider-failure outcomes
- [ ] #4 Enumeration requires explicit bounds, returns deterministic order, and reports truncation or continuation without silently loading an unbounded tree
- [ ] #5 Atomic replacement never exposes a partially written target and preserves either the prior or replacement bytes across injected failures
- [ ] #6 Local coordination supports the documented 1A host contexts and returns an explicit unsupported diagnostic elsewhere
- [ ] #7 Temporary-directory tests cover Unicode paths, interrupted writes, concurrent coordination, traversal attempts, ordering, and bounds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define technology-neutral resource-locator and provider capability contracts outside Core semantics.
2. Implement Bun-backed confined resolution, reads, metadata, and bounded enumeration.
3. Implement local coordination and staged atomic replacement.
4. Add fault injection around write, flush, rename, and cleanup phases.
5. Test platform edge cases for every target in the 1A support matrix.
<!-- SECTION:PLAN:END -->
