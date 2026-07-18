---
id: GROM-39
title: Execute blind scanner plugins
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-18 20:00'
labels: []
milestone: m-3
dependencies:
  - GROM-21
  - GROM-35
  - GROM-36
  - GROM-38
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
documentation:
  - ARCHITECTURE.md
  - src/host/README.md
  - src/persistence/README.md
modified_files:
  - ARCHITECTURE.md
  - src/cli/tests/surface.test.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/index.ts
  - src/host/lifecycle.ts
  - src/host/scanner-project-resources.ts
  - src/host/scanner-runtime.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/scanner-project-resources.test.ts
  - src/host/tests/scanner-runtime.test.ts
  - src/persistence/README.md
  - src/persistence/local-resource-provider.ts
  - src/persistence/tests/local-resource-provider.test.ts
  - tests/scanner-runtime-integration.test.ts
priority: high
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run scanner plugins as finite, cancellable, scoped observation sessions while enforcing scanner blindness, lifecycle fencing, progress reporting, and safe failure semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The runtime starts enabled scanner capabilities with only their registered project resources, scanner configuration, declared scope, observation sink, and cancellation signal
- [x] #2 Scanner execution maintains heartbeats, fences stale epochs, validates emitted scope, and exposes bounded progress and final status
- [x] #3 A scanner process or plugin cannot receive the current blueprint, curated intent, bindings, aliases, or prior reconciliation results through the supported capability
- [x] #4 Only a validated complete session is handed to reconciliation; cancellation, crash, timeout, and plugin failure preserve the prior committed architecture
- [x] #5 Concurrent sessions for independent projects or sources remain isolated while conflicting sessions for one source and scope fail or supersede deterministically
- [x] #6 Lifecycle and conformance tests cover in-process built-in scanners and the public third-party scanner capability
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a project-rooted scanner resource view by creating a confined LocalResourceProvider at the captured registration source, with provider-level top-level exclusions for root-project groma, .groma-cache, and .git state; reserve all three aggregate roots in project registration, preserve nested project-owned directories, and expose only bounded read/enumerate authority with project-relative cursors and locators.
2. Add a Host-owned scanner runtime that snapshots the started groma.scanners/v1 catalog, matches each configured scanner ID to exactly one plugin provider/version, validates the enabled project registration and availability, creates one opaque epoch per project/scanner lane, and exposes bounded start/progress/final/recovery operations without adding optional Core plugin dependencies or a dummy scanner.
3. Bridge the synchronous public observation sink to the asynchronous durable journal with one Core shadow session and a FIFO of exact Core-owned checkpoint transitions. Fence same-lane conflicts, stale epochs, retained calls, project-revision drift, cancellation, heartbeat inactivity, hard duration, malformed scanner results, and durable failures; defer durable completion until scanner.scan returns an exact successful void Result.
4. Deliver only replay-validated completed journal handoffs through one injected idempotent observation-consumer seam. Acknowledge and clean up only after consumer success; recover and redeliver pending handoffs while abandoned or acknowledged lanes are cleaned deterministically. Quarantine only an interrupted lane until its unsettled Host operation resolves, then refresh recovery without resuming the interrupted pipeline. Do not implement GROM-41 reconciliation or any canonical mutation path.
5. Compose the empty-safe scanner runtime in the default Host from the already-started plugin graph, project registry, observation journal, project-provider factory, and process cancellation; expose only its contained operations to the Host surface so GROM-40 can add an official scanner and GROM-43 can add CLI orchestration through the same capability path.
6. Add adversarial resource, lifecycle, timeout, concurrency, recovery, blindness, built-in-shaped, and public third-party capability tests; update Host/Persistence/architecture documentation, run focused suites, full repository and four-target gates, and obtain independent specification and quality reviews before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 cross-module lifecycle and authority boundary. Two independent read-only reviews converged on reusing Core ObservationSession, createScannerRequest, LocalObservationJournal, RunningPluginGraph, ProjectRegistrationOperations, and LocalResourceProvider without changing the public scanner contract or implementing reconciliation. The synchronous SDK sink requires a shadow Core session plus a FIFO durable queue; durable completion is withheld until scanner.scan itself succeeds. Scanner blindness also requires aggregate-root .groma-cache filtering because it contains reconstructable current projection state, in addition to the already reserved canonical groma subtree.

