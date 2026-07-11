---
id: GROM-6
title: Establish automated quality and architecture gates
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 17:33'
updated_date: '2026-07-11 20:40'
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
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a single local verification entry point.
2. Add type, format, unit-test, and dependency-boundary checks.
3. Add clean-checkout GitHub Actions using the exact Bun dependency resolution.
4. Compile and smoke-test the supported single-file executable targets.
5. Document failure diagnosis and keep the suite fast enough for every change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started as a stacked branch from completed GROM-5 while draft PR #1 is awaiting review.

Context-hunter classification: L2 cross-cutting tooling. Reused the build-script fail-fast pattern, package command surface, and DEVELOPMENT.md dependency table. Added a no-analogue architecture checker using pinned @babel/parser 8.0.4 because Bun scanning omits type-only imports and TypeScript 7 exposes compiler AST APIs as unstable. The checker covers import, export, dynamic import, import type, import-equals, and require forms with explicit layer allow-lists and unresolved-relative failures.

Local required check passes in 2.2 seconds: formatting, TypeScript, real-tree architecture boundaries, 10 tests, standalone build, and smoke. Boundary fixtures prove Core rejects host, CLI, Bun, node:fs, marked, node:http, and React dependencies. CI uses current action release commits: actions/checkout v7.0.0 at 9c091bb and setup-bun v2.2.0 at 0c5077e; runner choices match GitHub current macOS arm64 and Ubuntu x64 documentation.

GitHub Actions run 29167429484 passed all clean-checkout jobs on the first pushed revision: Quality gates 10s, Linux x64 baseline binary 11s, macOS arm64 binary 12s. Both target jobs compiled exactly one artifact and executed version and help on matching host architectures.

Fail-closed evidence: development runs observed nonzero typecheck and test outcomes before fixes; parser fixtures exercise prohibited and unresolved dependencies; the boundary CLI sets exit code 1 on any violation; Prettier check, tsc, Bun test, build, and smoke are joined with fail-fast && so any gate stops the aggregate check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added fast, reproducible local and GitHub quality gates. The single bun run check command now verifies formatting, strict types, architecture boundaries, 10 tests, the standalone build, and binary smoke behavior. Added a pinned Babel-based TypeScript import checker with explicit layer rules and negative Core fixtures, plus commit-pinned GitHub Actions that pass on clean Ubuntu x64 and macOS arm64 runners for both promised 1A binaries.
<!-- SECTION:FINAL_SUMMARY:END -->
