---
id: GROM-40
title: Scan TypeScript and Bun project architecture
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 01:18'
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
1. Add a requirement-free Phase 1 official.typescript scanner inside the existing Host boundary, authored against only the public scanner SDK and pure parser/hash dependencies; keep the default project scanner list unchanged for GROM-43.\n2. Canonicalize a small include/exclude configuration, then inventory every declared scope with bounded maxDepth-0 paged directory walks, fixed ordering and count-based heartbeats; skip links plus deterministic dependency, vendor, build, generated, test, configured, supported gitignore and static TypeScript exclusions before descent.\n3. Discover package/workspace and populated source-boundary candidates from exact metadata and source resources without asserting conceptual containment; hash exact bytes for provenance and detect case/NFC aliases or ambiguous resource state fail-closed.\n4. Parse eligible TypeScript/JavaScript inertly with Babel and emit only defensible aggregates: explicit package/public callable exports as actions, uniquely resolved literal cross-boundary imports, statically literal Bun routes, and raw README/package/JSDoc documentation. Dynamic, shadowed, computed, spread, unresolved or malformed constructs emit no guessed claim and make coverage partial.\n5. Derive stable source-local keys from bounded logical tuples rather than content, epoch, offsets or host paths; convert Babel offsets to exact UTF-8 ranges, cap per-kind records/provenance/documentation and canonical characters below journal ceilings, sort records deterministically, and publish fixed batches plus exact per-scope coverage.\n6. Register the official scanner in the default plugin graph, update the reserved local-plugin capacity and provider inventories, preserve the unavailable reconciliation consumer, and expose the scanner identity through existing Host exports without a second execution path.\n7. Add bounded synthetic package/workspace/ambiguity/no-intent fixtures, public conformance and GROM-39 runtime integration, unchanged-rescan and portability proofs, adversarial budget/cancellation/sink tests, and a Groma self-scan covering only the applicable scanner-level benchmark facts. Update Host/architecture guidance, then run focused, full and four-target gates plus independent reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-module scanner semantics and Host integration. Three independent read-only investigations converged on official.typescript as an embedded zero-requirement Phase 1 provider inside the existing Host boundary, using only request resources, observation sink, cancellation, pure parsing, and hashing. GROM-40 explicitly owns only scanner-level benchmark evidence: no project-specific CLI-help heuristic, canonical reconciliation, groma scan orchestration, renderer, full held-out Backlog/codex-events dogfood, or benchmark runner. The current default handoff consumer remains fail-closed until GROM-41, and GROM-43 retains default first-run scanner enablement.

Implemented the bounded official.typescript scanner slice with deterministic paged discovery, package/workspace/source candidates, public callable exports, aggregate literal imports, static Bun routes, raw documentation, supported ignore/config exclusions, stable semantic keys, exact fingerprints/ranges, partial ambiguity, local budgets, and focused lifecycle tests. Focused suite, typecheck, boundaries, formatting, and diff checks are green; Host integration and self-scan verification are in progress.

Completed final semantic hardening after three independent read-only reviews: unsafe policy scopes suppress claims; configured aliases, package imports, type-only dependencies, public subpaths, star-export ambiguity, route/action proof chains, legacy entry encapsulation, validator-safe derived values, strict external specifiers, linear UTF-8 offset caching, and extraction-time work/record/character ceilings are all covered by adversarial fixtures. Validation passed: 19 focused scanner tests (192 assertions), 3 runtime/self-scan tests (1,214 assertions), 1,046 repository tests (8,952 assertions), typecheck, architecture boundaries, formatting, diff checks, Iteration 1B verification, and Darwin ARM64/Linux x64/Windows x64/Windows ARM64 standalone targets. The Groma self-scan is byte-stable across repeated scans and proves the exact seven source boundaries, 13 internal edges, both public SDK subpaths, bounded output, exclusions, and every provenance fingerprint/range.

Post-review hardening addressed every independently verified PR finding: imported-binding barrel/default proof, exact tsconfig files/include/exclude semantics, complete declaration suffix handling, nested scanner blindness, literal alias captures, and fail-closed CommonJS classification with bounded lexical scope analysis. Final validation passed: 31 scanner/runtime tests (1,565 assertions), exact Groma self-scan (1,206 assertions), 1,058 repository tests (9,156 assertions), typecheck, architecture boundaries, formatting, diff checks, Iteration 1B verification, and Darwin ARM64/Linux x64/Windows x64/Windows ARM64 standalone targets. A final independent read-only audit found no actionable issues.

Final review follow-up made Babel parsing explicitly Bun-compatible by source extension, restoring valid angle-bracket TypeScript assertions without accepting TypeScript or JSX in loaders that do not support them. After two CI-only expirations at the default 5-second test ceiling with every other assertion passing, the unchanged full Groma self-scan integration test alone now has a 15-second timeout; production bounds and assertions are unchanged. Final validation passed: 1,059 repository tests (9,204 assertions), focused parser/declaration/CommonJS regressions, exact self-scan, typecheck, boundaries, formatting, diff checks, build, Iteration 1B verification, and all four executable targets; independent replay found no actionable issue.

The final exact-head Codex review produced five additional scanner findings; all were independently reproduced and closed. Supported tsconfig-relative values now normalize a safe leading ./, exact inventoried resources outrank fallbacks, Bun.serve calls use bounded per-call lexical shadow analysis, every workspace import validates its exported public subpath, and public callable traversal shares the supported relative/package-import/tsconfig-alias resolver without traversing arbitrary external or workspace reexports. Final validation passed: 1,063 repository tests (9,270 assertions), focused five-finding and adjacent fail-closed matrices, exact self-scan, typecheck, boundaries, formatting, diff checks, build, Iteration 1B verification, and all four executable targets; final independent replay found no actionable issue.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added and registered the requirement-free official.typescript Phase 1 scanner. It inertly derives bounded package/source candidates, explicit public callable actions, static Bun route actions, uniquely resolved value/type relationships, and raw documentation; unsupported or ambiguous evidence fails closed as partial without reading project code or canonical intent. Verified with adversarial scanner, lexical-scope, resolver, workspace, and Bun-extension fixtures, durable Host integration, repeated exact Groma self-scan, 1,063 repository tests (9,270 assertions), Iteration 1B binaries, four standalone target builds, and clean independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
