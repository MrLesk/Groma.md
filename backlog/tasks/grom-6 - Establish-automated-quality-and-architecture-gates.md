---
id: GROM-6
title: Establish automated quality and architecture gates
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:33'
updated_date: '2026-07-12 00:15'
labels:
  - tooling
  - ci
  - testing
milestone: m-1
dependencies:
  - GROM-5
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the 1A correctness claims continuously verifiable. Add fast local and GitHub checks for types, tests, deterministic formatting, architectural import boundaries, and compiled-executable smoke behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One documented local verification command runs type checking, formatting validation, unit tests, and architecture-boundary checks
- [x] #2 GitHub Actions runs the same required checks from a clean checkout using the committed Bun lockfile
- [x] #3 An automated boundary test fails if technology-neutral Core imports host, filesystem, Markdown, CLI, HTTP, or React code
- [x] #4 CI compiles the single-file executable for every target in the documented 1A support matrix and smoke-tests every runnable host target
- [x] #5 A failing test, type error, formatting change, boundary violation, or binary smoke failure causes a nonzero check result
- [x] #6 One CI runner cross-compiles macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, verifies one correctly named artifact per target, and smoke-tests the host-runnable Linux build
- [ ] #7 After cross-target verification, the host-compatible standalone artifact remains available for an immediate smoke command
- [ ] #8 Constrained layers fail closed on non-literal dynamic import and require expressions as unverifiable dependencies, with focused fixture coverage
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the existing four-target single-runner verification and restore a host-compatible artifact afterward.
2. Distinguish cross-compiled artifact coverage from compatible-host runtime smoke coverage in development guidance.
3. Reject non-literal dynamic import and require expressions in constrained layers without treating unrelated calls as dependencies.
4. Add focused boundary fixtures, run local and cross-target gates, and require fresh review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started as a stacked branch from completed GROM-5 while draft PR #1 is awaiting review.

Context-hunter classification: L2 cross-cutting tooling. Reused the build-script fail-fast pattern, package command surface, and DEVELOPMENT.md dependency table. Added a no-analogue architecture checker using pinned @babel/parser 8.0.4 because Bun scanning omits type-only imports and TypeScript 7 exposes compiler AST APIs as unstable. The checker covers import, export, dynamic import, import type, import-equals, and require forms with explicit layer allow-lists and unresolved-relative failures.

Local required check passes in 2.2 seconds: formatting, TypeScript, real-tree architecture boundaries, 10 tests, standalone build, and smoke. Boundary fixtures prove Core rejects host, CLI, Bun, node:fs, marked, node:http, and React dependencies. CI uses current action release commits: actions/checkout v7.0.0 at 9c091bb and setup-bun v2.2.0 at 0c5077e; runner choices match GitHub current macOS arm64 and Ubuntu x64 documentation.

GitHub Actions run 29167429484 passed all clean-checkout jobs on the first pushed revision: Quality gates 10s, Linux x64 baseline binary 11s, macOS arm64 binary 12s. Both target jobs compiled exactly one artifact and executed version and help on matching host architectures.

Fail-closed evidence: development runs observed nonzero typecheck and test outcomes before fixes; parser fixtures exercise prohibited and unresolved dependencies; the boundary CLI sets exit code 1 on any violation; Prettier check, tsc, Bun test, build, and smoke are joined with fail-fast && so any gate stops the aggregate check.

Reopened after Alex identified missing Windows verification. Repository review found no product constraint excluding Windows: MANIFESTO.md requires operating-system portability and says Groma is not tied to an OS. The prior two-platform matrix and explicit Windows deferral were an implementation assumption introduced in GROM-5, not an approved boundary.

Alex expanded the correction to include Windows arm64. Bun 1.3.14 current documentation lists bun-windows-arm64, and GitHub current hosted-runner documentation lists the native windows-11-arm ARM64 runner in public preview.

Alex clarified that native runners are unnecessary because Bun cross-compiles these targets. Replaced the planned four-runner matrix with one Linux runner that builds all targets sequentially, verifies every artifact, and runs the Linux artifact. Documentation will not claim native macOS or Windows runtime CI.

Implemented a portable build and verification path following Bun 1.3.14 current standalone-executable docs. Windows targets use bun-windows-x64-baseline and bun-windows-arm64 with explicit dist/groma.exe output. The smoke script is now Bun-based and works on Unix and Windows instead of relying on shell-specific ./dist/groma commands.

Added check:targets, which sequentially cross-compiles macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64 on one machine; verifies exactly one correctly named artifact after each build; and executes version/help only for the target matching the current host. Local macOS run verified all four artifacts and executed macOS arm64. Full bun run check passes with 10 tests.

GitHub Actions run 29168888457 passed from a clean checkout after the correction: Quality gates 8s and Cross-platform binaries 13s. The single Ubuntu runner cross-compiled macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; verified exactly one expected artifact after each build; and executed version/help for Linux x64.

Reopened during mainline restoration after independent quality review found that check:targets leaves the final Windows ARM64 artifact in dist on non-Windows hosts and one support-policy sentence still implies native runtime smoke for every target.

Fresh quality review found that non-literal dynamic import and require expressions are currently ignored, allowing constrained layers to hide unverifiable dependencies. The correction will fail closed only for actual import and require forms and add focused fixtures.

Implemented fail-closed collection for non-literal dynamic import and bare require calls. Focused fixtures confirm both violations while unrelated loader, member require, and require.resolve calls remain ignored. Local focused tests and the full quality and target gates pass; acceptance criteria remain unchecked pending external review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended GROM-6 from two-platform native CI to honest four-target single-runner verification following Bun 1.3.14 current executable documentation. The portable tooling now emits groma or groma.exe correctly, cross-compiles macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, checks one artifact per target, and executes only the host-compatible binary. Full local gates and clean GitHub Actions pass.
<!-- SECTION:FINAL_SUMMARY:END -->
