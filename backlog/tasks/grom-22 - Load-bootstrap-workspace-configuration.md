---
id: GROM-22
title: Load bootstrap workspace configuration
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 03:57'
labels: []
milestone: m-2
dependencies:
  - GROM-21
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - backlog/tasks/grom-22 - Load-bootstrap-workspace-configuration.md
  - src/cli/program.ts
  - src/cli/tests/program.test.ts
  - src/core/README.md
  - src/core/plugin-runtime.ts
  - src/core/tests/plugin-runtime.test.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/index.ts
  - src/host/lifecycle.ts
  - src/host/local-workspace.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let the official host discover a workspace and select runtime plugins before the full plugin graph exists, while keeping local filesystem and configuration-format assumptions replaceable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Phase 0 resolves replaceable resource, configuration-discovery, and configuration-parser capabilities into a typed workspace locator and base configuration
- [x] #2 The official local profile loads the documented workspace configuration and requested runtime plugins without embedding its resource or parser technology in Core
- [x] #3 Missing workspace, conflicting discovery results, malformed configuration, and ambiguous bootstrap providers produce distinct actionable diagnostics
- [x] #4 Configuration discovery is deterministic across supported macOS, Linux, Windows x64, and Windows ARM64 path conventions
- [x] #5 No project-provided runtime plugin executes before its configured package and trust requirements have been validated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make Phase 0 staging reentrant-safe by reserving continuation before Phase 1 callbacks and rejecting staged cleanup during continuation without self-await.
2. Canonicalize bootstrap parser outputs once, compare exact typed workspace state and sorted plugin requests at the pre-continuation and LocalWorkspace boundaries, and fail closed with deterministic cleanup when configuration changes.
3. Map duplicate built-in Phase 0 registrations to the bootstrap ambiguity diagnostic while keeping unrelated resolution faults generic.
4. Enforce the documented YAML anchor, alias, and explicit-tag policy using AST visitation and add interleaving, project-execution, cleanup, reentrancy, and duplicate-provider regressions.
5. Separate transient revalidation and workspace-provider failures from proven semantic drift, preserving cleanup precedence and canonical Host/CLI classification.
6. Run focused and full validation, re-audit every acceptance criterion, reconcile task notes, and create a separate correction commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a two-stage bootstrap boundary with replaceable Phase 0 resource, configuration-discovery, and configuration-parser capabilities. Bootstrap parser results are exact-validated into one canonical schema and sorted (id, source) request set. The Host re-reads that canonical state immediately before continuation, rejects only successful non-equivalent snapshots as workspace-configuration-changed, and propagates contained discovery/parser/configuration failures from failed revalidation. LocalWorkspace repeats the semantic comparison after continuation: exact configuration conflicts prove drift, while exact workspace access failures remain workspace-configuration-provider-failure. Every failure path cleans its started graph exactly once, with host-plugin-cleanup-failed retaining precedence. Missing-to-empty peer initialization remains compatible; configured-to-missing, alpha-to-beta, and official-to-project changes fail closed. Staged shutdown/cancellation rejects reentrant cleanup while continuation owns Phase 0, duplicate built-in Phase 0 IDs map to bootstrap ambiguity before start, and YAML anchors, aliases, and explicit tags are rejected.

Objective evidence: focused TypeScript, boundary, Host lifecycle/bootstrap, and CLI validation passed, including read #2 and read #3 transient-failure integration, infrastructure exit classification, exact-once cleanup, malformed revalidation, proven drift, and cleanup precedence. Full bun run check passed formatting, strict TypeScript, boundaries, 505 tests / 3,337 assertions, native build/smoke, and Iteration 1A crash recovery. bun run check:targets verified Darwin arm64, Linux x64, Windows x64, and Windows arm64 standalone targets. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the fail-closed two-stage local bootstrap path with proof-based diagnostics: only successful unequal canonical snapshots become configuration drift, while transient revalidation and post-continuation access failures retain canonical infrastructure diagnostics through Host lifecycle and CLI. Exact-once cleanup and cleanup-failure precedence are covered. Verified with 505 tests / 3,337 assertions, all four target builds, binary smoke/recovery, boundary checks, diff checks, and Backlog validation.
<!-- SECTION:FINAL_SUMMARY:END -->
