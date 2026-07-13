---
id: GROM-14
title: Implement the local transaction journal and recovery
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-13 14:55'
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
modified_files:
  - src/persistence/README.md
  - src/persistence/contracts.ts
  - src/persistence/index.ts
  - src/persistence/local-resource-provider.ts
  - src/persistence/local-transaction-journal.ts
  - src/persistence/tests/fixtures/coordination-child.ts
  - src/persistence/tests/fixtures/transaction-crash-child.ts
  - src/persistence/tests/local-resource-provider.test.ts
  - src/persistence/tests/local-transaction-journal.test.ts
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide crash-safe multi-resource transactions for the official local host. The journal stages a complete target generation, records recoverable commit progress, and ensures startup observes either the complete prior generation or the complete new generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A transaction records its base generation, target generation, target resources, expected revisions, and staged replacements before any canonical target changes
- [x] #2 The committed generation marker advances only when all target resources form the complete new generation
- [ ] #3 Recovery is idempotent and deterministically finishes or rolls back an interrupted transaction without creating a mixed generation
- [ ] #4 Concurrent writers are coordinated so stale or competing transactions fail without overwriting committed work
- [x] #5 Journal and staging artifacts contain no volatile metadata that would create canonical Git churn and are cleaned after a confirmed outcome
- [ ] #6 Fault-injection tests terminate the transaction at every durable phase and prove that restart exposes exactly the old or new complete graph
- [x] #7 The resulting generation and recovery outcome satisfy the Core transaction-provider contract and leave a future projection watermark integration point
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make local resource deletion treat a missing resolved parent as an already-absent target while preserving fail-closed handling for every other resolution failure; add provider and journal recovery regressions. 2. Keep idle-settlement recovery indeterminate when the required journal re-publication or cleanup fails, then prove a later retry can confirm and return the durable settlement. 3. Generalize the existing retained snapshot-lease handoff so failed prepare releases retain the only opaque coordination handle and the next snapshot or prepare can settle and release it without process restart. 4. Run focused persistence tests, format/type/boundary checks, the complete repository suite and compiled walking skeleton, all four standalone targets, diff and dependency checks, then publish a ready task-backed PR and complete Claude, exact-head Codex, and CI review gates before re-finalizing GROM-14.
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

Startup snapshot lease fix: the journal now retains an opaque snapshot/startup coordination lease in volatile memory when pre-move release fails. The next snapshot atomically takes the retained lease before its first await, so one caller can retry release while a concurrent caller follows normal acquisition and safely contends; confirmed release clears the slot. Added ordinary idle retry and concurrency-barrier regressions, plus the exact real-child case: a durable committing child exit is fully settled by a fresh snapshot, its first release fails, the second snapshot reuses and releases the lease at generation 1 without contention, stage artifacts remain empty, and a subsequent transaction commits generation 2. Existing token-scoped handle cleanup and finish/recover lease retry remain green. Validation: focused journal/provider 107 tests / 574 assertions; full check 260 tests / 1299 assertions; check:targets and direct journal compilation pass macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64.

Final quality hardening: transaction-state target reservation now uses captured String normalize/toLowerCase intrinsics with NFC -> case-fold -> NFC conservative aliasing, matching local coordination semantics. Exact and uppercase generic-adapter aliases are rejected before token/prepared publication; regressions prove both canonical and alias resources remain absent, snapshot stays usable, and later valid work commits. Journal-state publication now tracks same-process staged handles with exact prior/intended bytes and a commit-or-discard disposition. Provider not-committed and thrown pre-move outcomes discard; failed discard remains pending and is retried before any later stage; thrown or uncertain publication with intended bytes visible retains and retries the handle to finish finalization, while divergent readback fails closed. Added typed not-committed, pre-move throw, failed-discard retry, and visible-post-move throw regressions with zero final stage artifacts. Validation: focused journal/provider 112 tests / 604 assertions; full check 265 tests / 1329 assertions; check:targets and direct journal compilation pass macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64.

PR #12 review gates: independent exact-commit specification and code-quality reviews passed at 066b91b. Claude approved with minor non-blocking suggestions after reviewing naming, conceptual simplicity, coherence, and user perspective; suggestions were assessed and intentionally deferred or retained by design. Codex completed with a thumbs-up and no comments or review threads. GitHub Verify quality gates and all four cross-platform binary checks passed.

Completion audit on 2026-07-13 found that PR #12 merged before Codex finished. Its late exact-head review raised three actionable P2 findings that remain reproducible on current main: missing parent directories make already-absent deletion report not-committed; failed idle-settlement re-publication can be misreported as committed; and failed prepare release can lose the only retryable coordination handle. PR #11 also lacked a final Codex thumbs-up after a usage-limit retry, so the corrective PR must revalidate the combined current persistence surface. Reopened GROM-14 and acceptance criteria 3, 4, and 6 rather than treating historical notes as proof.

Implemented the three completion-audit corrections on agent/grom-14-late-review-corrections. Local deletion now treats only resource-missing resolution as an already-absent committed target; every other resolution failure remains not-committed. Idle-settlement recovery tracks its required re-publication attempt and stays indeterminate on ordinary staging/cleanup failure until a later retry succeeds. The journal generalized its volatile retained snapshot lease into one transaction-lease handoff shared by snapshot and prepare, installs live preparation ownership before prepared publication, and transfers failed prepare cleanup releases into the retryable handoff without exposing the opaque handle. Added provider idempotence, committing-deletion recovery, failed settlement re-publication, and next-snapshot/next-prepare lease regressions; updated persistence semantics documentation. Validation: focused provider/journal suite passed 117 tests / 628 assertions; bun run check passed formatting, strict types, architecture boundaries, 452 tests / 2,959 assertions, native build/smoke, the complete compiled workflow, PTY checks, malformed-state containment, and 16 crash/recovery cases; bun run check:targets passed macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 plus compatible-host execution; bun ci made no changes; git diff --check and architecture boundaries pass.
<!-- SECTION:NOTES:END -->
