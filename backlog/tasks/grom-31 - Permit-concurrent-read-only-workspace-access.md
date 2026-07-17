---
id: GROM-31
title: Permit concurrent read-only workspace access
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 08:39'
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
1. Reproduce concurrent canonical and projection-backed CLI reads through the compiled binary, classify every contended local state gate, and capture canonical bytes before and after.
2. Add persistence-local optimistic transaction snapshots and projection-continuity checkpoint reads only for stable idle journal state with no retained lease, fenced by matching idle generation/state observations around canonical or checkpoint reads.
3. Make local plugin-package startup projection read optimistically from captured configuration, lock, and user state, then exact-revalidate that same state before success; keep every package mutation, indeterminate recovery, and state publication exclusively coordinated.
4. Add a read-only fast path for an already complete projection index: validate canonical identity, manifest/chunks, and continuity checkpoint without coordination or publication; fall back to the existing exclusive load/rebuild/adopt/publish path whenever repair, adoption, ignore publication, checkpoint update, or any unstable state is required.
5. Keep transaction settlement, projection rebuild/update/publication, package publication, retained leases, writer exclusion, crash recovery, stale-owner handling, and every public capability/coordination contract unchanged.
6. Add focused journal, projection, and package-state interleaving tests for stable readers, writer races, exact final revalidation, retained-release handling, and coherent old-or-new results.
7. Extend compiled Iteration 1A verification to launch at least eight independent concurrent canonical reads and eight projection-backed blueprint exports, require deterministic valid output, and prove the complete canonical workspace and committed generation remain byte-for-byte unchanged.
8. Document the three optimistic read fences at their owning Persistence/Host boundaries and keep canonical meaning separate from disposable projection state.
9. Run focused Persistence/Host/Application/CLI tests, compiled and crash-recovery workflows, full check, all target checks, independent specification and quality review, then finalize the task and ready PR.
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Permitted at least eight independent canonical and warmed projection-backed CLI readers to inspect one workspace concurrently without mutation or recovery failures. Exact pre/post fences preserve deterministic old-or-new snapshots, while writers, crash recovery, stale-owner handling, repair, and publication remain exclusive. Verified with the full check, compiled 8-reader workflows, byte-identical canonical-state assertions, adversarial dead-writer recovery, all supported target builds, and two independent reviews.

PR review remediation additionally made uncertain lease handoff reusable by the next journal operation and made the optimistic-read guard lease-specific under overlapping delayed release acknowledgements.

Final review also enforced a single active-or-retained journal lease during delayed release acknowledgement and removed the redundant canonical read from cold and invalid projection repair.

Three integration-scale regressions received test-local 20-second CI allowances after shared-runner execution crossed Bun’s 5-second default; no runtime or global timeout changed.
<!-- SECTION:FINAL_SUMMARY:END -->
