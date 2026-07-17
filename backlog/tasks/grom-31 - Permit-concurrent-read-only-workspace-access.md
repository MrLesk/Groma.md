---
id: GROM-31
title: Permit concurrent read-only workspace access
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 10:33'
labels: []
milestone: m-4
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - src/cli/tests/program.test.ts
  - src/host/README.md
  - src/host/local-plugin-packages.ts
  - src/host/tests/application-operations-local.test.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/local-plugin-packages.test.ts
  - src/persistence/README.md
  - src/persistence/local-transaction-journal.ts
  - src/persistence/projection-index.ts
  - src/persistence/tests/local-transaction-journal.test.ts
  - src/persistence/tests/projection-index.test.ts
  - tests/iteration-1a/verify.ts
priority: high
type: bug
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the dogfood failure in which several independent read-only CLI processes can surface workspace-recovery-failed, so humans and multiple agents can inspect one blueprint concurrently without destabilizing it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A regression test reproduces concurrent reads from at least eight independent CLI processes against one initialized workspace
- [x] #2 All concurrent read-only commands complete with deterministic valid results and none reports workspace-recovery-failed
- [x] #3 Concurrent reads leave every canonical resource and the committed generation byte-for-byte unchanged
- [x] #4 Writer exclusion, crash recovery, and stale-lock safety remain intact while readers are concurrent
- [x] #5 The behavior is portable across the supported local-resource path and locking abstractions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce concurrent canonical and projection-backed CLI reads through the compiled binary, classify each contended local state gate, and capture canonical bytes before and after.
2. Add persistence-local optimistic transaction snapshots and projection-continuity checkpoint reads only for stable idle journal state with no retained lease, fenced by matching idle generation and state observations around canonical or checkpoint reads.
3. Give local plugin-package startup brief coherent package-state observations for initial capture, each pre-import revalidation, and final revalidation; release coordination before materialization or import, follow only exact ordinary contention for a finite bound, and keep every package mutation, recovery, and publication exclusively coordinated.
4. Add a read-only fast path for an already complete projection index and a bounded read-only follower for a sole contended cold repair; validate canonical identity, manifest and chunks, continuity checkpoint, and ignore hygiene without follower publication or repair.
5. Keep transaction settlement, projection rebuild and publication, package publication, retained leases, writer exclusion, crash recovery, stale-owner handling, and public capability contracts unchanged.
6. Add focused journal, projection, and package-state interleaving tests for stable readers, writer races, exact final revalidation, retained-release handling, cold publication liveness, and coherent old-or-new results.
7. Extend compiled Iteration 1A verification to launch at least eight independent concurrent canonical reads and eight cache-cold projection-backed exports, require deterministic valid output, and prove the complete canonical workspace and committed generation remain byte-for-byte unchanged.
8. Document each optimistic or briefly coordinated read fence at its owning Persistence or Host boundary while keeping canonical meaning separate from disposable projection state.
9. Run focused Persistence, Host, Application, and CLI tests; compiled and crash-recovery workflows; the full check; all target checks; independent specification and quality reviews; then finalize the task and ready pull request.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Historical release context: Iteration 2 intentionally shipped a fail-closed single-active-CLI-process path and deferred concurrent independent readers to this task. GROM-31 now owns removing that limitation without weakening deterministic canonical state, writer exclusion, crash recovery, or stale-owner safety. Future release documentation must describe the concurrent-read behavior actually verified here rather than retaining the old limitation.

Initial compiled reproduction found two independent read-only startup contention gates: the local transaction journal snapshot and local plugin-package loadEnabled projection. Eight simultaneous component-list processes produced one success plus workspace-recovery-failed, provider-snapshot-failed, and five plugin-package-state-unavailable failures. A journal-only change cannot satisfy the user-visible acceptance criteria, so the plan covers both owning local state projections while preserving exclusive mutation/recovery paths and all public contracts.

A warmed projection-backed reproduction found a third read-only startup gate after the transaction and package fixes: eight simultaneous blueprint-export processes produced one success and seven graph-query-unavailable failures because projection load and continuity-checkpoint reads still acquired exclusive coordination. GROM-31 therefore includes a no-write fast path for an already complete exact-matching projection and stable idle checkpoint; all rebuild, repair, adoption publication, checkpoint publication, and canonical writes stay exclusively coordinated.

Implemented three bounded, coordination-free read paths: stable-idle optimistic canonical/checkpoint reads with exact double-observation fences; exact-revalidated enabled-package startup reads; and warmed, complete projection adoption. All settlement, recovery, repair, publication, package mutation, and canonical writes remain exclusively coordinated. Validation: bun run check passed (format, typecheck, architecture boundaries, 773 tests / 5,491 expectations, compiled Iteration 1A workflow); the adversarial dead-writer recovery regression passed 10 consecutive runs; bun run check:targets passed darwin-arm64, linux-x64-baseline, windows-x64-baseline, and windows-arm64; independent specification and quality reviews approved; git diff --check passed.

Claude review identified that indeterminate live-transaction release failures kept the optimistic-read guard latched behind the token-specific preparation. Remediation transfers throwing/retryable releases into the existing retained-lease handoff, while terminal ownership-loss/invalid results detach without retention. Independent re-review then found and closed a delayed-acknowledgement race by replacing the shared boolean with exact active-lease identity, so an older L1 completion cannot clear a newer L2 marker. Deterministic tests cover throwing, retryable, delayed success, delayed ownership-lost, and delayed invalid release outcomes; they prove retained handoff, exact contention while L2 is active, restored eight-reader optimistic access, and committed recovery. Full check and journal suite pass; the five focused cases passed 10 consecutive repetitions; independent re-review approved.

