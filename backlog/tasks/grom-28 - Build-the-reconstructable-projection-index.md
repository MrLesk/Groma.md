---
id: GROM-28
title: Build the reconstructable projection index
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-15 22:07'
labels: []
milestone: m-2
dependencies:
  - GROM-26
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - backlog/tasks/grom-28 - Build-the-reconstructable-projection-index.md
  - src/core/README.md
  - src/core/events.ts
  - src/core/index.ts
  - src/core/projection.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/lifecycle.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/plugin-sdk-conformance.test.ts
  - src/persistence/README.md
  - src/persistence/index.ts
  - src/persistence/projection-index.ts
  - src/persistence/tests/projection-index.test.ts
priority: high
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Materialize canonical blueprint state into a disposable local index that can support fast search, joins, and graph traversal without becoming a second source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The index rebuilds deterministically from canonical intent and alias records and records the exact canonical generation it represents
- [x] #2 Committed transaction events update indexed entities, adjacency, searchable text, and aliases without requiring a full rebuild
- [x] #3 A missing event generation, stale generation, corrupt index, or absent index triggers a safe rebuild or an actionable unavailable diagnostic
- [x] #4 Deleting or corrupting the projection cannot change canonical blueprint state
- [x] #5 Index construction and updates remain behind a replaceable projection capability rather than leaking storage technology into Core
- [x] #6 Tests prove rebuilt and incrementally updated indexes answer equivalent data for representative recursive graphs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the storage-neutral projection contract with a bounded deterministic canonical fingerprint, derive it in Persistence from the exact normalized canonical snapshot using project hashing conventions, persist and validate it, and regress same-generation divergent states for both load and later update. 2. Classify resource-too-large projection reads as disposable corruption, atomically rebuild them, and prove canonical bytes remain unchanged. 3. Replace the published raw transaction engine with a projection-aware capability that preserves the full public transaction-engine interface, routes both application and direct plugin commits through one post-commit update boundary, and never reclassifies canonical success when projection fails. 4. Run focused adversarial tests, send the full diff through the same independent reviewer, correct justified findings, then run full checks, all targets, Backlog validation, exact Claude URL review, and amend/force-push the same single-commit ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L2 high-risk because this introduces a public cross-layer capability, generation semantics, derived persistence, and Host composition. The existing Core graph.committed sequence contract supplies the authoritative contiguous-generation decision; LocalTransactionJournal snapshot([]) supplies one exact canonical generation and state; Markdown/alias stores remain canonical; LocalResourceProvider supplies bounded reads, same-machine coordination, staged atomic replacement, and deletion. The implementation will place only storage-neutral projection data/capability contracts in Core, put JSON/local-resource mechanics in Persistence, and expose one replaceable Host capability. The index is an explicitly disposable .groma cache: it never participates in canonical transactions and never writes intent or aliases. Missed/corrupt/absent/stale state rebuilds from one exact canonical snapshot; provider/source failures return one stable actionable unavailable diagnostic. No database, renderer, evidence join, generic registry, or query engine is in scope.

Implemented a bounded deterministic local projection at .groma-cache/projection-index.json behind a storage-neutral Core capability and explicit official Host plugin. The transaction adapter reads one exact canonical snapshot, resolves alias-sensitive containment and relationship endpoints, and application commits forward only confirmed graph.committed events after canonical success. Projection publication is coordinated and atomic, self-ignores its cache without changing project rules, and collapses unavailable paths to one stable diagnostic. Adversarial regressions cover rebuild/incremental equivalence, stale/corrupt/deleted/gapped state, exact event validation and preflight bounds before source access, alias-only parent/endpoint changes, canonical byte preservation, inherited toJSON pollution, search/UTF-8 capacity, publication failure, and deleted/corrupt ignore-marker repair. Independent no-edit review completed three passes; all findings were corrected and the final review returned PASS. Validation: bun run check passed 641 tests with 4,455 assertions plus formatting, typecheck, boundaries, native build, smoke, and Iteration 1A crash recovery; bun run check:targets verified darwin-arm64, linux-x64, windows-x64, and windows-arm64 executables; backlog doctor and git diff --check passed.

Claude URL review command claude -p review-URL found no correctness defects and approved with cleanup. One relevant convention improvement was applied: well-shaped but over-bound committed events now report committed-event-bound-exceeded separately from malformed events, while still failing before canonical source access or projection writes. The same independent reviewer returned PASS on the post-Claude delta, and bun run check with 641 tests and 4,455 assertions plus bun run check:targets passed again on that exact change.

Reopened after Codex exact-head review 4708266597 on 355285c. Three unresolved findings are in scope: same-generation cache trust must include deterministic canonical content identity; oversized projection files must self-heal as corrupt; and the publicly published transaction-engine capability must itself forward every confirmed commit to projection.update. GitHub threads remain intentionally unresolved for the root exact-head gate.

