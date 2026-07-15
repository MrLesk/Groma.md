---
id: GROM-23
title: Publish the plugin SDK and conformance suites
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 05:21'
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
1. Resolve the exact groma/plugin-sdk and groma/plugin-sdk/conformance self-references through the plugin-sdk layer in the boundary checker, with allowed Host and forbidden relative/bare dependency regressions.
2. Keep authoring and manifest contracts on groma/plugin-sdk, expose conformance only through groma/plugin-sdk/conformance, and update repository imports and guidance.
3. Document the checked six-field envelope as inert static JSON/data obtained before arbitrary package code executes; describe definePluginPackage as a build-time authoring aid and correct the bounded subpath grammar wording without implementing GROM-24.
4. Run deterministic conformance graphs sequentially, capture inspection before cleanup, retain cleanup diagnostics, and add an exclusive-resource fixture proving no overlap.
5. Normalize the Host conformance adapter to a cancellation-specific diagnostic only when the already-aborted request returns the exact known Phase-0 startup wrapper; verify the aggregate suite and document the safety rationale.
6. Run focused and full gates, inspect the cumulative diff, update the modified-file manifest and evidence, then re-finalize and commit without pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the public groma/plugin-sdk and groma/plugin-sdk/conformance subpaths as a one-way façade over Core. The façade intentionally excludes PluginRuntime itself so Host-only staged Phase 0 continuation cannot leak through the authoring API. Added exact groma.sdk/v1, groma.package/v1, and groma.plugin/v1 compatibility contracts; bounded fail-closed package-manifest canonicalization; compile-time define helpers; and stable package, SDK, and runtime incompatibility diagnostics.

Added runner-agnostic deterministic-results, lifecycle, cancellation, declared-cardinality, and provider-behavior cases plus a fresh-runtime fixture adapter. A self-reference-only external package fixture compiles without implementation imports. The complete default Host graph runs the same public suite with one behavior check for all 15 declared built-in capabilities. Negative tests prove each suite category detects its corresponding defect. Focused evidence: 14 tests and 32 assertions pass with strict TypeScript and architecture boundaries.

Final objective verification: focused public SDK, default Host conformance, and boundary suites passed 14 tests with 32 assertions. The complete bun run check passed Prettier, strict TypeScript, architecture boundaries, 517 tests with 3,375 assertions, native standalone build and smoke, and the compiled Iteration 1A recovery workflow. git diff --check and backlog doctor passed.

Reopened after independent quality review identified encoded package-subpath escape, unbounded package versions, mixed-cardinality false acceptance, cancellation diagnostic masking, and an architecture/SDK manifest-shape ambiguity. All acceptance criteria are pending current-head regression evidence.

Quality remediation completed. Canonical entry points now use a conservative ASCII package-subpath grammar that rejects URL encodings, queries, fragments, controls, traversal, separators, and trailing dots without normalization; exact package versions are bounded to 128 characters. Cardinality conformance directly rejects declaration disagreement, duplicate provider declarations, and version-blind single-provider conflicts even when a custom fixture reports successful startup. Cancellation accepts exactly one expected diagnostic and retains unexpected cleanup evidence. ARCHITECTURE.md and the SDK guide now distinguish package.json discovery hints from the exact checked compatibility envelope while leaving acquisition, materialization, and locks to GROM-24.

Current-head evidence: focused SDK and default Host suites passed 6 tests with 33 assertions. Full bun run check passed formatting, strict TypeScript, boundaries, 517 tests with 3,388 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed.

Reopened for one final quality-coverage gap: the duplicate-declaration predicate is implemented but lacked a successful-start fake-graph regression independent of Core runtime rejection. AC3 is pending that focused proof.

Final duplicate-declaration coverage completed. A successful-start custom graph now reports two identical multiple-provider declarations and two matching provider entries for the same plugin, so provider-count comparison alone would pass; the suite still returns plugin-conformance-cardinality-failed through its direct duplicate-declaration predicate. Focused SDK/Host evidence passed 6 tests with 34 assertions. Full bun run check passed formatting, strict TypeScript, boundaries, 517 tests with 3,389 assertions, native build/smoke, and compiled Iteration 1A verification; git diff --check and backlog doctor passed.

Reopened after Claude review found pre-publication boundary, API-surface, static-envelope documentation, sequential lifecycle, and Host cancellation-evidence gaps. All acceptance criteria are pending current-head evidence.

Claude-review remediation implemented. Exact groma/plugin-sdk self-references now participate in the layer matrix; main and conformance exports are distinct; the checked envelope is documented as inert pre-execution data; deterministic graphs release forward resources before reverse startup; and the Host test adapter emits a narrow cancellation code only for the exact pre-aborted Phase-0 wrapper. Focused typecheck, actual boundary scan, and SDK/Host/boundary suites pass 17 tests with 54 assertions.

Final current-head verification: focused SDK, Host, and boundary suites passed 17 tests with 54 assertions; strict TypeScript and the actual architecture boundary scan passed. Full bun run check passed formatting, strict TypeScript, boundaries, 520 tests with 3,397 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed. Host cancellation assessment: adapter normalization is sufficiently narrow because it requires an already-cancelled request plus the exact single Phase-0 wrapper code, message, and absent details; unmatched failures remain visible, while every uncancelled case must successfully start the same Host fixture. Production Host behavior remains unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published a coherent two-subpath plugin SDK: authoring and static package compatibility at groma/plugin-sdk, reusable verification only at groma/plugin-sdk/conformance. Package self-references now obey repository layer rules; inert manifest guidance preserves the pre-execution trust boundary; deterministic conformance releases each graph before the next starts; and Host cancellation evidence is narrowly normalized without changing product diagnostics. Focused 17-test evidence and the complete 520-test, native-build, and Iteration 1A gates pass.
<!-- SECTION:FINAL_SUMMARY:END -->
