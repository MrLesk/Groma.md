---
id: GROM-21
title: Implement the phased plugin runtime
status: To Do
assignee: []
created_date: '2026-07-14 19:56'
labels: []
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make capability composition an explicit Core service so the official host, built-in providers, scanners, and third-party plugins all resolve through one deterministic runtime instead of private wiring.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 0 and Phase 1 plugin manifests and capability registrations resolve to one deterministic dependency graph
- [ ] #2 Missing dependencies, incompatible versions, capability collisions, invalid cardinality, and dependency cycles fail before affected plugins start and produce actionable diagnostics
- [ ] #3 Start, cancellation, failure cleanup, and shutdown follow dependency-safe lifecycle ordering
- [ ] #4 Official built-in capabilities use the same runtime registration path available to third-party plugins
- [ ] #5 Tests cover multiple providers, lifecycle failure, cancellation, and deterministic diagnostics without introducing technology-specific concerns into Core
<!-- AC:END -->
