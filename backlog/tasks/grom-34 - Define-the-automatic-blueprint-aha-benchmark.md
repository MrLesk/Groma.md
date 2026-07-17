---
id: GROM-34
title: Define the automatic-blueprint aha benchmark
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-17 23:49'
labels: []
milestone: m-3
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - docs/automatic-blueprint-benchmark.md
  - tests/iteration-2/automatic-blueprint/contract.ts
  - tests/iteration-2/automatic-blueprint/scorer.ts
  - tests/iteration-2/automatic-blueprint/automatic-blueprint.test.ts
  - tests/iteration-2/automatic-blueprint/audits/groma.json
  - tests/iteration-2/automatic-blueprint/audits/backlog-md-v1.48.0.json
priority: high
type: task
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the desired first-run experience into an evidence-based quality gate using Groma and a held-out TypeScript or Bun project, without requiring automatic output to reproduce curated domain names or prose. A manual real-project baseline contained 43 curated components, 83 relationships, and five roots; those metrics provide comparison context, while benchmark scoring remains limited to defensible observable facts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The benchmark separates defensible observable architecture from curated intent and never scores a scanner on invented business prose
- [x] #2 Reference audits identify major observable project boundaries, public actions, cross-boundary dependencies, Bun routes where present, documentation evidence, and facts that must not be claimed for Groma and the held-out project
- [x] #3 The scorecard measures false architectural claims, coverage of major observable facts, deterministic ordering, stable identity across rescans, provenance quality, time to first understandable visual, and unaided human comprehension of the main layer
- [x] #4 Passing requires zero critical false architectural claims, complete coverage of the audited major workspace or package boundaries and their cross-boundary dependencies, and a bounded visual that exposes uncertainty rather than hiding it
- [x] #5 Benchmark execution performs no AI calls, network inference, or human correction between scan start and scored output
- [x] #6 At least one held-out TypeScript or Bun fixture is reserved from scanner-specific tuning and the documented groma init -> groma scan -> groma first-minute workflow is included in the evaluation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a versioned, format-neutral automatic-blueprint benchmark protocol for observable facts, conjunctive pass gates, offline first-minute execution, unaided main-layer comprehension, and deliberate audit refresh.
2. Commit fresh immutable reference audits for Groma and Backlog.md at exact Git commit/tree snapshots, covering major boundaries, public actions, cross-boundary dependencies, Bun routes, documentation evidence, exclusions, and forbidden claims without importing curated intent.
3. Add a verification-only parser and scorer with stable failure codes, preserving raw evidence for false claims, coverage, deterministic ordering, identity, provenance, time, presentation bounds, uncertainty visibility, and comprehension.
4. Prove every gate independently with synthetic tests, validate both audits, and document the Backlog.md reservation policy so scanner-specific exceptions and tuning from scored results are prohibited.
5. Run targeted tests, formatting, diff hygiene, Backlog integrity, and the full repository check; then complete independent spec and quality review before opening the one ready pull request.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context decision: GROM-34 defines benchmark evidence and verification only; it does not implement the scanner, reconciliation, CLI workflow, renderer, or release harness. Backlog.md is the durable external reference required later by GROM-46, pinned to v1.48.0^{} commit da0784d41ad3807fdc34e5501afe3fa950deff94 and tree 7ad9138045134a21426f72d26fa828b496e6443c (whose package metadata remains 1.47.1). Groma is pinned to commit 66fe7c616ccb06f8dbd52cafef006cc77f864217 and tree 71323cd120c867b5c8ac9fffcc07cb9baf6079d4. The public Backlog.md audit is a reproducible reference whose source and scored results must never be scanner input: freeze scanner code and generic rules before scoring, prohibit project/path/name exceptions, and justify improvements generically on non-held-out fixtures first. Curated counts and prose remain comparison context only. Numeric renderer density/focus budgets stay owned by the Iteration 2 renderer tasks; this benchmark requires a declared presentation budget and compliance with it without choosing the values. Organization-scale evidence remains GROM-53 scope.

Implemented the benchmark-definition slice without production imports: a normative protocol document; immutable Groma and held-out Backlog.md audits with full Git pins, bounded line anchors, Git blob IDs, SHA-256 content digests, exclusions, forbidden claims, and comprehension questions; and a verification-only parser/scorer with preserved raw claim evidence, fixed-order conjunctive failure codes, renderer-declared budget checks, hermetic first-minute execution controls, repeatability/identity/canonical-byte gates, provenance, and unaided comprehension. The Backlog.md audit remains a public reproducible holdout rather than a secret fixture. Independently verified all 53 audit witness records against the pinned Git objects and line bounds. Validation passed: bun test tests/iteration-2/automatic-blueprint (8 tests, 106 assertions); bun run typecheck; bun run format:check; git diff --check; backlog doctor; and full bun run check, including 1A/1B binary and self-blueprint verification.

Independent quality remediation closed every reproduced fail-open case: false claims now resolve audit forbidden IDs, inherit exact predeclared severity, use globally unique/disjoint claim inventories, and include false claims in provenance; output/exclusion inventories are strict portable descendants, exactly match source-hash exclusions, are committed with the renderer budget before spawn, and cannot overlap immutable protected source roots under POSIX or Win32 comparison; temporary roots are convention-aware; freeze signals are structured; and held-out language now freezes before the held-out run/scored results. Exact-set and absence facts now carry reproducible source-scope and derivation metadata. Strengthened Backlog route, dependency, CLI-action, and source-area witnesses; independently reverified 85 immutable witness OIDs, SHA-256 digests, and line bounds. Final validation: targeted benchmark suite 16 tests / 156 assertions; typecheck; format:check; git diff --check; backlog doctor; full bun run check with 817 tests / 5,860 assertions plus build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint verification. Independent spec re-review passed and final quality re-review approved with no actionable findings.

Accepted and applied three actionable Claude review cleanups without changing benchmark scope: same-set comparison now sorts each unique operand once while preserving default code-unit ordering; an empty command record now scores exactly WORKFLOW_MISMATCH with fail-closed evidence `no commands recorded`; and temporary HOME/config roots must be disjoint rather than merely unequal, including segment-safe ancestor/nesting detection, trailing-separator aliases, and Win32 case-insensitive aliases. Added direct empty-workflow, POSIX nested-root, and Win32 nested-root regressions and clarified the hermetic-execution protocol. Final validation after these changes: targeted benchmark suite 18 tests / 159 assertions; typecheck; format:check; git diff --check; backlog doctor; and full bun run check with 819 tests / 5,863 assertions plus build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint verification.
<!-- SECTION:NOTES:END -->
