---
id: GROM-23
title: Publish the plugin SDK and conformance suites
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 04:46'
labels: []
milestone: m-2
dependencies:
  - GROM-21
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - DEVELOPMENT.md
  - backlog/tasks/grom-23 - Publish-the-plugin-SDK-and-conformance-suites.md
  - package.json
  - scripts/architecture-boundaries.ts
  - scripts/tests/architecture-boundaries.test.ts
  - src/README.md
  - src/core/README.md
  - src/host/README.md
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/plugin-sdk/README.md
  - src/plugin-sdk/conformance.ts
  - src/plugin-sdk/index.ts
  - src/plugin-sdk/manifest.ts
  - tests/fixtures/conforming-plugin-package.ts
  - tests/plugin-sdk.test.ts
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give built-in and third-party plugin authors one supported public contract for manifests, capability entry points, lifecycle, and provider behavior without depending on repository internals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The public SDK exports versioned plugin and package manifest contracts plus the capability types required to implement a plugin
- [x] #2 Plugin packages can implement supported capabilities without importing private source modules
- [x] #3 Reusable conformance suites validate lifecycle, cancellation, declared cardinality, deterministic results, and provider-specific behavior
- [x] #4 Every applicable built-in provider passes the same conformance suite exposed to third parties
- [x] #5 Unsupported or incompatible SDK and runtime versions fail with stable compatibility diagnostics
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a declared public plugin-sdk architectural boundary and root package subpath exports so plugin authors import only groma/plugin-sdk or its conformance subpath, while the façade reuses the existing Core runtime contract rather than duplicating runtime semantics.
2. Publish current SDK, package, and runtime version tokens, typed plugin helpers, a bounded versioned package-manifest contract, and stable exact compatibility diagnostics for malformed, unsupported, or incompatible manifests.
3. Implement a runner-agnostic reusable conformance runner plus an official-runtime fixture adapter covering deterministic order, lifecycle and idempotent cleanup, pre-start cancellation, declared provider cardinality, and caller-supplied provider behavior checks.
4. Prove a private-import-free external package fixture and run the shared suite over both a third-party-shaped plugin set and the complete applicable default built-in graph and capabilities.
5. Document the supported boundary and deferred package acquisition scope, then run focused and full repository gates, finalize Backlog evidence, and commit only GROM-23 changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the public groma/plugin-sdk and groma/plugin-sdk/conformance subpaths as a one-way façade over Core. The façade intentionally excludes PluginRuntime itself so Host-only staged Phase 0 continuation cannot leak through the authoring API. Added exact groma.sdk/v1, groma.package/v1, and groma.plugin/v1 compatibility contracts; bounded fail-closed package-manifest canonicalization; compile-time define helpers; and stable package, SDK, and runtime incompatibility diagnostics.

Added runner-agnostic deterministic-results, lifecycle, cancellation, declared-cardinality, and provider-behavior cases plus a fresh-runtime fixture adapter. A self-reference-only external package fixture compiles without implementation imports. The complete default Host graph runs the same public suite with one behavior check for all 15 declared built-in capabilities. Negative tests prove each suite category detects its corresponding defect. Focused evidence: 14 tests and 32 assertions pass with strict TypeScript and architecture boundaries.

Final objective verification: focused public SDK, default Host conformance, and boundary suites passed 14 tests with 32 assertions. The complete bun run check passed Prettier, strict TypeScript, architecture boundaries, 517 tests with 3,375 assertions, native standalone build and smoke, and the compiled Iteration 1A recovery workflow. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published the supported groma/plugin-sdk authoring façade with exact versioned package and runtime contracts, stable compatibility diagnostics, and a runner-agnostic conformance suite. External-package self-reference proof uses no private implementation imports, and all 15 applicable default Host capabilities pass the same lifecycle, cancellation, cardinality, determinism, and provider-behavior contract. The complete 517-test repository gate, native build/smoke, and Iteration 1A workflow pass.
<!-- SECTION:FINAL_SUMMARY:END -->
