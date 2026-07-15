---
id: GROM-24
title: Manage and pin local plugin packages
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 07:06'
labels: []
milestone: m-4
dependencies:
  - GROM-22
  - GROM-23
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - backlog/tasks/grom-24 - Manage-and-pin-local-plugin-packages.md
  - scripts/architecture-boundaries.ts
  - scripts/standalone-compiler.ts
  - scripts/tests/architecture-boundaries.test.ts
  - scripts/verify-binary.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/program.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/surface.test.ts
  - src/core/plugin-runtime.ts
  - src/host/README.md
  - src/host/bootstrap-configuration.ts
  - src/host/contracts.ts
  - src/host/default-bootstrap.ts
  - src/host/index.ts
  - src/host/lifecycle.ts
  - src/host/local-plugin-packages.ts
  - src/host/plugin-module-loader.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/local-plugin-packages.test.ts
  - src/plugin-sdk/README.md
priority: medium
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support reproducible local plugin packages for the initial package-management delivery while keeping package installation, plugin enablement, runtime loading, and project package management separate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A local package containing one or more plugins can be added, inspected, selectively enabled, disabled, and removed through supported Groma operations
- [x] #2 Blueprint-affecting plugins are declared in canonical configuration and resolved through deterministic exact lock entries
- [x] #3 Personal presentation-only plugins remain local and cannot silently change shared blueprint meaning
- [x] #4 Groma requires explicit trust before executing project-provided plugin code and clearly states that plugins run with the user permissions
- [x] #5 Package operations never modify package-manager files belonging to an observed project
- [x] #6 Remote acquisition remains explicitly out of scope for this delivery
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the bounded workspace configuration model with exact sorted blueprint package declarations, deterministic serialization, and semantic revalidation while preserving the reserved official plugin selector.
2. Add a Host-owned local package capability with exact six-field groma.package.json parsing, remote-source rejection before filesystem access, safe path/byte hashing, canonical lock/user-state formats, and serialized add/inspect/enable/disable/remove operations.
3. Require the explicit --trust-full-user-permissions grant before dynamic import; bind persisted grants outside the repository to canonical workspace and package locations plus manifest/entry integrity, and enforce the one-registration plugin export.
4. Load only trusted, exact locked enabled entries during Phase 1; constrain personal registrations to the groma.presentation.* capability namespace and keep blueprint packages canonical while personal package state remains outside the repository.
5. Expose the capability through contained Host surface context and the complete CLI package command family, including stable remote-out-of-scope, trust, drift, and workspace diagnostics.
6. Update architecture/Host/CLI/SDK documentation to replace the earlier package CLI sketch and state the local-path reproducibility and locked-byte boundary honestly.
7. Add focused parser, package manager, bootstrap/lifecycle, and CLI end-to-end regressions proving multi-plugin selective enablement, trust-before-import, personal isolation, deterministic config/locks, drift rejection, no observed package-manager writes, and remote rejection before filesystem work.
8. Run formatting, strict typecheck, boundaries, focused suites, full bun run check, diff/backlog validation, then finalize GROM-24 with objective evidence and commit only this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context review classified this as L2: package operations cross the CLI, contained Host surface, Phase 0 configuration, Phase 1 runtime, and local persistence. The accepted design keeps acquisition, declaration, enablement, trust, and loading separate; supports local filesystem paths only; and introduces the minimum one-registration plugin entry export plus groma.presentation.* personal capability namespace.

Final design adds a management-only Host composition for package commands: add and inspect never load existing enabled code, inspect reports exact manifest or enabled-entry drift inertly, and disable/remove remain available for recovery. Ordinary startup verifies exact lock and trust before the single audited runtime import. State writes are byte-preflighted; lock-first blueprint publication can be reconciled by disable/remove after an interrupted configuration write. The standalone compiler permits only the opaque runtime specifier while the architecture checker constrains that import to host/plugin-module-loader.ts.

Objective validation: bun run check passed (format, strict typecheck, architecture boundaries, 526 tests / 0 failures, native compiled-binary smoke, and Iteration 1A workflow/crash recovery). bun run check:targets passed for macOS arm64, Linux x64, Windows x64, and Windows arm64. The compiled smoke exercised init/add/trust/enable/fresh-process inspect/ordinary startup and proved inspect did not evaluate enabled code. Focused package tests prove multi-entry selective enablement, exact config/lock bytes, personal capability isolation, trust-before-import, drift-before-import, remote rejection, unchanged project package.json/bun.lock, and recovery from lock-first partial writes without source availability.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the complete local-path plugin package lifecycle across bounded configuration, exact locks, external trust state, Host composition, and CLI operations. Blueprint packages are deterministic and shared; personal packages remain presentation-only and local; remote acquisition is explicitly rejected; package-manager files remain untouched. Verified through the full repository and four-target compiled-binary gates.
<!-- SECTION:FINAL_SUMMARY:END -->
