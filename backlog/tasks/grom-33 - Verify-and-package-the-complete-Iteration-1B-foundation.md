---
id: GROM-33
title: Verify and package the complete Iteration 1B foundation
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 20:58'
labels: []
milestone: m-2
dependencies:
  - GROM-21
  - GROM-23
  - GROM-32
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - DEVELOPMENT.md
modified_files:
  - DEVELOPMENT.md
  - package.json
  - scripts/verify-targets.ts
  - src/persistence/README.md
  - src/persistence/projection-index.ts
  - src/persistence/tests/projection-index.test.ts
  - tests/iteration-1b/verify-foundation.ts
  - tests/iteration-1b/verify-self-blueprint.ts
priority: high
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close Iteration 1B with black-box proof that the minimal capability runtime, configuration, public operations, bounded queries, deterministic export, recognition metadata, and canonical self-blueprint work together through the standalone distribution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clean checkout builds one standalone Groma executable and verifies bootstrap, configuration, public capability invocation, projection rebuild, bounded query, recognition metadata, and complete blueprint export through public surfaces
- [x] #2 The canonical self-blueprint is validated against the architecture entry point and remains byte-stable across restart, index rebuild, and read-only use
- [x] #3 Black-box cases cover malformed configuration, incompatible built-in capabilities, corrupt projection, stale cursors, and interrupted reads without unintended canonical changes
- [x] #4 The quality gate cross-compiles exact standalone artifacts for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 from one runner
- [x] #5 The host-compatible artifact runs the complete Iteration 1B workflow without a separately installed Bun runtime and documentation makes no unsupported native-runtime claim for other targets
- [x] #6 Iteration 2 scanning, evidence, binding, reconciliation, and visual navigation remain clearly identified as not yet delivered
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a production-binary-only Iteration 1B foundation verifier covering initialization, recognition metadata, public mutations and built-in capability-backed bounded reads, complete deterministic export, projection repair, malformed configuration, incompatible built-in requirements, stale cursors, interrupted reads, and canonical-byte preservation.
2. Strengthen the canonical self-blueprint verifier with explicit agreement between its nine root names and the ARCHITECTURE.md navigator while preserving restart, projection rebuild, and read-only byte-stability proof.
3. Add one verify:1b completion command, make the required quality gate use it, and extend the four-target verifier with target-aware executable-header checks plus the complete host-compatible Iteration 1B workflow.
4. Update DEVELOPMENT.md to describe the delivered Iteration 1B boundary and explicitly defer scanning, observation/evidence, binding, reconciliation, groma scan, and visual navigation without claiming unexecuted native support.
5. Run targeted black-box checks, the complete local quality gate, the cross-target gate, diff hygiene, and Backlog health; then finalize only after independent spec and quality reviews.
6. Add projection cold-load-only proven-dead coordination recovery after exact callback contention, with bounded release handling and focused crash/concurrency tests, while preserving the global callback stale-age policy and fail-fast rebuild/update behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context audit completed against the standalone compiler, binary smoke verifier, Iteration 1A and self-blueprint black-box suites, target matrix, CI workflow, configuration/runtime/projection tests, and DEVELOPMENT.md. No production or architecture change is required; the task can close through bounded verification and truthful documentation.

Implemented the production-binary-only Iteration 1B foundation verifier, explicit nine-root architecture agreement, the single verify:1b quality workflow, target-aware Mach-O/ELF/PE architecture validation, host-compatible full workflow execution, and truthful Iteration 1B/deferred Iteration 2 documentation. Targeted foundation and self-blueprint report-mode checks pass; bun run verify:1b, bun run check, and bun run check:targets pass on macOS arm64. The target matrix validated all four artifact headers and restored the native binary; git diff --check and Backlog doctor pass, and origin/main has no groma/ changes. Acceptance criteria and final task status remain intentionally untouched for independent finalization.

