---
id: GROM-23
title: Publish the plugin SDK and conformance suites
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 05:59'
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
1. Replace manifest own-key enumeration with exactly six bounded expected-field descriptor reads into a fresh safe record, containing all reflection failures and preserving required enumerable data-property validation.
2. Define exactness as the canonical six-field output: ignore unknown source-object properties so they cannot influence or survive; leave exhaustive static source-document shape validation to GROM-24.
3. Update diagnostics and SDK/architecture guidance, convert the surprise-property regression to successful exact canonicalization, add missing-required-field failure, and add a throwing-ownKeys manifest proxy proving bounded behavior and frozen exact output while retaining revoked-proxy containment.
4. Run focused and full gates, re-check AC5 with current-head evidence, re-finalize GROM-23, and commit without pushing or resolving GitHub threads.
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

Reopened for two actionable pre-merge Codex findings: oversized plugin arrays must fail before key enumeration, and deterministic results must include observable provider order rather than graph inspection alone. AC3 and AC5 are pending current-head regressions.

Implemented both final Codex findings. entryPoints now rejects zero or over-64 intrinsic array lengths before Reflect.ownKeys, with a throwing ownKeys proxy proving bounded preflight. Deterministic snapshots now combine inspection with ordered provider plugin IDs for each unique declared capability/version; capability lookup keys are sorted but provider order is preserved. A runtime-backed successful fixture exposes identical inspections and reversed provider order, producing plugin-conformance-nondeterministic while the existing exclusive-resource fixture remains green. Focused strict typecheck plus SDK/Host suites passed 8 tests with 45 assertions.

Final current-head evidence for the last two Codex findings: focused strict TypeScript and SDK/Host conformance suites passed 8 tests with 45 assertions. Full bun run check passed formatting, strict TypeScript, architecture boundaries, 520 tests with 3,401 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed. The existing exclusive-resource regression remains green, proving the richer deterministic snapshot did not reintroduce forward/reverse overlap.

Reopened for the final current-head P2: even a bounded-length proxy can make Reflect.ownKeys unbounded. AC5 is pending a descriptor-only canonicalization regression and current-head verification.

Removed own-key enumeration from entryPoints entirely. After intrinsic array and 1..64 length validation, it now reflects only the bounded expected numeric descriptors, contains descriptor trap failures, and copies validated entries into the fresh frozen canonical array. The allowed-length proxy regression has a throwing ownKeys trap plus an extra enumerable property; compatibility succeeds without invoking the trap and returns only the clean numeric entry. The existing over-64 early-bound trap remains green. Focused strict typecheck plus SDK/Host suites passed 8 tests with 50 assertions.

Final descriptor-only evidence: focused strict TypeScript and SDK/Host suites passed 8 tests with 50 assertions. Full bun run check passed formatting, strict TypeScript, architecture boundaries, 520 tests with 3,406 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed. No path in entryPoints enumerates input keys; reflection is bounded to length plus at most 64 expected numeric descriptors, and only validated strings enter the fresh frozen output.

Reopened for current-head P2: manifest canonicalization still enumerated package-controlled own keys. AC5 is pending bounded six-descriptor canonicalization, explicit exact-output semantics, and current-head verification.

Removed manifest own-key enumeration. canonicalRecord now validates only the six required enumerable data descriptors into a null-prototype intermediate record; reflection faults are contained, unknown properties are ignored, and the final compatibility result remains a fresh frozen six-field object. Updated exactness wording in ARCHITECTURE.md and the SDK guide, assigning exhaustive static source-document shape validation to GROM-24. Tests now prove ordinary extras canonicalize away, missing required fields still fail, revoked proxies remain contained, and a manifest proxy with throwing ownKeys plus a throwing unknown getter succeeds without touching either. Focused strict typecheck plus SDK/Host suites passed 8 tests with 59 assertions.

Final six-descriptor evidence: focused strict TypeScript and SDK/Host suites passed 8 tests with 59 assertions. Full bun run check passed formatting, strict TypeScript, architecture boundaries, 520 tests with 3,415 assertions, native build/smoke, and compiled Iteration 1A verification. git diff --check and backlog doctor passed. Manifest and entry-point canonicalization now use only bounded expected-descriptor reads; neither path enumerates package-controlled keys.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Published and review-hardened the two-subpath plugin SDK. Authoring and static package compatibility live at groma/plugin-sdk; reusable verification lives only at groma/plugin-sdk/conformance. Package self-references obey layer rules, package manifests and entry points canonicalize through bounded expected-descriptor reads without key enumeration, static source-shape validation remains with GROM-24, and deterministic conformance compares inspection plus observable provider order while releasing graphs sequentially. Focused 8-test evidence and the complete 520-test, native-build, and Iteration 1A gates pass.
<!-- SECTION:FINAL_SUMMARY:END -->
