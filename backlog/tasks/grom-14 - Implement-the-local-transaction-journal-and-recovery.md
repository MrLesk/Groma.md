---
id: GROM-14
title: Implement the local transaction journal and recovery
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 19:57'
labels:
  - persistence
  - transactions
  - recovery
milestone: m-1
dependencies:
  - GROM-10
  - GROM-12
  - GROM-13
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide crash-safe multi-resource transactions for the official local host. The journal stages a complete target generation, records recoverable commit progress, and ensures startup observes either the complete prior generation or the complete new generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A transaction records its base generation, target generation, target resources, expected revisions, and staged replacements before any canonical target changes
- [ ] #2 The committed generation marker advances only when all target resources form the complete new generation
- [ ] #3 Recovery is idempotent and deterministically finishes or rolls back an interrupted transaction without creating a mixed generation
- [ ] #4 Concurrent writers are coordinated so stale or competing transactions fail without overwriting committed work
- [ ] #5 Journal and staging artifacts contain no volatile metadata that would create canonical Git churn and are cleaned after a confirmed outcome
- [ ] #6 Fault-injection tests terminate the transaction at every durable phase and prove that restart exposes exactly the old or new complete graph
- [ ] #7 The resulting generation and recovery outcome satisfy the Core transaction-provider contract and leave a future projection watermark integration point
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a persistence-local canonical transaction adapter, strict bounds, deterministic token/revision helpers, and a versioned fixed transaction-state resource. The adapter loads the Standard Model transaction state and materializes exact sorted replace/delete targets; Core remains model/storage neutral.
2. Extend the Local Resource Provider only where crash safety requires filesystem authority: persistent same-machine coordination leases spanning prepare through commit, target-specific orphan-stage cleanup, and idempotent durable file removal. Preserve the existing callback API, confinement, typed outcomes, POSIX parent-directory sync, explicit Windows durability limits, and all four compile targets.
3. Implement snapshot and prepare under the transaction lease. Recover any interrupted prior journal first, read one committed generation and requested revisions, atomically recheck proposal generation/revisions, durably publish a bounded prepared record containing base/target generation, affected identities, expected/result revisions and replacement/delete content, then stage all replacement handles before returning the deterministic opaque token. No canonical target changes during prepare.
4. Implement commit as prepared -> committing -> settled. Publish the durable committing marker before changing targets; apply sorted replacements/deletions idempotently; verify every exact resulting revision; then publish the idle state with the new committed generation and a bounded settlement receipt. Advance the generation marker only after the complete target set exists, preserve a projection-watermark field as the future projection integration point, and never infer rollback after committing begins.
5. Implement idempotent recovery and startup settlement. A prepared record rolls back and cleans stages; a committing record compares each target with its expected/result revision and deterministically finishes the new generation; an idle matching settlement repeats the same committed/not-committed result. Unknown or externally divergent state stays indeterminate. Clean journal-owned stages after confirmed outcomes.
6. Add boundary-local conformance and integration tests using the real Local Resource Provider and Markdown intent store: initial/steady snapshots, multi-document replace/create/delete, deterministic journal bytes/tokens, optimistic conflicts, competing writers, repeated recovery, projection watermark preservation, malformed/bounded journal records, and no timestamps/absolute paths.
7. Add phase-by-phase fault injection around every durable journal and target boundary. Restart with fresh provider instances and prove each interruption exposes exactly the complete old or complete new graph, cleanup is idempotent, and subsequent work succeeds.
8. Run focused and full checks, direct journal compilation for macOS arm64, Linux x64 baseline, Windows x64 baseline and Windows arm64, independent specification and quality reviews, then publish a ready task-linked PR and complete Claude/Codex review handling before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L3 crash-durability and cross-process coordination boundary. Core already freezes the generic snapshot/prepare/commit/recover protocol; GROM-14 will implement that contract without adding filesystem or Standard Model policy to Core. Recovery policy is rollback only before a durable committing marker and roll-forward after it. A persistent resource-provider coordination lease must span Core prepare through commit so another process cannot treat a live prepared journal as abandoned. The fixed journal/generation record is deterministic and contains no timestamps, random owner data, or absolute paths; volatile lock ownership remains in the provider coordination area. Current /oven-sh/bun docs confirm node:fs/promises FileHandle.sync delegates to fsync, directory handles exist on POSIX and Windows, and Windows rename uses replace semantics; the existing provider portability policy continues to skip unsupported Windows directory-durability claims.

