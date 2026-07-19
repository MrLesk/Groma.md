---
id: GROM-40
title: Scan TypeScript and Bun project architecture
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 13:27'
labels: []
milestone: m-3
dependencies:
  - GROM-23
  - GROM-34
  - GROM-39
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
documentation:
  - ARCHITECTURE.md
  - src/host/README.md
modified_files:
  - ARCHITECTURE.md
  - package.json
  - bun.lock
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/index.ts
  - src/host/typescript-bun-scanner.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/host/tests/typescript-bun-scanner.test.ts
  - tests/scanner-runtime-integration.test.ts
priority: high
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide the first deterministic built-in scanner that extracts a detailed, defensible architecture observation set from TypeScript and Bun projects without executing project code or inventing intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The scanner discovers configured TypeScript and Bun workspace, package, and source boundaries and emits stable component candidates with exact provenance
- [x] #2 It reports public exports as action candidates, cross-boundary imports as relationship candidates, Bun HTTP routes where statically defensible, and relevant documentation or comments as raw evidence
- [x] #3 Generated, vendored, dependency, build-output, ignored, and out-of-scope resources are excluded according to explicit deterministic coverage rules
- [x] #4 Observation keys and ordering remain stable across unchanged rescans and normalize supported macOS, Linux, Windows x64, and Windows ARM64 path conventions
- [x] #5 The scanner never executes project code, reads a Groma blueprint, emits canonical IDs or bindings, or converts documentation into invented architectural intent
- [x] #6 Scanner-level output passes the applicable automatic-blueprint benchmark assertions on representative bounded TypeScript and Bun fixtures, including Groma self-scan coverage; full external-project dogfood remains owned by GROM-46 and GROM-47 in Iteration 3
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Apply the seven named corrections only in existing bounded policy, resolver, lexical, workspace, callable, and runtime-import paths. 2. Add one representative focused regression per finding without adjacent syntax matrices. 3. Run the focused scanner suite, runtime/self-scan suite, full bun run check, and git diff --check; perform one complete-batch self-review. 4. Record exact validation and boundary outcome, leaving the work uncommitted and unpushed for fresh review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-module scanner semantics and Host integration. Three independent read-only investigations converged on official.typescript as an embedded zero-requirement Phase 1 provider inside the existing Host boundary, using only request resources, observation sink, cancellation, pure parsing, and hashing. GROM-40 explicitly owns only scanner-level benchmark evidence: no project-specific CLI-help heuristic, canonical reconciliation, groma scan orchestration, renderer, full held-out Backlog/codex-events dogfood, or benchmark runner. The current default handoff consumer remains fail-closed until GROM-41, and GROM-43 retains default first-run scanner enablement.

Implemented the bounded official.typescript scanner slice with deterministic paged discovery, package/workspace/source candidates, public callable exports, aggregate literal imports, static Bun routes, raw documentation, supported ignore/config exclusions, stable semantic keys, exact fingerprints/ranges, partial ambiguity, local budgets, and focused lifecycle tests. Focused suite, typecheck, boundaries, formatting, and diff checks are green; Host integration and self-scan verification are in progress.

Completed final semantic hardening after three independent read-only reviews: unsafe policy scopes suppress claims; configured aliases, package imports, type-only dependencies, public subpaths, star-export ambiguity, route/action proof chains, legacy entry encapsulation, validator-safe derived values, strict external specifiers, linear UTF-8 offset caching, and extraction-time work/record/character ceilings are all covered by adversarial fixtures. Validation passed: 19 focused scanner tests (192 assertions), 3 runtime/self-scan tests (1,214 assertions), 1,046 repository tests (8,952 assertions), typecheck, architecture boundaries, formatting, diff checks, Iteration 1B verification, and Darwin ARM64/Linux x64/Windows x64/Windows ARM64 standalone targets. The Groma self-scan is byte-stable across repeated scans and proves the exact seven source boundaries, 13 internal edges, both public SDK subpaths, bounded output, exclusions, and every provenance fingerprint/range.

Post-review hardening addressed every independently verified PR finding: imported-binding barrel/default proof, exact tsconfig files/include/exclude semantics, complete declaration suffix handling, nested scanner blindness, literal alias captures, and fail-closed CommonJS classification with bounded lexical scope analysis. Final validation passed: 31 scanner/runtime tests (1,565 assertions), exact Groma self-scan (1,206 assertions), 1,058 repository tests (9,156 assertions), typecheck, architecture boundaries, formatting, diff checks, Iteration 1B verification, and Darwin ARM64/Linux x64/Windows x64/Windows ARM64 standalone targets. A final independent read-only audit found no actionable issues.

Final review follow-up made Babel parsing explicitly Bun-compatible by source extension, restoring valid angle-bracket TypeScript assertions without accepting TypeScript or JSX in loaders that do not support them. After two CI-only expirations at the default 5-second test ceiling with every other assertion passing, the unchanged full Groma self-scan integration test alone now has a 15-second timeout; production bounds and assertions are unchanged. Final validation passed: 1,059 repository tests (9,204 assertions), focused parser/declaration/CommonJS regressions, exact self-scan, typecheck, boundaries, formatting, diff checks, build, Iteration 1B verification, and all four executable targets; independent replay found no actionable issue.