Claude URL review (Both findings are real but **latent** — they live in the read path, and `update()` (the only production caller, at `default-bootstrap.ts:777`) silently discards its failures, while `load()`/`rebuild()` aren't wired to a query surface yet. So nothing is broken for users today; the trap springs when the projection actually gets consumed. Both collapse to the same three lines in `readProjection`, which only forwards `resource-missing` to the rebuild path.

The rest of the branch held up well under scrutiny. The design is careful in the places that matter: `decode()`'s re-materialize-and-byte-compare is a genuinely strong integrity check, the alias-change refresh in `incremental()` correctly catches byte-unchanged entities whose parent or relation endpoints re-resolve (and the tests cover exactly that), `boundedUtf8Length` agrees with `TextEncoder` on lone surrogates, and the `appendSearchText` accounting is sound against NFKC and lowercase expansion. The `parseGraphCommittedEvent` extraction from `sequenceGraphCommittedEvent` is behavior-preserving — the generation is still parsed before the event.

The uncommitted diff itself is clean. Splitting the preflight into `accepted`/`bound-exceeded`/`malformed` is a strict improvement, and the test correctly pins that preflight precedence beats malformedness. One small thing: the new `overBound` loop switched to `toMatchObject` and so no longer asserts the diagnostic `message`, where the `malformed` loop above it still uses `toEqual` — worth keeping symmetric.

I also chased a possible proxy bypass of the bound preflight (the `event` object is read twice — once by `preflightCommittedEventBounds`, once by `parseGraphCommittedEvent`, which has no length bound of its own). The mechanism checks out, but I dropped it: `MANIFESTO.md:213` is explicit that capabilities are "review information, not a security sandbox," GROM-11 set precedent for treating exactly this shape as non-actionable, and the only caller passes a frozen Core-built event.

Two caveats on my confidence. I couldn't run `bun run typecheck` or the test suite — those need approval this session — so this is static review only. And if you want the efficiency angle looked at, one thing I noticed but didn't pursue: every commit now synchronously does roughly five full-graph passes (the canonical snapshot is normalized twice, once in the source and again in `loadCanonical`, plus `decode`'s full re-materialize), which largely defeats `incremental()`'s point. That reads like a deliberate integrity-over-speed trade for Iteration 1A, so I left it alone — say the word if you want it examined.) found no correctness defects and approved with cleanup. One relevant convention improvement was applied: well-shaped but over-bound committed events now report committed-event-bound-exceeded separately from malformed events, while still failing before canonical source access or projection writes. The same independent reviewer returned PASS on the post-Claude delta, and bun run check (641 tests / 4,455 assertions) plus bun run check:targets passed again on that exact change.

Reopened corrections implemented: projection snapshots now carry a bounded provider-defined canonical fingerprint; Core remains hash/storage neutral while the official local provider owns strict lowercase SHA-256 over bounded normalized aliases, entities, and relations with generation compared separately. Load rejects same-generation divergent caches, incremental candidates require exact full-state fingerprint equality, and oversized regular cache files self-heal without canonical mutation. The one published TransactionEngine now routes confirmed execute and recover outcomes through an isolated post-commit projection update while retaining the full engine interface and never reclassifying canonical success. Same-generation load/update, oversized-file, direct-execute, direct-recovery, and projection-failure regressions pass. The same independent reviewer identified the recovery path, the fix was applied, and the complete follow-up review returned PASS. Validation on the reviewed diff: bun run check passed 646 tests with 4,496 assertions plus formatting, typecheck, boundaries, native build, smoke, and Iteration 1A crash recovery; bun run check:targets verified darwin-arm64, linux-x64, windows-x64, and windows-arm64 executables; git diff --check passed.

Claude follow-up decisions on the updated PR: the full decode/materialize pass before incremental publication is an intentional continuity-first Iteration 1A trade at the bounded 1,000-component scale; optimization must not weaken exact fingerprint verification and can be revisited with the first query consumer. Projection being write-only until the next query-engine slice is expected milestone sequencing, with load/rebuild coverage carrying the contract meanwhile. Claude's relevant capacity drift was corrected at configuration validation: exactly 54 enabled local plugins are accepted and the 55th is rejected before runtime composition. An unexpected exception while decoding already-read disposable cache bytes is now narrowly classified as missing/corrupt so it can rebuild; canonical-source and publication failures remain outside that catch. No artificial throw seam was added because JSON parsing produces plain data, decode uses captured intrinsics, and reachable recursive payload validation already returns contained Results; inducing the residual branch would require unrealistic global/runtime damage. Focused follow-up validation passed 47 tests with 330 assertions plus typecheck, boundaries, and git diff --check.

Final post-Claude validation on the independently reviewed delta: bun run check passed 646 tests with 4,497 assertions plus formatting, typecheck, boundaries, native build, smoke, and Iteration 1A crash recovery; bun run check:targets again verified all four standalone targets. The same independent reviewer returned PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built the reconstructable projection index as one replaceable Core/Persistence/Host capability with deterministic exact-state fingerprinting, safe same-generation branch/checkout rejection, contiguous guarded updates, oversized/corrupt cache self-healing, and post-commit continuity for both direct/application execution and recovery. Canonical intent remains immutable when the disposable projection fails. Verified representative recursive rebuilt/incremental equivalence and adversarial continuity boundaries with 646 passing tests (4,497 assertions), four standalone targets, repeated independent PASS reviews, Backlog validation, and exact PR review.
<!-- SECTION:FINAL_SUMMARY:END -->
