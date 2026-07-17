---
id: GROM-33
title: Verify and package the complete Iteration 1B foundation
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 18:12'
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
- [ ] #1 A clean checkout builds one standalone Groma executable and verifies bootstrap, configuration, public capability invocation, projection rebuild, bounded query, recognition metadata, and complete blueprint export through public surfaces
- [ ] #2 The canonical self-blueprint is validated against the architecture entry point and remains byte-stable across restart, index rebuild, and read-only use
- [ ] #3 Black-box cases cover malformed configuration, incompatible built-in capabilities, corrupt projection, stale cursors, and interrupted reads without unintended canonical changes
- [ ] #4 The quality gate cross-compiles exact standalone artifacts for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 from one runner
- [ ] #5 The host-compatible artifact runs the complete Iteration 1B workflow without a separately installed Bun runtime and documentation makes no unsupported native-runtime claim for other targets
- [ ] #6 Iteration 2 scanning, evidence, binding, reconciliation, and visual navigation remain clearly identified as not yet delivered
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a production-binary-only Iteration 1B foundation verifier covering initialization, recognition metadata, public mutations and built-in capability-backed bounded reads, complete deterministic export, projection repair, malformed configuration, incompatible built-in requirements, stale cursors, interrupted reads, and canonical-byte preservation.
2. Strengthen the canonical self-blueprint verifier with explicit agreement between its nine root names and the ARCHITECTURE.md navigator while preserving restart, projection rebuild, and read-only byte-stability proof.
3. Add one verify:1b completion command, make the required quality gate use it, and extend the four-target verifier with target-aware executable-header checks plus the complete host-compatible Iteration 1B workflow.
4. Update DEVELOPMENT.md to describe the delivered Iteration 1B boundary and explicitly defer scanning, observation/evidence, binding, reconciliation, groma scan, and visual navigation without claiming unexecuted native support.
5. Run targeted black-box checks, the complete local quality gate, the cross-target gate, diff hygiene, and Backlog health; then finalize only after independent spec and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context audit completed against the standalone compiler, binary smoke verifier, Iteration 1A and self-blueprint black-box suites, target matrix, CI workflow, configuration/runtime/projection tests, and DEVELOPMENT.md. No production or architecture change is required; the task can close through bounded verification and truthful documentation.

Implemented the production-binary-only Iteration 1B foundation verifier, explicit nine-root architecture agreement, the single verify:1b quality workflow, target-aware Mach-O/ELF/PE architecture validation, host-compatible full workflow execution, and truthful Iteration 1B/deferred Iteration 2 documentation. Targeted foundation and self-blueprint report-mode checks pass; bun run verify:1b, bun run check, and bun run check:targets pass on macOS arm64. The target matrix validated all four artifact headers and restored the native binary; git diff --check and Backlog doctor pass, and origin/main has no groma/ changes. Acceptance criteria and final task status remain intentionally untouched for independent finalization.

Addressed the mandatory spec-review finding in the self-blueprint verifier: ARCHITECTURE.md Canonical Orientation agreement now parses only the bounded table immediately following its exact introduction, validates the Root/Orientation header and separator plus nonempty row cells, rejects duplicate or over-limit rows, and compares the exact row count and order-insensitive root-name set with the independently validated canonical root contract. Global root-name substring checks were removed; the canonical groma/ link assertion remains. Normal and report self-blueprint verification, typecheck, and the full bun run check gate pass.
<!-- SECTION:NOTES:END -->
