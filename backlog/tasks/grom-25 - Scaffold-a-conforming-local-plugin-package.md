---
id: GROM-25
title: Scaffold a conforming local plugin package
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-15 16:08'
labels: []
milestone: m-4
dependencies:
  - GROM-23
  - GROM-24
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - DEVELOPMENT.md
  - backlog/tasks/grom-25 - Scaffold-a-conforming-local-plugin-package.md
  - scripts/verify-binary.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/surface.test.ts
  - src/host/README.md
  - src/host/default-bootstrap.ts
  - src/host/default-host-identities.ts
  - src/host/index.ts
  - src/host/lifecycle.ts
  - src/host/local-plugin-packages.ts
  - src/host/plugin-scaffolding.ts
  - src/host/tests/lifecycle.test.ts
  - src/host/tests/plugin-scaffolding.test.ts
  - src/plugin-sdk/README.md
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a small supported starting point for plugin authors so a new local capability package follows the public manifest and conformance contracts without copying Groma internals.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A user can choose a package identity, destination, and intended capability contributions and receive a minimal local plugin package
- [x] #2 The generated package includes valid package and plugin manifests, a public entry point, and the relevant conformance-test starting point
- [x] #3 Invalid or conflicting plugin identities fail without leaving a partial scaffold
- [x] #4 The scaffold contains no imports from private Groma source modules
- [x] #5 A freshly generated package can be added, enabled, loaded, and tested through the supported local package workflow
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one explicit CLI workflow: groma package scaffold with repeatable provides, bounded parsing, and a stable package-operation result.
2. Implement deterministic public-only scaffolding behind the Host package capability with complete identity validation and manifest-last no-replace publication.
3. Wire management-only Host and CLI composition, document the public author workflow, and keep generated imports on supported SDK subpaths.
4. Verify invalid inputs, failure atomicity, generated conformance, strict public typechecking, multi-capability output, add, enable, and fresh startup through focused, full, target, and independent review gates.
5. Stabilize the cold end-to-end integration under CI by measuring its external child-process work and assigning only that test a finite 15-second allowance; preserve every public setup and lifecycle assertion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classified this as L2: a public CLI grammar, a multi-file filesystem publication, and trusted runtime interoperability change cross CLI and Host boundaries. The existing `PluginPackageOperations` capability is the single semantic seam; generated runtime code will be self-contained except for erased public SDK type imports, while generated tests use only the public conformance subpath. The supported v0.1 shape deliberately scaffolds one Phase 1 plugin per invocation and derives exact version `1.0.0`, single cardinality, and an inert object provider for each explicitly named capability, avoiding unused placeholders and new configuration breadth.

Implemented the first complete slice. The CLI, captured Host package capability, and default management-only composition expose scaffold without loading existing local plugins. The Host validates and snapshots package/plugin/capability inputs before filesystem work, writes deterministic public-only files to a same-parent private stage, and publishes only the complete directory. Focused strict TypeScript and boundary checks pass. Focused parser, surface, lifecycle/bootstrap, scaffold, and CLI suites pass 97 tests with 818 expectations; the black-box CLI test also runs the newly generated conformance file in a child Bun process (1 test, 2 expectations), adds the same directory, trust-enables its exact TypeScript entry, and proves a later non-package command starts successfully with that plugin loaded.

Final validation is green: bun run check passed 592 tests with 4,151 expectations, public generated conformance passed in its child Bun process, compiled-binary smoke exercised scaffold -> add -> enable -> fresh startup, and Iteration 1A crash recovery passed. bun run check:targets verified all four standalone targets; git diff --check and backlog doctor passed. Review-driven hardening now constrains destinations to reusable workspace-contained ./ paths, reserves publication without replacement, publishes the package manifest last, rolls back only an unchanged exact-owned destination, freezes returned collections, and documents crash residue plus the pre-registry public file-spec setup.

Independent final review passed with no remaining actionable contract, security, lifecycle, cross-platform, documentation, or test finding.

Claude approved PR 26 with minor feedback. Applied the bounded actionable items: classify a non-directory destination ancestor as a stable destination conflict, remove an unused manager-level scaffold fault seam, execute two generated capabilities end-to-end, and strict-typecheck the generated public PluginRegistration import. Kept code 4 for destination conflicts because the documented exit taxonomy places package-source validation there. Did not recursively remove newly created empty parents after failure: recursive parent creation does not provide an atomic inode ownership proof, so cleanup could delete concurrently substituted external state; destination-level manifest-last publication and exact-identity rollback remain the safe promised boundary.

Post-Claude validation is green: focused format, types, boundaries, and 29 tests with 366 expectations passed; full bun run check passed 592 tests with 4,154 expectations plus compiled smoke and Iteration 1A crash recovery; all four standalone targets, git diff --check, and backlog doctor passed.

Independent post-Claude re-review passed: no actionable regression in classification, public typechecking, composition boundaries, multi-capability execution, or destination-level rollback safety.

PR 26 Quality gates exposed a CI-latency failure: the generated-package end-to-end test exceeded Bun's default 5-second timeout while its public file-spec install, strict typecheck, conformance child, add, enable, and fresh-startup workflow was still running. Reopened to measure and bound the integration test without weakening that coverage.

CI stabilization measured the complete generated-package integration at 5.018 seconds on the shared CI runner versus 1.186-1.517 seconds with fresh empty local Bun caches and 0.258-0.296 seconds across three warm reruns. Only that test now has a finite 15-second timeout; no public installation, strict typecheck, two-capability conformance, add, enable, or fresh-startup assertion was removed. Post-fix bun run check passed 592 tests with 4,154 expectations plus compiled smoke and full Iteration 1A crash recovery; all four target checks, git diff --check, and backlog doctor passed. Independent review approved the scope, Bun timeout syntax, and finite margin with no code finding.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the bounded package-scaffold CLI workflow for one deterministic local Phase 1 plugin package, including public-only entry and conformance artifacts, Host-owned identity conflict validation, and no-replace manifest-last publication. Verified all five acceptance criteria through Host and CLI regressions, strict generated-source typechecking, multi-capability generated conformance, scaffold to add to enable to fresh startup in source and compiled workflows, 592 repository tests with 4,154 expectations, Iteration 1A crash recovery, four standalone targets, boundary/type/format checks, git diff --check, backlog doctor, independent subagent reviews, Claude review, and a CI-measured finite timeout for the external-process integration.
<!-- SECTION:FINAL_SUMMARY:END -->
