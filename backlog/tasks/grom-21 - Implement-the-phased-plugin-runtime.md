---
id: GROM-21
title: Implement the phased plugin runtime
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 02:06'
labels: []
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - backlog/tasks/grom-21 - Implement-the-phased-plugin-runtime.md
  - src/application/promise-observation.ts
  - src/core/README.md
  - src/core/index.ts
  - src/core/plugin-runtime.ts
  - src/core/promise-observation.ts
  - src/core/tests/plugin-runtime.test.ts
  - src/host/README.md
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/lifecycle.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
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
- [x] #1 Phase 0 and Phase 1 plugin manifests and capability registrations resolve to one deterministic dependency graph
- [x] #2 Missing dependencies, incompatible versions, capability collisions, invalid cardinality, and dependency cycles fail before affected plugins start and produce actionable diagnostics
- [x] #3 Start, cancellation, failure cleanup, and shutdown follow dependency-safe lifecycle ordering
- [x] #4 Official built-in capabilities use the same runtime registration path available to third-party plugins
- [x] #5 Tests cover multiple providers, lifecycle failure, cancellation, and deterministic diagnostics without introducing technology-specific concerns into Core
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add bounded, exact Core plugin manifest/registration contracts and a deterministic two-phase resolver that validates exact API/capability versions, cardinality, phase direction, provider collisions, missing requirements, and cycles before startup.
2. Add a technology-neutral lifecycle runtime that starts providers before dependents, exposes immutable resolved/running graph inspection, adapts cancellation through a minimal Core token, and performs exactly-once reverse dependency cleanup with contained deterministic diagnostics.
3. Recompose the official local host as meaningful built-in plugin registrations through that same Core runtime, preserve capability identity and existing CLI/surface lifecycle, and expose the running graph for conformance.
4. Add focused Core resolver/lifecycle and Host parity tests plus Core/Host documentation, then run focused and full validation, audit the cumulative diff, update exact Backlog evidence/modified files, and commit a clean branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L3 public Core/Host contract change. The existing 1A HostBootstrapRegistry privately wires local resources, model, persistence, transaction/query/application/workspace, and surface capabilities; runHost separately owns process AbortSignal and surface cleanup. The implementation will keep Core free of filesystem, AbortSignal, configuration, dynamic loading, and package acquisition, use exact current version compatibility rather than a semver solver, and preserve the hostile Host boundary and current surface lifecycle.

Implemented Core PluginRuntime with bounded exact manifest/registration validation, one deterministic Phase 0/Phase 1 graph, exact groma.plugin/v1 and capability-version compatibility, single/multiple cardinality enforcement, phase inversion and cycle detection, immutable inspection, multi-provider delivery, and dependency-safe start/rollback/cancel/shutdown with contained native Promises and exactly-once cleanup. Reused the Promise containment implementation from Core through the existing Application module path.

Recomposed the official local profile as six meaningful built-in plugins: resources, kernel, model, persistence, application/workspace, and surface. Host conformance proves all 13 returned capabilities retain the exact runtime-registered object identity. runHost preserves surface authority and lifecycle, then adapts normal/failure outcomes to plugin shutdown and cancellation outcomes to plugin cancellation; the new cleanup boundary exact-validates and contains hostile nested values.

Objective validation: focused Core plugin suite passed 10 tests/39 assertions; focused Host lifecycle suite passed 46 tests/283 assertions; default-host and persisted-operation parity tests passed. Final bun run check passed formatting, strict TypeScript, architecture boundaries, 476 tests/3,153 assertions, native build, binary smoke, and the compiled Iteration 1A workflow. git diff --check and backlog doctor also passed. Core imports no filesystem, configuration, package, process, AbortSignal, surface, dynamic-import, or external technology.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the bounded technology-neutral phased PluginRuntime, exact capability compatibility and cardinality resolution, deterministic diagnostics, multi-provider delivery, and dependency-safe exactly-once lifecycle cleanup. Routed six official local built-in plugins and all 13 capability identities through the same runtime, exposed graph inspection, and adapted Host surface/process lifecycle without adding dynamic loading or technology to Core. Verified with focused lifecycle/conformance suites and the complete 476-test repository gate, build, smoke, compiled Iteration 1A workflow, diff check, Backlog health, and exact 13-file manifest.
<!-- SECTION:FINAL_SUMMARY:END -->
