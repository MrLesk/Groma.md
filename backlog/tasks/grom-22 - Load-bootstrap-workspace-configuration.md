---
id: GROM-22
title: Load bootstrap workspace configuration
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 03:28'
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
1. Extend the internal Core runtime with a lifecycle-safe Phase 0 staging/continuation path that reuses already-started bootstrap providers when the Phase 1 registration set becomes known.
2. Add bounded typed Host bootstrap configuration contracts plus replaceable resource, configuration-discovery, and configuration-parser Phase 0 providers, including deterministic local target conventions and distinct fail-closed diagnostics.
3. Recompose the official local profile in two stages, parse the documented legacy-compatible YAML configuration, retain the required built-in profile, add requested Host-owned official registrations, and reject project-provided requests before any code-loading seam executes.
4. Inject the selected configuration parser/locator into local workspace compatibility checks so initialization, recovery, and extended configuration use one replaceable semantic path.
5. Add focused Core and Host tests/docs for staging lifecycle, provider ambiguity, missing/conflicting/malformed configuration, all supported OS/architecture conventions, requested plugin selection, and the trust/package execution fence; then run focused and full project gates and finalize the task with objective AC evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the internal Phase 0 staging/continuation lifecycle with exact provider reuse, one-shot continuation, dependency-safe rollback, and staged cleanup on discovery/parsing failure. Added typed bounded bootstrap discovery/parser/configuration contracts, legacy-compatible YAML with optional deterministic plugin requests, portable macOS/Linux/Windows target conventions, and injected parser/locator compatibility for LocalWorkspace. The official Host now resolves three replaceable Phase 0 capabilities, selects requested Host-owned official registrations, and returns stable distinct missing/conflict/malformed/ambiguity diagnostics while rejecting project requests before registration inspection or execution. Focused Core/Host/CLI suites and TypeScript/boundary checks pass; full validation is in progress.

Objective acceptance evidence: Core staged-runtime tests prove exact Phase 0 reuse, one-shot continuation, and dependency-safe rollback. Host bootstrap tests prove typed legacy/extended configuration, missing/conflicting/malformed/ambiguous outcomes, requested official plugin startup, zero project manifest reads/starts, and cleanup on parser failure. Pure convention tests cover Darwin arm64, Linux x64, Windows x64, and Windows arm64; check:targets cross-compiled all four promised executables. Full bun run check passed format, strict TypeScript, boundaries, 494 tests / 3,258 assertions, native build/smoke, and compiled Iteration 1A recovery. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the two-stage local bootstrap path: Core can stage Phase 0 once and continue a configuration-selected Phase 1 graph; Host now composes replaceable resource/discovery/parser capabilities, parses a bounded legacy-compatible groma/v0.1 YAML document, selects host-owned requested plugins, injects parser compatibility into workspace recovery, and fails closed with contained diagnostics before project code can execute. Verified by focused staging/bootstrap/CLI tests, the complete 494-test project gate, all four standalone compilation targets, diff checks, and Backlog validation.
<!-- SECTION:FINAL_SUMMARY:END -->
