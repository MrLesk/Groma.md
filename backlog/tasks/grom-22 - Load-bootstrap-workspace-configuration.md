---
id: GROM-22
title: Load bootstrap workspace configuration
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 04:14'
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
1. Preserve the accepted Phase 0 staging, canonical revalidation, and proof-based drift/infrastructure diagnostics.
2. Rename inferred plugin `source` to lexical `namespace`, and rename the asymmetric comparison to `bootstrapConfigurationStillUsable`; nominally brand staged graphs if it remains behavior-neutral.
3. Document `plugins` as a reserved Host-profile selection field: shipped CLI has no optional contributions, required built-ins run regardless and repeated IDs are redundant, project IDs remain unsupported pending package/trust validation.
4. Allow x64/arm64 source path conventions on Darwin and Linux without expanding artifact claims; preserve `unsupported-bootstrap-target` through Host lifecycle and CLI for unsupported runtime tuples while keeping relative roots as invalid process context.
5. Separate unsupported user project requests from invalid non-official Host-supplied registrations with distinct contained workspace and infrastructure diagnostics.
6. Add focused parser/selection/platform/Host/lifecycle/CLI regressions, polish Host docs, run full validation, re-audit AC2-AC5, and create one separate Claude-followup commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the two-stage bootstrap boundary with replaceable Phase 0 resource, discovery, and parser capabilities; exact canonical revalidation; proof-based drift versus infrastructure diagnostics; reentrant-safe staging; and deterministic cleanup. Requested plugin IDs now carry the honest lexical `namespace` field, and the directional comparison is named `bootstrapConfigurationStillUsable`. Staged plugin graphs are nominally distinct from complete running graphs without runtime behavior changes.

The documented `plugins` field is now honest: it is reserved for Host-profile selection, the shipped CLI has no optional official contributions, required built-ins run regardless and listing them is a redundant no-op, Host embedders may inject prevalidated official registrations, and project IDs are unsupported in this release pending GROM-24 package/trust validation. User project requests retain `project-plugin-validation-required`; invalid non-official Host registrations use the distinct contained `host-runtime-registration-invalid` infrastructure diagnostic.

Source path conventions support x64 and arm64 on Darwin, Linux, and Windows because architecture does not affect path syntax. Unsupported runtime tuples preserve `unsupported-bootstrap-target` through compose, lifecycle, and CLI as infrastructure failures; relative roots remain `invalid-host-process-context`. Artifact claims remain exactly the four verified targets.

Objective evidence: focused TypeScript, architecture-boundary, Core/Host/lifecycle/CLI suites passed 110 tests / 712 assertions, covering Intel macOS and Linux arm64 conventions, redundant built-in selection, user-versus-embedder diagnostics, unsupported target containment, and existing drift/provider cleanup paths. Full bun run check passed formatting, strict TypeScript, boundaries, 510 tests / 3,354 assertions, native build/smoke, and Iteration 1A crash recovery. bun run check:targets verified only the promised Darwin arm64, Linux x64, Windows x64, and Windows arm64 artifacts. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed GROM-22 with an honest reserved plugin-selection schema, lexical/directional API names, portable Darwin/Linux/Windows source conventions, actionable unsupported-target handling, and distinct user project versus Host registration diagnostics. The accepted fail-closed revalidation and cleanup behavior remains intact. Verified with 510 tests / 3,354 assertions, four promised artifact builds, binary smoke/recovery, boundary checks, diff checks, and Backlog validation.
<!-- SECTION:FINAL_SUMMARY:END -->
