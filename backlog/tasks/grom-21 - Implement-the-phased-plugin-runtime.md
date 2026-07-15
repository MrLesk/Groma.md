---
id: GROM-21
title: Implement the phased plugin runtime
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 02:32'
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
1. Make resolver ambiguity and all ordering independent of registration order and locale by excluding every duplicate-ID registration and using one code-unit comparator throughout diagnostics, manifests, versions, providers, dependencies, and lifecycle views.
2. Reserve the running graph cleanup Promise before invoking any stop callback so reentrant cancel/shutdown shares the first causal reason and one reverse dependency traversal.
3. Refactor Host cancellation ownership into an exactly-once graph cleanup coordinator that preserves causal cancel versus shutdown separately from public outcome precedence.
4. Fence late composition, recovery, and surface-start work: return promptly on cancellation, then contain settlement and cancel only after dependent work ends, stopping a late session before provider cancellation.
5. Add focused reversal, comparator, reentrancy, late-work, ordering, exact-count, and stop-failure regressions; update docs and Backlog evidence; rerun focused/full gates and commit without pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L3 public Core/Host contract change. The existing 1A HostBootstrapRegistry privately wires local resources, model, persistence, transaction/query/application/workspace, and surface capabilities; runHost separately owns process AbortSignal and surface cleanup. The implementation will keep Core free of filesystem, AbortSignal, configuration, dynamic loading, and package acquisition, use exact current version compatibility rather than a semver solver, and preserve the hostile Host boundary and current surface lifecycle.

Implemented Core PluginRuntime with bounded exact manifest/registration validation, one deterministic Phase 0/Phase 1 graph, exact groma.plugin/v1 and capability-version compatibility, single/multiple cardinality enforcement, phase inversion and cycle detection, immutable inspection, multi-provider delivery, and dependency-safe start/rollback/cancel/shutdown with contained native Promises and exactly-once cleanup. Reused the Promise containment implementation from Core through the existing Application module path.

Recomposed the official local profile as six meaningful built-in plugins: resources, kernel, model, persistence, application/workspace, and surface. Host conformance proves all 13 returned capabilities retain the exact runtime-registered object identity. runHost preserves surface authority and lifecycle, then adapts normal/failure outcomes to plugin shutdown and cancellation outcomes to plugin cancellation; the new cleanup boundary exact-validates and contains hostile nested values.

Objective validation: focused Core plugin suite passed 10 tests/39 assertions; focused Host lifecycle suite passed 46 tests/283 assertions; default-host and persisted-operation parity tests passed. Final bun run check passed formatting, strict TypeScript, architecture boundaries, 476 tests/3,153 assertions, native build, binary smoke, and the compiled Iteration 1A workflow. git diff --check and backlog doctor also passed. Core imports no filesystem, configuration, package, process, AbortSignal, surface, dynamic-import, or external technology.

Reopened after independent quality review found six lifecycle/determinism defects at commit 1f4cff2: duplicate-ID first-wins semantics, locale-sensitive ordering, reentrant cleanup before Promise reservation, late valid composition leakage, provider cleanup racing pending recovery/surface start, and cleanup-mode selection from a mutable public outcome. AC1, AC2, AC3, and AC5 are unchecked pending objective regression evidence.

Quality-review remediation completed. Duplicate IDs are now treated as one ambiguous group and every duplicate registration is excluded before provider/dependency analysis; every PluginRuntime order uses a shared Unicode code-unit comparator. Running-graph and Host plugin cleanup reserve one Promise before callbacks, preserving the first causal mode through reentrancy. Host cancellation now canonicalizes and cancels late valid compositions, fences provider cancellation behind pending recovery and late surface start/stop settlement, contains late malformed/rejected values and stop failures, and retains cancellation as the provider cleanup cause even when surface cleanup changes the public outcome. Default bootstrap rechecks cancellation after the full built-in graph starts and cancels rather than publishing that graph. Regression evidence: focused Core/Host/default-bootstrap suites passed 70 tests and 428 assertions; full bun run check passed formatting, strict TypeScript, architecture boundaries, 484 tests and 3,202 assertions, native build, binary smoke, and compiled Iteration 1A crash recovery. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the bounded phased plugin runtime and moved the six official built-in capability groups onto that same Core registration path. Resolution is exact, deterministic, locale-independent, ambiguity-safe, and fail-closed before startup; lifecycle startup, rollback, cancellation, shutdown, and reentrant cleanup are dependency-safe and exactly once. Host integration preserves surface authority while safely coordinating cancellation across late composition, recovery, surface start/stop, and provider cleanup. Public contracts and architecture guidance are documented, hostile-boundary regressions are covered, and the complete repository verification gate passes.
<!-- SECTION:FINAL_SUMMARY:END -->
