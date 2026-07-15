---
id: GROM-24
title: Manage and pin local plugin packages
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:56'
updated_date: '2026-07-15 07:47'
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
1. Make every package writer preflight the complete serialized configuration, lock, and user state through the same bounded semantic readers before publication; preserve prior bytes on invalid portable spelling or cardinality overflow.
2. Replace path precheck plus readFile with a no-follow bounded open-handle snapshot that reads at most max+1 and revalidates the opened/path identity; add platform-aware containment and complete remote shorthand rejection.
3. Bind plugin evaluation to the exact verified entry bytes using an immutable in-memory module URL, remove path/query integrity assumptions, and document the supported bundled-entry import semantics.
4. Harden the user-data trust root against links/junctions, wrong ownership, and group/world access; add scope to canonical trust grants so removal prunes the stored identity without source availability.
5. Add lock compare-and-swap under blueprint coordination while preserving explicit lock-first disable/remove reconciliation after interrupted publication.
6. Add deterministic adversarial regressions for canonical writer symmetry, 65th-package refusal, byte swaps, file link/swap/growth, trust-root permissions, Windows cross-volume containment, stale lock CAS, Git shorthand, and symlink-source trust revocation; update architecture/Host/SDK docs.
7. Run focused suites, full bun run check, four-target verification, Backlog validation, and diff review; update exact evidence and return GROM-24 to Done only when all findings are objectively green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Independent review hardening pass reopened GROM-24 at 4de1b51d7697ff90978463935146b7d16bdf5e45. Context Hunter classification remains L2 because canonical state, filesystem identity, trust, module execution, cross-platform paths, and lock recovery interact.

The first exact-byte implementation used a base64 data URL, but a full 4 MiB compiled smoke exposed Bun resolver NameTooLong failures above roughly 1 KiB. The verified-byte boundary now uses a temporary immutable in-memory blob module URL, revoked after import. Native compiled verification proves the 4 MiB maximum with Bun-compatible TypeScript syntax and a node: built-in import. Relative and bare runtime imports are explicitly unsupported; absolute URL/computed dynamic imports and other full-user-permission effects remain possible outside the exact entry lock.

Independent review findings are closed with adversarial coverage: invalid portable spellings and the 65th declaration preserve exact state bytes; verified entry path swaps still execute only the captured bytes; manifest link/swap/growth races fail closed; permissive and linked trust roots are rejected; Windows cross-volume containment rejects absolute relative() results; concurrent lock changes fail compare-and-swap without overwriting peer state; Git shorthand is rejected in both scopes before user-state work; and symlink-source remove/re-add requires trust again. Existing lock-first recovery remains green.

Final validation: focused Host/CLI tests passed; bun run check passed format, strict typecheck, architecture boundaries, 535 tests / 0 failures, native compiled-binary package workflow at the exact 4 MiB entry bound, and Iteration 1A crash recovery. bun run check:targets passed for macOS arm64, Linux x64, Windows x64, and Windows arm64. backlog doctor reported no duplicate task IDs, and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened GROM-24 after independent review without changing its product scope. Every package-state writer now proves reader symmetry before publication; file reads use bounded no-follow handle snapshots; execution uses the exact captured bytes through an immutable in-memory module; the trust root and grants are fail-closed; blueprint updates compare-and-swap both configuration and lock; remote shorthand and cross-volume escapes are rejected; and trust pruning survives missing symlink sources. Added deterministic regressions for all eight findings and documented the bundled/self-contained entry contract, including its non-sandbox boundary. Verified with 535 repository tests, native 4 MiB compiled plugin execution, Iteration 1A recovery, and all four target builds.
<!-- SECTION:FINAL_SUMMARY:END -->