The final exact-head Codex review produced five additional scanner findings; all were independently reproduced and closed. Supported tsconfig-relative values now normalize a safe leading ./, exact inventoried resources outrank fallbacks, Bun.serve calls use bounded per-call lexical shadow analysis, every workspace import validates its exported public subpath, and public callable traversal shares the supported relative/package-import/tsconfig-alias resolver without traversing arbitrary external or workspace reexports. Final validation passed: 1,063 repository tests (9,270 assertions), focused five-finding and adjacent fail-closed matrices, exact self-scan, typecheck, boundaries, formatting, diff checks, build, Iteration 1B verification, and all four executable targets; final independent replay found no actionable issue.

Final exact-head hardening closed every independently verified review concern: conditional package targets now coalesce only when equivalent; public actions aggregate deterministically across legacy entry declarations; configured source-only scopes emit in-scope boundaries without inventing parent package ownership; Node and Bun runtime identities use a frozen deterministic policy; unsupported, cyclic, malformed, and overlong re-export paths preserve only independently defensible callables; Bun route extraction separates safe siblings from route-overriding ambiguity; and unowned scopes fail closed on unresolved bare imports. Public export traversal now tracks declaration-binding identity separately from unknown names, coalesces duplicate and diamond paths, retains a shortest bounded proof beside equivalent overlong star or explicit paths, preserves explicit precedence, and still suppresses unknown or different-binding collisions. Final objective evidence: 50 focused scanner tests (693 assertions), 3 durable runtime/self-scan tests (1,214 assertions), 1,077 repository tests across 48 files (9,453 assertions), formatting, TypeScript typecheck, architecture boundaries, build/smoke, Iteration 1A crash recovery, complete Iteration 1B verification, stable self-blueprint (43 components, 9 roots, 398 embedded items, 87 declarations, 104 edges), and Darwin ARM64/Linux x64/Windows x64/Windows ARM64 standalone targets all passed. Independent semantic and code-quality re-reviews reported no actionable findings.

Subtraction-first reset after repeated review. Supported semantic boundary: the Phase 1 scanner recognizes bounded exact project manifests and scopes; direct literal relative, workspace, runtime, and external imports; direct public callable declarations and bounded exact re-exports; and direct unshadowed Bun.serve calls with literal route objects. Divergent or duplicate manifest policy, unsupported declaration/barrel syntax, ambiguous resolution, dynamic syntax, and direct lexical mutation make the affected evidence partial or absent rather than guessed. Whole-program alias, mutation, callback, setter, helper, and capability-flow proof is explicitly outside GROM-40 unless Alex makes a new product decision. The final correction batch must prefer partial/no claim and deletion of experimental machinery over expanding inference.

Subtraction-first final correction batch now enforces the recorded supported boundary: duplicate or conditionally divergent package policy, invalid root policy text, direct unshadowed Bun.serve replacement, mutable/declaration-typed/overloaded callable bindings, imported-then-exported bindings, and extensionless declaration-only resolution all fail closed as partial/no claim. Exact runtime and declaration resources, direct exact re-exports, workspace-root imports, static routes, and independent safe callables remain observable. Validation passed: 51 focused scanner tests (684 assertions), 24 runtime/self-scan tests (1,301 assertions), 1,078 repository tests across 48 files (9,444 assertions), formatting, TypeScript typecheck, architecture boundaries, and diff checks. Standalone targets were not rerun because target packaging and cross-platform build inputs are unchanged; the protected capability-flow stash remains untouched.

Complete final Codex batch closed seven bounded scanner findings without expanding inference: duplicate root tsconfig keys fail the affected scope partial; extensionless file.mjs and index.mjs targets resolve; unshadowed require member surfaces are partial; unnamed root manifests still contribute exact workspace patterns; indirectly initialized function-typed public consts are partial/no-action; bare Node builtins resolve as runtime imports in source-only scopes; and safe leading ./ workspace patterns normalize. One complete-batch self-review removed an adjacent cjs resolver change and retained partial/no claim for unsupported forms. Validation passed: 58 focused scanner tests (707 assertions), 24 runtime/self-scan tests (1,301 assertions), 1,085 repository tests across 48 files (9,467 assertions), full bun run check including format, typecheck, architecture boundaries, build/smoke, Iteration 1A recovery, Iteration 1B foundation, and stable self-blueprint (43 components, 9 roots, 398 embedded items, 87 declarations, 104 edges), plus git diff --check. The capability-flow stash remains untouched; this batch is intentionally uncommitted and unpushed for fresh review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added and registered the bounded official.typescript Phase 1 scanner and completed the final fail-closed review batches. Exact manifests/scopes, literal imports, public callable declarations/re-exports, and Bun routes are observed; duplicate policy, unsupported CommonJS/callable surfaces, ambiguous resolution, and indirect inference remain partial/no claim. Final seven-finding correction is verified by 1,085 repository tests (9,467 assertions), focused scanner and runtime/self-scan suites, full bun run check, stable self-blueprint, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