Claude second review exposed a possible two-handle release overlap and a cold-projection double-read. Final remediation enforces one active-or-retained transaction lease per journal: acquisition fails locally while an exact active lease exists, token-local lease ownership detaches before provider release is awaited, and success, terminal, retryable, and throwing acknowledgements cannot be reused or clear another operation. Direct delayed-ack tests cover snapshot, checkpoint, concurrent same-token commit and recover, retained handoff, exact one-attempt contention, normal recovery, and restored eight-reader optimistic access. Projection load now inspects the disposable cache first, so absent, corrupt, deleted, and oversized caches enter coordinated repair with exactly one canonical load; loaded fast-path candidates still fingerprint canonical state and reload under coordination on fallback. Full check passed with 781 tests and 5,561 expectations; focused Persistence suites passed 115/845; same-token tests passed 10 consecutive repetitions; final independent review approved; git diff --check passed.

The final GitHub quality job exposed runner-only timing pressure, not a behavior failure: the host restart workflow and two CLI end-to-end workflows hit Bun’s 5-second default at 5.001–5.132 seconds while 778 other tests and both binary jobs passed. Exactly those three integration tests now use the existing finite 20-second per-test allowance; production code and global test behavior are unchanged. Focused verification passed 3 tests/128 expectations, full check remained green at 781/5,561, independent review approved, and git diff --check passed.

Latest Codex review correctly found that cache-cold concurrent projection reads still raced at fail-fast repair: the compiled reproduction produced one successful export and seven graph-query-unavailable exits with canonical bytes unchanged. The load path now follows only an exact single resource-coordination-contended acquisition result with 16 complete read-only adoption observations spaced 20 ms apart. Followers never reacquire coordination, repair, ensure hygiene, stage, or publish; they can only adopt the winner after the existing projection/canonical fingerprint/manifest/checkpoint/ignore fence succeeds, otherwise they fail closed after the fixed bound. Both mixed-diagnostic orderings, persistent contention, malformed/failed publication, exact winner adoption, and zero follower writes are covered. Compiled Iteration 1A now deletes the cache before launching eight independent exports and proves identical valid output plus byte-identical canonical state. Full check passed with 786 tests/5,588 expectations; all four target builds passed; the cold workflow passed 10 repetitions; independent specification and quality reviews passed; git diff --check passed.

Final GitHub review remediation supersedes the earlier fixed 300-millisecond cold-follower and coordination-free package-startup descriptions. Cold projection followers now use a finite schedule sized from configured capacity: a 750-millisecond floor, scaling to a 10-second cap at default supported bounds, with 20-to-500-millisecond exponential polling. They still follow only one sole coordination-contention result, never reacquire, repair, stage, or publish, and adopt only through the complete projection, canonical, manifest, checkpoint, and ignore-hygiene fence. A healthy publisher held beyond the former window is adopted; small-bound persistent and malformed cases exhaust deterministically.

The package-state review found a reachable C/L/U ABA mixture across supported blueprint and personal mutations. Startup now captures and exact-revalidates configuration, lock, and personal state or required root absence under brief package-state coordination, releases before package materialization and imports, retries only a sole contention diagnostic every 25 milliseconds for at most two seconds per coherent observation, and maps all other coordination failures to unavailable package state. The regression manually proves the former synthetic C1/L1/U0 projection never existed across real C1/L1/U1 -> C0/L0/U1 -> C0/L0/U0 states, then proves fenced startup fails before import. Windows, unusable-root, zero-entry, eight-reader, bounded-exhaustion, and mixed-diagnostic paths are covered.

Final verification on the exact tree: bun run check passed formatting, type checking, architecture boundaries, 791 tests across 37 files with 5,649 expectations, the compiled Iteration 1A eight-reader cache-cold workflow, and crash recovery. bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64 executables. Focused package tests passed 49 tests and 452 expectations; focused projection tests passed 39 tests and 298 expectations; git diff --check passed. Independent cold-projection and package-state reviews approved the final behavior and exact regressions.

Final Claude review clarified the verified scope without changing semantics: settled-state readers may run concurrently, while an active prepared or committing writer still makes canonical snapshot and checkpoint reads fail fast; package-state retry is bounded per coherent observation; and package acquisition constants now use retry rather than follower naming. The projection budget remains intentionally derived from configured reconstruction ceilings in response to the bounded-workload review requirement. The two local sole-contention checks remain at their owning layer boundaries rather than creating a new cross-layer public helper, and post-fence root-absence checks remain because they catch unsupported direct root creation after the coherent observation.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-07-17 09:47
---
Reopened during final pull-request review remediation: the latest Codex review identified two actionable concurrency findings. The cold-projection follower liveness window and coherent package-state startup fence are being corrected and reverified before merge.
---

author: @codex
created: 2026-07-17 10:33
---
Final pull-request head passed local and hosted checks, all four target builds, compiled verification, Claude review, independent package/projection/whole-diff reviews, and Codex review. Ready to merge PR #32.
---
<!-- COMMENTS:END -->

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Permitted at least eight independent CLI processes to inspect one initialized workspace concurrently through canonical and cache-cold projection-backed reads without recovery, package-state, or graph-query failures. Stable-idle transaction and checkpoint snapshots remain optimistic; package startup uses only brief coherent observations outside plugin execution; cold projection losers follow one bounded read-only publication path. Writers, crash recovery, stale-owner handling, mutations, repair, and publication remain exclusive. Verified by 791 tests and 5,649 expectations, the compiled byte-for-byte canonical-state workflow, crash recovery, all four target builds, exact ABA and slow-publication regressions, and independent reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