Implementation complete. The Host now rejects requirement-bearing scanner providers before plugin start, creates a project-confined read/enumerate view that hides aggregate groma, .groma-cache, and .git state, and executes enabled scanners through finite durable observation lanes. Scanner authority closes at plugin settlement; heartbeat timing closes with that authority while the hard deadline remains authoritative through drain, revision validation, handoff, consumption, acknowledgement, and cleanup. Interrupted unsettled Host work returns a bounded terminal report, quarantines only its lane, never resumes the interrupted pipeline, and schedules fresh recovery after settlement; independent lanes continue. The default Host intentionally fails closed at the GROM-41 consumer seam and retains completed handoffs without canonical mutation.

Objective verification on the final head: 291 cross-module focused tests and 105 post-review runtime/lifecycle/integration tests passed; bun run check passed formatting, TypeScript, architecture boundaries, 1,022 tests / 7,518 assertions, build, smoke, Iteration 1A/1B, and self-blueprint verification (43 components, 9 roots, 398 embedded items, 87 declarations, 104 edges); bun run check:targets verified native macOS, Linux x64, Windows x64, and Windows arm64 standalone artifacts. Independent specification and quality reviewers both returned READY with no actionable findings. The pre-session pending-admission residual is explicitly non-blocking for GROM-39 because no scanner authority or session exists and every late path rechecks shutdown before scanner invocation.

Claude reviewed PR #40 and approved it with no blocking findings. Its relevant forward-looking feedback was applied by documenting the CompletedObservationConsumer at-least-once delivery contract and explicit idempotency requirement for GROM-41. The suggested shared exclusion constant was not adopted because the duplication is tiny and centralizing it would create avoidable module coupling; the late-sink concern is already fenced by createScannerRequest cancellation authority and retained-call tests. Post-comment verification passed 20 runtime/public-integration tests, TypeScript, formatting, and diff checks.

Codex exact-head review on PR #40 identified two actionable P2 findings, both independently confirmed and fixed. Full recovery now serializes unknown ownership and pending same-lane recovery work against targeted starts while permitting clean independent lanes only after recovery truth is known; held recover, delivery, acknowledgement, and cleanup tests prove exactly-once in-process handoff ownership. Scanner lifecycle cleanup now accepts only exact bounded terminal execution reports, rejects running or incoherent reports, and recursively contains nested rejected native Promises without leaking secrets or causing unhandled rejections. Independent post-fix quality review returned READY. Final post-review verification passed bun run check with formatting, TypeScript, architecture boundaries, 1,025 tests / 7,548 assertions, build, smoke, Iteration 1A/1B, and self-blueprint verification; bun run check:targets verified all four standalone targets.

PR #40 merged to main as ef5568828618a2af430f4a5f328a6ef9e6afdb42 after all three CI jobs passed and Codex completed an exact-head review of 45116eb3f7 with no major issues. The two earlier P2 findings were confirmed, fixed, regression-tested, and accepted by the subsequent review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented blind, finite, cancellable scanner execution through confined project resources, durable observation journaling, lane-scoped recovery, bounded lifecycle status, and an idempotent completed-observation handoff seam without canonical mutation. Verified all six acceptance criteria with public third-party and built-in-shaped integration, adversarial runtime/resource/lifecycle coverage, 1,025 repository tests / 7,548 assertions, compiled workflows, four standalone targets, independent READY review, Claude review, green CI, and Codex exact-head acceptance; merged in PR #40.
<!-- SECTION:FINAL_SUMMARY:END -->
