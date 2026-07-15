---
id: GROM-23
title: Publish the plugin SDK and conformance suites
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 04:58'
labels: []
milestone: m-2
dependencies:
  - GROM-21
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
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
1. Preserve the public groma/plugin-sdk façade while hardening its canonical package-manifest grammar: conservative relative subpaths, bounded exact package versions, and stable fail-closed compatibility diagnostics.
2. Strengthen the runner-agnostic suite so successful custom fixtures cannot hide provider-cardinality disagreement and cancellation passes only for the exact expected diagnostic evidence.
3. Add focused successful-fixture regressions for encoded traversal, path metacharacters and controls, semver bounds, mixed cardinality, and cancellation plus cleanup failure.
4. Reconcile ARCHITECTURE.md and SDK documentation by separating npm package.json discovery metadata from Groma's exact canonical compatibility envelope without implementing acquisition or locking.
5. Run focused and complete gates, record objective evidence, re-finalize every acceptance criterion, and commit a GROM-23 quality follow-up without pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the public groma/plugin-sdk and groma/plugin-sdk/conformance subpaths as a one-way façade over Core. The façade intentionally excludes PluginRuntime itself so Host-only staged Phase 0 continuation cannot leak through the authoring API. Added exact groma.sdk/v1, groma.package/v1, and groma.plugin/v1 compatibility contracts; bounded fail-closed package-manifest canonicalization; compile-time define helpers; and stable package, SDK, and runtime incompatibility diagnostics.

Added runner-agnostic deterministic-results, lifecycle, cancellation, declared-cardinality, and provider-behavior cases plus a fresh-runtime fixture adapter. A self-reference-only external package fixture compiles without implementation imports. The complete default Host graph runs the same public suite with one behavior check for all 15 declared built-in capabilities. Negative tests prove each suite category detects its corresponding defect. Focused evidence: 14 tests and 32 assertions pass with strict TypeScript and architecture boundaries.

Final objective verification: focused public SDK, default Host conformance, and boundary suites passed 14 tests with 32 assertions. The complete bun run check passed Prettier, strict TypeScript, architecture boundaries, 517 tests with 3,375 assertions, native standalone build and smoke, and the compiled Iteration 1A recovery workflow. git diff --check and backlog doctor passed.

Reopened after independent quality review identified encoded package-subpath escape, unbounded package versions, mixed-cardinality false acceptance, cancellation diagnostic masking, and an architecture/SDK manifest-shape ambiguity. All acceptance criteria are pending current-head regression evidence.

Quality remediation completed. Canonical entry points now use a conservative ASCII package-subpath grammar that rejects URL encodings, queries, fragments, controls, traversal, separators, and trailing dots without normalization; exact package versions are bounded to 128 characters. Cardinality conformance directly rejects declaration disagreement, duplicate provider declarations, and version-blind single-provider conflicts even when a custom fixture reports successful startup. Cancellation accepts exactly one expected diagnostic and retains unexpected cleanup evidence. ARCHITECTURE.md and the SDK guide now distinguish package.json discovery hints from the exact checked compatibility envelope while leaving acquisition, materialization, and locks to GROM-24.

Current-head evidence: focused SDK and default Host suites passed 6 tests with 33 assertions. Full bun run check passed formatting, strict TypeScript, boundaries, 517 tests with 3,388 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published and quality-hardened the supported groma/plugin-sdk authoring façade, exact bounded package compatibility envelope, and runner-agnostic conformance suite. Plugin entry points fail closed under encoded or ambiguous paths; lifecycle evidence cannot mask cancellation or cardinality defects; package discovery metadata and exact compatibility are documented as separate concerns. A public-only external fixture and all 15 default Host capabilities pass the shared suite. The current complete 517-test gate, native build/smoke, and Iteration 1A workflow pass.
<!-- SECTION:FINAL_SUMMARY:END -->
