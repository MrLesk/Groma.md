---
id: TASK-336
title: Reject Angular projects with TypeScript semantic errors
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 21:52'
updated_date: '2026-09-10 21:57'
labels: []
dependencies: []
references:
  - scan
modified_files:
  - test-bun/angular-scanner.test.ts
  - plugins/scanners/angular/src/scan.ts
  - docs/scanners/angular/index.md
type: bug
ordinal: 382000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reject a selected Angular project whose TypeScript source has semantic errors, before publishing evidence or updating architecture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A type-invalid Angular source makes readiness and scanning fail with preparation instructions and preserves prior architecture.
- [x] #2 Valid Angular callback evidence remains supported.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reproduce an incompatible assignment in the packaged Angular fixture, run TypeScript semantic diagnostics through NgtscProgram, update preparation documentation, and run scanner and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The packaged fixture accepted const invalid: string = 123 before the fix. Added NgtscProgram.getTsSemanticDiagnostics to the existing preparation failure path. Source evidence remains transient; core retains ownership of C4 relationships and OKF storage.

Semantic validation exposed a broken test dependency link: the fixture linked the scanner-local node_modules containing only TypeScript, while Angular core is hoisted to workspace node_modules. Updated the fixture link to the installed workspace dependencies, matching React fixture setup. No production fallback or dependency behavior changed.

Specification and quality review found no blocking issue: preparation now asks the same Angular compiler for TypeScript semantic errors before evidence is returned; valid output binding inference is unchanged. All four packaged Angular tests pass, including readiness rejection and preservation of prior architecture. Final repository check with the rebuilt Rust worker enabled passed on macOS ARM64: 110 Node and 433 Bun tests, 3 optional toolchain skips, zero failures, 6 existing complexity warnings. git diff --check passed. Linux and Windows execution has not been performed here. No release validation changes. Uncommitted pending user acceptance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angular readiness and scanning now reject TypeScript semantic errors before architecture changes. Added a regression, repaired the fixture dependency link exposed by semantic checking, and documented preparation behavior. All four Angular tests and the full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