Addressed the mandatory spec-review finding in the self-blueprint verifier: ARCHITECTURE.md Canonical Orientation agreement now parses only the bounded table immediately following its exact introduction, validates the Root/Orientation header and separator plus nonempty row cells, rejects duplicate or over-limit rows, and compares the exact row count and order-insensitive root-name set with the independently validated canonical root contract. Global root-name substring checks were removed; the canonical groma/ link assertion remains. Normal and report self-blueprint verification, typecheck, and the full bun run check gate pass.

Addressed both mandatory quality-review findings in the Iteration 1B foundation verifier. The incompatible package fixture now distinguishes module evaluation from plugin start: untrusted enable leaves both sentinels absent, trusted enable records exactly one evaluation with no start, and ordinary host-bootstrap-failed startup records exactly two evaluations with no start, with assertions only after child exit and canonical snapshots unchanged. Subprocess execution now uses one bounded captured-process lifecycle that attaches exit and output observation immediately, installs lifetime cleanup before progress polling, preserves original failures, sends SIGTERM then bounded SIGKILL escalation, drains exit/stdout/stderr through Promise.allSettled, and cancels readers on the final settlement deadline. bun run verify:1b, bun run check (796 tests), bun run check:targets, git diff --check, canonical groma/ diff hygiene, and Backlog doctor all pass.

Finalization evidence at 3ec7bf9: bun run check passed 796/796 tests and the complete production-binary Iteration 1B workflow; bun run check:targets validated Mach-O arm64, ELF x86-64, PE x86-64, and PE arm64 artifacts and ran the host-compatible workflow before restoring the native artifact. Independent specification and quality reviews approved the cumulative diff after exact orientation-table, plugin evaluation-sentinel, and bounded child-lifecycle remediations. git diff --check and Backlog doctor pass; origin/main...HEAD contains no canonical groma/ change. The task remains In Progress until ready-PR CI, Claude, and Codex review gates complete.

Follow-up for GitHub Actions run 29605152959: both Linux Quality gates and Cross-platform binaries reached verifyInterruptedRead but exceeded the original 1,000ms SIGTERM grace under runner load, so the verifier correctly failed when SIGKILL was required; Windows native smoke passed. The verifier now keeps forced termination a failure while allowing a bounded 5,000ms SIGTERM grace and 10,000ms settlement deadline, eagerly observes the combined result rejection before delayed interruption wait() use without changing caller-visible rejection, polls progress every 10ms, and documents why the 79 canonical Markdown fixtures exist before immediate compiled-CLI validation. Three consecutive focused foundation runs, bun run check (796 tests), and bun run check:targets pass locally.

Ready-PR gate evidence on commit f7d78ee: GitHub Actions run 29606367136 passed Quality gates, Cross-platform binaries, and Native Windows binary. Claude approved after its actionable eager-rejection and Linux cancellation-grace feedback was implemented and independently re-reviewed; its remaining fault-injection suggestion was not adopted because it would replace shipped-artifact proof with the private Iteration 1A harness. Codex bot reacted +1 to PR #34 on the current head with no review comments or threads.

Reopened after GitHub Actions run 29606731908: Cross-platform binaries again exceeded the 5,000ms SIGTERM grace in verifyInterruptedRead and required SIGKILL. The repeated Linux result shows that graceful SIGTERM servicing during a synchronous cold rebuild is not a stable product contract; the task requires deterministic abrupt-interruption canonical safety and fresh-read recovery through the shipped binary. Acceptance criteria and the existing final summary remain unchanged pending implementation and review.

Implemented the deterministic abrupt-interruption proof after run 29606731908. Captured processes now expose an idempotent immediate SIGKILL path while generic failures and timeouts retain SIGTERM, bounded grace, SIGKILL escalation, settlement, and eager rejection observation. The cold target is a large production-binary export; manifest-last rebuild publication plus a second successful production-binary root read witnesses that projection/checkpoint coordination has released before immediate SIGKILL. The test requires an intentional force kill, nonzero exit, empty stderr, zero stdout bytes under the CLI atomic-output contract, exact canonical snapshot equality, and a complete fresh export recovery. Five consecutive focused foundation runs, bun run check (796 tests), and bun run check:targets pass locally.

