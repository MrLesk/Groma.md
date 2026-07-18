---
id: GROM-37
title: Persist canonical evidence coverage and bindings
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 12:46'
labels: []
milestone: m-3
dependencies:
  - GROM-35
  - GROM-36
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/persistence/evidence-binding-store.ts
  - src/persistence/tests/evidence-binding-store.test.ts
  - src/persistence/index.ts
  - src/persistence/README.md
  - src/persistence/schema-migration.ts
  - src/host/tests/schema-migrations.test.ts
priority: high
type: feature
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the canonical evidence plane that preserves completed observations, provenance, coverage, and Groma-owned binding decisions separately from human- and agent-curated intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Completed observations, provenance units, declared coverage, source ownership, and project identity persist as deterministic human-readable canonical records outside intent documents
- [x] #2 Bindings represent automatic, explicit, ignored, and superseded decisions and resolve through component aliases
- [x] #3 Evidence and binding generations reload after restart and can be reconstructed without volatile timestamps or process-specific paths
- [x] #4 An unchanged completed snapshot produces no canonical byte churn and never rewrites curated intent files
- [x] #5 Missing or unavailable source coverage preserves prior evidence and binding history instead of silently erasing architecture
- [x] #6 The initial deterministic evidence sharding handles the documented 256-bucket strategy and reports evidence needed to evaluate later fanout changes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a persistence-owned canonical evidence/binding model around completed observation snapshots: stable source lanes and observation identities, generation-bearing retained evidence and coverage, four binding decisions, key-supersession resolution, and component-alias-aware reads. Keep operational epochs/tokens, derived status taxonomy, project availability, and reconciliation outside this task.
2. Implement a bounded deterministic Markdown store for source/coverage documents plus fixed 256-bucket evidence and binding shards. Load and validate exact canonical layouts, schemas, UTF-8/YAML, identity/bucket ownership, duplicates, bounds, revisions, and restart reconstruction.
3. Implement a pure no-write planner/materializer that accepts current store state, a successful completed-snapshot and/or explicit binding mutations, and one supplied graph generation; retain older evidence, emit only exact changed shard/source targets, preserve bindings and intent, and return deterministic per-bucket fanout statistics. Do not add a Host capability, direct save path, standalone transaction adapter, or reconciliation logic; GROM-41 will compose these targets into the existing atomic journal.
4. Register the new canonical roots/layouts with schema migration discovery and export/document the Persistence surface without changing public CLI/Application behavior.
5. Add adversarial and acceptance-focused tests for all observation kinds, provenance and zero-record coverage, restart fidelity, semantic replay under a new epoch, source isolation and retention, all binding histories and alias/supersession failures, every bucket/statistic, wrong layouts and hostile YAML/bounds, intent isolation, and composable exact targets. Run focused checks, then full repository and target verification; submit the result to fresh specification and quality subagent reviews before PR review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-plane durability change. Independent context and architecture reviews agree that source ownership is (projectId, source.id, source.instance), scanner version is provenance rather than identity, operational session epochs must not enter canonical bytes, omitted/unavailable sources must cause no mutation, and older evidence must remain generation-addressable. The architectural cut is a Persistence codec/loader/resolver plus pure transaction-ready materializer only: a temporary evidence-only write adapter would create a second semantic path and cannot provide the GROM-41 composite atomic commit. The exact displayed missing/stale/ambiguous taxonomy, source registration/availability, reconciliation, Host/CLI integration, and projection remain downstream tasks.

Implementation subagent completed the Persistence-only slice: strict deterministic Markdown source/evidence/binding codecs and bounded loader, retained generation-aware evidence, four-decision binding histories with supersession and component-alias resolution, pure exact-target planning, 256-bucket fanout statistics, and migration catalog discovery. Added acceptance/adversarial tests. Verification: focused 17/17, full repository 944/944 (6,965 assertions), and full bun run check including build, smoke, Iteration 1A/1B, and frozen self-blueprint all green. No Host/Application/CLI integration, direct write path, commit, PR, or task finalization was performed.

Historical integrity follow-up: persisted binding decisions are now replay-validated as generation-indexed graph state, so a later terminal decision cannot mask an earlier cross-lane supersession, self-link, missing terminal, or cycle. Added malformed-history regression coverage plus a valid terminal-to-superseded-to-terminal reload proof. Verification: focused evidence/migration suite 19 passing; full bun run check 946 tests / 6976 assertions, build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint all green.

Bounded materialization follow-up: load and plan now use one shared per-document and aggregate byte-accounting path, so plan fails before exposing targets or a snapshot that would be rejected on restart. Added independent planner regressions for maxDocumentBytes and maxTotalDocumentBytes, including exact-boundary target application and reload proofs. Verification: focused evidence/migration suite 21 passing; full bun run check 948 tests / 6987 assertions, build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint all green.

Quality hardening follow-up: added a retained aggregate binding-history bound (1,000,000 default; 4,000,000 absolute), enforced before replay allocation and incrementally across load shards and plan mutations. Generation-atomic replay now validates each changed reverse-reachable region once with iterative memoization. Source reconstruction now precomputes one scope context and current-record index per lane; completed-snapshot conversion also reuses one scope index. Load passes remaining evidence/binding/history capacity into private shard decoders before retaining records, and public decoders compare deterministic output only with the intrinsic byte snapshot. Scale/adversarial coverage includes an 8,192-node valid chain plus cycle/missing terminals, 8,192 retained history events and aggregate boundary reload, 256 source lanes with a linear accessor-work bound, cross-shard cumulative evidence/binding/history overflow, and hostile byte accessors/proxies for all public decoders. Verification: focused evidence/migration suite 26 passing; full bun run check 953 tests / 7036 assertions, build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint all green.

Loader/materializer symmetry follow-up: deterministically serialized zero-entry evidence shards and zero-binding binding shards now fail with dedicated empty-evidence-shard and empty-binding-shard diagnostics; empty buckets remain represented only by absent files. Added restart regressions for both invalid shard kinds, strengthened source/evidence/binding no-op rematerialization to compare exact resources, revisions, and bytes with zero targets, and confirmed a zero-record source-only snapshot remains valid and no-churn. Verification: focused evidence/migration suite 27 passing; full bun run check 954 tests / 7043 assertions, build, smoke, Iteration 1A, Iteration 1B foundation, and self-blueprint all green.

Final independent verification after specification PASS and quality APPROVED: bun run check passed 954 tests / 7,043 assertions plus formatting, typecheck, architecture boundaries, build, smoke, Iteration 1A/1B, and frozen self-blueprint verification. bun run check:targets passed darwin-arm64, linux-x64-baseline, windows-x64-baseline, and windows-arm64. git diff --check passed. The final all-plane replay proves exact resource/revision/byte no-churn; zero-record source-only state remains valid; empty shards fail closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Groma's canonical evidence and binding persistence plane as strict deterministic Markdown source records plus fixed 256-bucket evidence and binding shards. The Persistence-only store reloads completed observations, provenance, coverage, source ownership, project identity, graph generations, retained missing evidence, and automatic/explicit/ignored/superseded binding histories; resolves key supersession and component aliases fail closed; and produces pure exact transaction targets without a direct write path or intent mutation. Loader and planner share byte/item/history bounds, generation-aware validation, source-lane indexing, canonical migration discovery, and derived 256-bucket fanout measurements. Verified through 27 focused evidence/migration tests, 954 repository tests / 7,043 assertions, all build/smoke/Iteration checks, four standalone targets, specification PASS, quality APPROVED, and clean diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
