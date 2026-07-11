---
id: GROM-16
title: Compose the Iteration 1A default local host
status: To Do
assignee: []
created_date: '2026-07-11 17:35'
updated_date: '2026-07-11 17:36'
labels:
  - host
  - bootstrap
milestone: m-1
dependencies:
  - GROM-5
  - GROM-12
  - GROM-15
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the official 1A composition root for the compiled local executable. It selects the workspace context, assembles built-in capabilities explicitly, performs journal recovery before reads or mutations, dispatches a selected surface, and shuts down cleanly. Full two-phase plugin discovery remains 1B.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The host can start without an initialized workspace so the initialization operation remains available
- [ ] #2 Commands requiring a workspace receive a typed no-workspace diagnostic rather than an implicit empty graph or filesystem error
- [ ] #3 The 1A graph, model, invariants, resources, store, journal, query adapter, operations, and surface are composed through explicit capability interfaces rather than hidden global singletons
- [ ] #4 Startup completes or reports transaction-journal recovery before serving any semantic read or mutation
- [ ] #5 Built-in composition is isolated behind a bootstrap registry that can be replaced by the 1B plugin runtime without changing Core or application operation contracts
- [ ] #6 Cancellation and process signals stop active host work and release local coordination resources deterministically
- [ ] #7 The 1A host does not start an HTTP server, bundle React, discover project plugins, or load untrusted project code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define the process context, workspace selection, cancellation, and surface-dispatch boundaries.
2. Assemble all 1A built-ins through explicit capability registrations.
3. Add no-workspace and initialized-workspace startup paths.
4. Run recovery before operation dispatch and coordinate shutdown.
5. Add host lifecycle tests while preserving the future Plugin Runtime insertion point.
<!-- SECTION:PLAN:END -->