Implemented the persistence-local canonical adapter and official Markdown intent materializer; extended the local resource provider with persistent opaque leases, bounded target-specific orphan-stage cleanup, and idempotent durable removal; implemented deterministic prepared/committing/idle recovery with exact revisions, bounded last settlement, and projection watermark preservation. Added real-store integration, phase restart, concurrency, cleanup/release failure, create/replace/delete, malformed/bounded state, and four-target compilation coverage. Full check passes 231 tests / 1094 assertions; focused persistence passes 78 tests / 369 assertions; all four standalone targets and the journal module compile. Pending independent specification and quality review before PR.

Persistent transaction leases now use immediate recovery only after the exact owner token is revalidated and its PID is proven dead twice; ordinary callback coordination retains the stale-age threshold. Added a real killed-child regression for both policies. Final pre-review validation: full check passes 233 tests / 1101 assertions; focused persistence passes 80 tests / 376 assertions; check:targets and direct journal compilation pass macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64.

Specification-review fixes: the journal now independently verifies an exact resource/expected-revision bijection against every generic adapter materialization before publishing prepared state; deletion retries committed-indeterminate and requires confirmed commit plus exact absence readback; resource fault injection carries the portable locator. Added damaging fake-adapter cases, one-shot/repeated indeterminate deletion recovery, and a no-cleanup child-process matrix that exits at journal after-rename, target rename-before-mode, target file sync, target parent sync, target after-rename acknowledgement, removal parent sync, and removal after-unlink acknowledgement. Fresh default-stale providers recover the proven-dead lease promptly, expose only complete old/new graphs, clean stages, and accept subsequent transactions. Validation: full check 243 tests / 1185 assertions; focused journal/provider 90 tests / 460 assertions; four binary targets and four direct journal targets pass.

Quality-review corrections: journal publication now retries the same staged handle and requires provider-confirmed durability; every committing record is durably re-published before target changes and matching idle settlement is re-published before committed acknowledgement. Added maxTargetBytes as a separate pre-prepare classification bound, correct provider-failure classification for non-contention acquisition faults, and retryable pre-move lease release that retains the process guard/live journal lease. Added occurrence-aware real-process crashes for committing and idle journal publication plus fake-provider, oversized delete/replace, provider-failure, and same-process release-recovery regressions. Focused journal/resource suite passes 101 tests / 531 assertions; full matrix pending.

Post-correction validation: focused journal/resource suite 101 tests / 531 assertions; full check 254 tests / 1256 assertions including formatting, typecheck, boundaries, build, and smoke; check:targets passes macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; direct local-transaction-journal compilation passes all four targets. Ready for exact-commit specification and quality re-review.

Exact-review durability fixes: fresh-process roll-forward no longer treats matching replacement bytes as sufficient. Without a live handle it re-stages the exact replacement stored in the deterministic journal, requires a provider-confirmed commit, and verifies exact result readback before settlement. The real child-process crash matrix now passes portable locator context through the resource fault callback and proves every durable committing state performs at least one confirmed target replacement/reassertion during fresh default-stale recovery before subsequent work. Prepare also rejects groma/transaction-state.json as a canonical target before journal publication even when proposal expectations and a generic adapter agree; a real-provider damaging regression proves the journal stays absent, snapshot remains usable, and a later valid transaction commits. Validation: focused persistence 102 tests / 545 assertions; full check 255 tests / 1270 assertions; all four standalone targets and direct journal compilation pass macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64.

Final specification cleanup fix: token-scoped live preparation records now track every recovery-created replacement handle before provider commit, clear handle slots only after successful discard, retain cleanup-pending records across failures, remove handle-only records after confirmed cleanup, and retain lease-bearing records until release succeeds. Freshly acquired finish/recovery leases are attached to the token record so a failed release remains retryable. Roll-forward cleans tracked stages before returning an unconfirmed target and also on injected target-phase faults, covering both explicit recover and snapshot/startup settlement. Added a real child-process regression that leaves a durable committing record, fails the first fresh snapshot at target pre-rename, settles on the second snapshot, and proves zero stage artifacts, plus a fresh recovery lease-release retry regression. Validation: focused journal/provider 104 tests / 557 assertions; full check 257 tests / 1282 assertions; check:targets and direct journal compilation pass macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64.
<!-- SECTION:NOTES:END -->
