---
id: GROM-6
title: Establish automated quality and architecture gates
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:33'
updated_date: '2026-07-12 01:09'
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
- [x] #7 After cross-target verification, the host-compatible standalone artifact remains available for an immediate smoke command
- [x] #8 Constrained layers fail closed on non-literal dynamic import and require expressions as unverifiable dependencies, with focused fixture coverage
- [x] #9 Constrained production layers reserve every bare require identifier and report one fail-closed boundary violation per file, while syntax-aware fixtures prove non-computed require property names and unrelated calls remain allowed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve four-target verification and restore a host-compatible artifact afterward.
2. Keep cross-compiled artifact coverage distinct from compatible-host runtime smoke coverage.
3. In Core, standard-model, and application production files, reserve every bare identifier named require and report at most one violation per file.
4. Keep non-computed require property names and unrelated calls allowed; preserve existing dynamic-import and module-specifier validation.
5. Retain direct require dependency analysis for less-constrained layers without lexical scope modeling.
6. Replace lexical fixtures with comprehensive reserved-identifier policy fixtures, run all local and cross-target gates, and require fresh review.
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

Final quality review found that ambient require can escape through an alias while lexically shadowed local require functions are falsely classified. The correction will add lexical value-binding awareness, reject ambient require used as a value, and preserve ignored member and unrelated calls.

Implemented a focused two-pass lexical scope map for runtime TypeScript bindings. Unbound ambient require calls retain literal and non-literal dependency checks; any other referenced ambient require value fails closed at the escape, while local shadowing, member access, and unrelated calls are excluded. Nine focused boundary fixtures, 29 full tests, all quality gates, four-target verification, and immediate native smoke pass. New acceptance criteria remain unchecked pending external review.

Delta spec review found three remaining scope distinctions: type-only imports incorrectly shadow ambient require, runtime namespaces do not shadow it, and computed member keys using require are ignored. Babel AST inspection confirmed importKind at both declaration and specifier levels, declare on ambient TSModuleDeclaration nodes, and computed MemberExpression property shape.

Implemented the delta distinctions using inspected Babel fields only: declaration/specifier/import-equals importKind controls runtime import bindings; non-declare TSModuleDeclaration identifier namespaces bind in a namespace-local scope while declare/global ambient contexts propagate without runtime bindings; computed member properties are referenced values while non-computed properties and require member objects remain ignored. Twelve focused fixtures, 32 full tests, typecheck, all quality gates, four-target verification, immediate native smoke, and diff check pass. Acceptance criteria remain unchecked pending external review.

Spec re-review found that var declarations inside both runtime and ambient namespace bodies currently hoist through the namespace block into program scope. The correction will make namespace bodies var-hoisting boundaries and suppress runtime-binding collection throughout ambient namespace contents.

Namespace scope correction implemented: every TSModuleDeclaration body is now a function-style var-hoisting boundary, so runtime namespace var bindings remain namespace-local; ambient namespace traversal creates scopes but records no runtime bindings at any nesting level. Exact runtime and declare namespace inner-var regressions pass alongside all 13 boundary fixtures, 33 full tests, quality gates, four-target verification, immediate native smoke, and diff check. Acceptance criteria remain unchecked pending external review.

The lexical require approach failed repeated edge-case review and is deliberately replaced under the manifesto simplicity principle. Because the constrained TypeScript/Bun stack is ESM, require is now a reserved bare identifier in Core, standard-model, and application production code. One syntax-aware violation per file replaces scope and dataflow inference; non-computed property tokens remain allowed.

Reserved-bare-require policy implemented. The checker records one boolean per constrained production file, skips direct require dependency duplication there, preserves static/dynamic import diagnostics, and keeps direct require analysis in host/persistence. Syntax-aware property filtering allows non-computed property tokens while rejecting require.resolve through its bare object identifier. The lexical checker fell from 517 to 338 lines and its fixtures from 311 to 212 lines, a combined 278-line reduction. Seven focused fixtures, 27 full tests, quality gates, four-target verification, immediate native smoke, and diff check pass. Replacement AC remains unchecked pending external review.

Recovery PR #5 validation passed: local bun run check, four-target check:targets, immediate native smoke, GitHub Actions run 29174596793 (Quality gates and Cross-platform binaries), independent spec and quality reviews, and Codex bot acceptance. Claude was invoked for the required text, naming, and simplicity review and returned no written feedback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored automated quality gates directly onto mainline, verified one-runner Bun cross-compilation for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64, restored a native artifact after target verification, and hardened Core boundaries with fail-closed dynamic imports plus a simple reserved bare require policy. Verified locally, in GitHub Actions, and by independent and automated review.
<!-- SECTION:FINAL_SUMMARY:END -->