Addressed the latest PR #34 Codex findings. The interrupted-export proof no longer depends on cache-manifest timing, a second unrelated CLI process, or a large-output duration window. Bun's subprocess maxBuffer boundary now sends SIGKILL when the exact shipped exporter crosses a one-byte stdout threshold; the verifier requires SIGKILL, nonzero exit, exporter-owned output beyond the threshold, clean stderr, exact canonical bytes, and a complete fresh export recovery. This supersedes the prior note's unsupported zero-stdout/atomic-output claim: process.stdout.write and OS buffering may expose either a prefix or a complete buffered document before signal termination, and response completeness is not used as proof. The target verifier now records whether a matching artifact completed all runtime workflows and reports cross-compilation-only on unsupported hosts; DEVELOPMENT.md documents that truthful branch. Five consecutive focused foundation runs, bun run check (796 tests), and bun run check:targets pass locally.

A true in-progress SIGKILL during projection-index staging exposed a production recovery defect: cold `load()` used callback coordination with the ordinary five-minute stale-age threshold, so a provably dead publisher prevented immediate reconstruction even though explicit leases already provide double-proven-dead recovery. Alex explicitly authorized expanding GROM-33 to include the narrow production fix in the existing PR. Scope is limited to an exact-contention fallback for disposable projection load; global callback coordination, canonical state, rebuild/update fail-fast behavior, and scanner/architecture boundaries remain unchanged.

PR #34 review superseded the maxBuffer-as-read-interruption proof: exact hash-and-PID projection-stage SIGKILL evidence demonstrated a true in-progress cold rebuild, but also exposed that the default five-minute callback stale-age policy (24-hour configured ceiling) prevents immediate same-workspace recovery after the exporter dies while holding projection coordination. Alex explicitly authorized expanding GROM-33 to add a narrow projection load-only proven-dead recovery fallback after exact contention; the global withCoordination policy and its stale-age behavior remain unchanged.

Implemented the authorized projection load-only recovery and the final PR #34 verification gaps. The production-binary foundation verifier now arms an exact cache watcher before spawning, identifies the projection-index stage by full locator hash and exporter PID, kills the exact shipped process immediately with SIGKILL, proves the surviving regular stage and both unpublished manifests, preserves canonical bytes, and requires the complete recovered export to equal the primed export. Cold load alone follows exact callback contention with one same-locator explicit acquisition so double-proven-dead publishers recover immediately; live or ambiguous ownership remains contended, action runs at most once, release is bounded and fail-closed, and rebuild/update stay callback-only. Target verification now validates executable image kinds and structural bounds for the actual Mach-O arm64, ELF64 x86-64, PE32+ x64, and PE32+ arm64 artifacts. Focused projection tests pass 47/47; six focused production-binary foundation runs (one after target-matrix native restoration plus five consecutive repetitions), bun run check (800 tests and the complete verify:1b path), and bun run check:targets all pass. Formatting, typecheck, architecture boundaries, git diff --check, and Backlog doctor pass. Task status, acceptance criteria, and the existing final summary remain intentionally unchanged pending ready-PR review gates.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Packaged the complete Iteration 1B foundation as one clean-checkout verification path. The production-binary verifier now proves configuration, public capability-backed operations, recognition metadata, bounded deterministic export, projection repair, and fail-closed negative cases without unintended canonical changes; the self-blueprint verifier enforces exact architectural orientation and byte stability; and the target matrix validates exact Mach-O, ELF, and PE architectures while executing the full workflow only on the host-compatible artifact. DEVELOPMENT.md now states the delivered boundary and explicitly defers Iteration 2 scanning, evidence, binding, reconciliation, groma scan, and visual navigation. Verified by bun run check (796 tests), bun run check:targets, independent spec and quality reviews, green GitHub Actions run 29606367136, Claude approval, and Codex +1 on PR #34.
<!-- SECTION:FINAL_SUMMARY:END -->
