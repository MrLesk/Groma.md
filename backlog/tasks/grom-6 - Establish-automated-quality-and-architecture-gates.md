---
id: GROM-6
title: Establish automated quality and architecture gates
status: To Do
assignee: []
created_date: '2026-07-11 17:33'
updated_date: '2026-07-11 17:36'
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
- [ ] #1 One documented local verification command runs type checking, formatting validation, unit tests, and architecture-boundary checks
- [ ] #2 GitHub Actions runs the same required checks from a clean checkout using the committed Bun lockfile
- [ ] #3 An automated boundary test fails if technology-neutral Core imports host, filesystem, Markdown, CLI, HTTP, or React code
- [ ] #4 CI compiles the single-file executable for every target in the documented 1A support matrix and smoke-tests every runnable host target
- [ ] #5 A failing test, type error, formatting change, boundary violation, or binary smoke failure causes a nonzero check result
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a single local verification entry point.
2. Add type, format, unit-test, and dependency-boundary checks.
3. Add clean-checkout GitHub Actions using the exact Bun dependency resolution.
4. Compile and smoke-test the supported single-file executable targets.
5. Document failure diagnosis and keep the suite fast enough for every change.
<!-- SECTION:PLAN:END -->
