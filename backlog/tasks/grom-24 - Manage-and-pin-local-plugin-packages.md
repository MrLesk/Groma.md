---
id: GROM-24
title: Manage and pin local plugin packages
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 08:03'
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
  - src/host/path-containment.ts
  - src/host/plugin-module-loader.ts
  - src/host/tests/bootstrap-configuration.test.ts
  - src/host/tests/default-bootstrap.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/local-plugin-packages.test.ts
  - src/host/tests/path-containment.test.ts
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
1. Keep canonical configuration, lock, and user-state writers symmetric with bounded readers and preserve exact prior bytes on invalid inputs.
2. Keep package file materialization bound to no-follow stable handle snapshots and platform-aware containment.
3. Keep executable evaluation bound to captured verified bytes through an immutable in-memory module with the documented self-contained entry contract.
4. Keep POSIX trust roots owner-controlled, real, and mode-private; bind and prune exact grants by stable scope and package identity.
5. Keep blueprint configuration and lock publication compare-and-swap coordinated while preserving lock-first recovery.
6. Keep remote shorthand rejection, adversarial filesystem regressions, and four-target compilation coverage.
7. Add an explicit Host platform input and fail closed for persisted trust and local plugin execution on Windows until a bounded owner/ACL attestor exists; preserve fresh Windows startup without local plugin state.
8. Add a deterministic platform-injected regression proving an existing exact grant under an unattested Windows root cannot authorize import, plus stable lifecycle diagnostics and honest architecture/Host/CLI documentation.
9. Record the exact modified-file set including the Backlog task itself; run focused tests, bun run check, bun run check:targets, backlog doctor, and diff review before returning the task to Done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Independent review hardening pass reopened GROM-24 at 4de1b51d7697ff90978463935146b7d16bdf5e45. Context Hunter classification remains L2 because canonical state, filesystem identity, trust, module execution, cross-platform paths, and lock recovery interact.

The first exact-byte implementation used a base64 data URL, but a full 4 MiB compiled smoke exposed Bun resolver NameTooLong failures above roughly 1 KiB. The verified-byte boundary now uses a temporary immutable in-memory blob module URL, revoked after import. Native compiled verification proves the 4 MiB maximum with Bun-compatible TypeScript syntax and a node: built-in import. Relative and bare runtime imports are explicitly unsupported; absolute URL/computed dynamic imports and other full-user-permission effects remain possible outside the exact entry lock.

Independent review findings are closed with adversarial coverage: invalid portable spellings and the 65th declaration preserve exact state bytes; verified entry path swaps still execute only the captured bytes; manifest link/swap/growth races fail closed; permissive and linked trust roots are rejected; Windows cross-volume containment rejects absolute relative() results; concurrent lock changes fail compare-and-swap without overwriting peer state; Git shorthand is rejected in both scopes before user-state work; and symlink-source remove/re-add requires trust again. Existing lock-first recovery remains green.

Final validation: focused Host/CLI tests passed; bun run check passed format, strict typecheck, architecture boundaries, 535 tests / 0 failures, native compiled-binary package workflow at the exact 4 MiB entry bound, and Iteration 1A crash recovery. bun run check:targets passed for macOS arm64, Linux x64, Windows x64, and Windows arm64. backlog doctor reported no duplicate task IDs, and git diff --check passed.

Closure review reopened GROM-24 at ea5c09a684cfd0b10e66b606dfa96b53b80623e7. The remaining P1 is Windows trust-root attestation: POSIX uid/mode checks do not attest Windows ACL ownership. The bounded delivery will fail closed instead of parsing localized shell output or treating Windows mode bits as ACL evidence.

Windows trust follow-up: the local package manager now snapshots a Host-owned POSIX/Windows trust-root platform input. POSIX keeps real-directory, current-owner, and exact 0700 checks. Windows does not read or write persisted plugin trust and refuses enabled local-plugin execution with plugin-package-trust-root-unattested until a bounded owner/ACL attestor exists. Fresh Windows startup remains available only when no enabled blueprint plugin and no plugin user-data root exists; it starts without personal local plugins. No POSIX mode heuristic or localized shell-output parser was introduced.

The deterministic regression creates and persists a valid exact grant under the POSIX path, then injects the Windows platform over that same workspace and proves the persisted grant cannot authorize execution (zero imports and the stable diagnostic). It also proves a fresh Windows workspace starts without creating a trust root. The Host lifecycle canonicalizes the diagnostic. Final validation: focused Host tests passed 73 tests / 0 failures; bun run check passed format, strict typecheck, architecture boundaries, 537 tests / 0 failures, native 4 MiB compiled plugin execution, and Iteration 1A crash recovery; bun run check:targets passed macOS arm64, Linux x64, Windows x64, and Windows arm64; backlog doctor and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed GROM-24 with closure-review hardening. In addition to canonical writer symmetry, stable file snapshots, exact captured-byte execution, scoped trust, coordinated lock CAS, and adversarial package regressions, persisted local-plugin trust now fails closed on Windows because the Host cannot yet attest ACL ownership. Existing grants cannot authorize Windows execution, while a fresh Windows workspace without local-plugin state still starts normally. Documentation states the exact limitation and non-sandbox boundary. Verified by 537 repository tests, a platform-injected persisted-grant regression with zero imports, native 4 MiB compiled plugin execution, Iteration 1A recovery, four target builds, Backlog doctor, and diff checks.
<!-- SECTION:FINAL_SUMMARY:END -->
