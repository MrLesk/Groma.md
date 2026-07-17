---
id: GROM-31
title: Permit concurrent read-only workspace access
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 11:31'
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
1. Replace the finite adoption-only cold-projection follower with one iterative cancellation-aware load loop: safely check cancellation, attempt exact read-only adoption, run one existing coordinated load attempt, return every success or non-sole-contention result, and retry sole contention after capped 20-to-500-millisecond exponential waits without an elapsed-time cap.
2. Add an optional Persistence-local projection cancellation predicate and wire the official Host bootstrap from pluginContext.cancellation.isCancellationRequested without changing Core projection capability contracts.
3. Add deterministic regressions for cancellation, progress beyond the former small-bound window, adoption before reacquisition, a failed winner followed by waiter repair, mixed diagnostics, and multiple readers with byte-identical canonical state.
4. Replace stale finite-follower and never-reacquire documentation in Persistence and Architecture, run focused projection and Host tests plus typecheck/diff checks, and obtain independent review before handoff.
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

Latest P1 remediation design: no finite timeout can distinguish healthy supported-scale publication from a stuck live lease, so cold loads retry until success, a terminal non-contention result, or optional caller cancellation. Every retry performs adoption before coordination; a waiter that acquires runs the existing repair/publication action and may write only disposable projection state. Only an exact sole resource-coordination-contended diagnostic authorizes another iteration. Backoff starts at 20 ms and caps at 500 ms. Official bootstrap supplies plugin cancellation locally; Core capability shape remains unchanged. Direct local callers without cancellation can wait indefinitely under permanent exact contention. Deterministic testing gates the eighth post-contention read beyond the former small-bound window, covers adoption-before-reacquire, terminal and mixed failures, waiter repair after winner release, and canonical byte/generation immutability.

Implemented the P1 projection liveness remediation. Local projection load now checks a snapshotted optional cancellation predicate safely, attempts exact read-only adoption before every coordination attempt, retries only a sole contention diagnostic with uncapped 20-to-500-millisecond exponential waits, and lets a waiter that acquires run the existing disposable repair/publication action. Default Host bootstrap supplies plugin-context cancellation without changing Core. Deterministic coverage proves adoption after the former small-bound window without reacquisition, cancellation and predicate containment, terminal and mixed failure stopping, repair after a failed winner with only cache writes, eight-waiter success with canonical sentinel bytes unchanged, and Host cancellation wiring. Focused projection plus default-Host verification passed 55 tests and 441 expectations; typecheck, formatting, and git diff check passed.

Closed final independent-review gaps. A projection-level integration now runs behind the real coordination child, kills and awaits the owner, uses a one-millisecond stale policy, and proves the iterative loader safely reaps, reacquires, repairs malformed disposable state, stages only .groma-cache resources, and preserves exact canonical sentinel bytes plus generation. The Final Summary now describes uncapped cancellation-aware retry and waiter repair instead of the obsolete bounded read-only follower. Refreshed focused verification passed 56 tests and 448 expectations; typecheck, formatting, and git diff check remain green.

Final exact-tree verification after the cancellation-aware liveness remediation passed bun run check: formatting, type checking, architecture boundaries, 796 tests across 37 files with 5,679 expectations, the compiled Iteration 1A cache-cold eight-reader workflow, and crash recovery. bun run check:targets passed macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 executables. The focused projection and Host suites passed 56 tests with 448 expectations, the real dead-owner regression passed, two independent reviews approved, and git diff --check was clean.

Final Claude review reported no concurrency correctness bug. Independent audits accepted three small clarity/simplicity corrections: qualify the package-state no-lease statement to read-only startup because enablement intentionally retains its exclusive mutation lease through selected-entry evaluation; describe projection retry for any load that cannot complete the full adoption fence, including present-but-unadoptable state; and remove the post-wait cancellation observation duplicated by the next iteration before any I/O. The checkpoint double observation remains a conservative provider-neutral interleaving fence, canonical reload after coordination preserves same-generation freshness under the public provider contract, and startup/mutation comparison helpers remain separate because their coordination ownership differs.

After the three accepted Claude follow-ups, focused projection and Host verification passed 56 tests and 448 expectations; bun run check again passed formatting, type checking, architecture boundaries, all 796 tests with 5,679 expectations, compiled binary smoke, the cache-cold eight-reader workflow, and crash recovery; git diff --check was clean. The other three Claude observations were independently rejected as non-actionable for this task: the double checkpoint read conservatively detects provider-level interleaving, a fresh post-coordination canonical read preserves same-generation fingerprint freshness, and separate startup/mutation helpers keep distinct lease ownership explicit.
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

author: @codex
created: 2026-07-17 10:43
---
Reopened after exact-head Codex review found the configured ten-second projection follower cap can still expire during a healthy supported-scale publication. Replacing timeout failure with safe progress tracking or coordination retry before merge.
---

author: @codex
created: 2026-07-17 11:12
---
Exact-tree remediation passed 796 tests and 5,679 expectations, the compiled cold-reader and crash-recovery workflow, all four target builds, focused concurrency verification, and two independent reviews. Ready for final PR head review.
---

author: @codex
created: 2026-07-17 11:30
---
Reopened for three independently validated Claude follow-ups: scope package lease documentation to read-only startup, describe retry for every unadoptable projection rather than only cold cache, and remove one cancellation observation duplicated immediately by the next loop guard.
---

author: @codex
created: 2026-07-17 11:31
---
Claude feedback was independently evaluated: three documentation/simplicity improvements were applied, three intentional safety/ownership choices remain. The amended exact tree is green and ready for final hosted/Codex review.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Permits independent CLI processes to inspect one initialized workspace concurrently through canonical and projection-backed reads without recovery, package-state, or graph-query failures. Stable-idle transaction and checkpoint reads remain optimistic, and package startup uses brief coherent observations outside plugin execution. A projection load that cannot complete read-only adoption uses cancellation-aware adoption-before-coordination retry with 20-to-500-millisecond capped backoff and no elapsed-time timeout; a waiter that acquires may exclusively repair and publish only disposable projection state. Exact contention, cancellation, mixed failures, normal and dead-owner repair, eight-waiter adoption, Host cancellation wiring, and byte-identical canonical state are covered without changing Core capability contracts. Verified by 796 tests and 5,679 expectations, compiled crash/cold-reader workflows, all four executable targets, focused concurrency suites, independent reviews, and evaluated Claude feedback.
<!-- SECTION:FINAL_SUMMARY:END -->

<!-- SECTION:NOTES:END -->
