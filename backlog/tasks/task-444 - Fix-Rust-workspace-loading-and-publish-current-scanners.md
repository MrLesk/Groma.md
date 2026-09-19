---
id: TASK-444
title: Fix Rust workspace loading and publish current scanners
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-19 21:17'
updated_date: '2026-09-19 21:21'
labels: []
dependencies: []
references:
  - rust-src-index
modified_files:
  - test/fixtures/rust-workspace.json
  - test-bun/rust-workspace.test.ts
  - plugins/scanners/rust/src/project.ts
  - docs/scanners/rust/index.md
  - packages/scanner/package.json
  - plugins/scanners/rust/package.json
  - plugins/scanners/python/package.json
  - plugins/scanners/typescript/package.json
  - plugins/scanners/go/package.json
  - plugins/scanners/java/package.json
  - plugins/scanners/csharp/package.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/react/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/php/package.json
  - plugins/scanners/swift/package.json
  - bun.lock
type: bug
ordinal: 517000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanning Codex with the published Rust package fails on offline Cargo dependencies. The current source avoids Cargo but rejects valid shared module paths and loads implicit workspace packages without inherited edition or dependencies. Alex approved fixing the reproduced loaders, regression coverage, and publishing updated scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rust loads valid repository-local shared module paths and preserves one physical file identity.
- [ ] #2 Implicit path-dependency workspace members retain inherited edition and local dependencies without duplicate standalone scans.
- [ ] #3 The complete Codex repository scans with the corrected Rust package without source edits or application dependency installation.
- [ ] #4 Focused regression tests and bun run check pass; documentation records the supported behavior and verification.
- [ ] #5 Updated scanner packages, including JavaScript, are published through the existing release process and verified from npm.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add minimal fixture regressions for shared module paths and implicit workspace members. 2. Correct Rust crate source roots and workspace membership/inheritance in the existing project loader. 3. Verify fixtures and the full Codex scan, then run repository checks. 4. Prepare changed package versions and use the existing multi-platform release workflow; verify published packages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both regression tests failed before the fix and pass afterwards. The full Codex repository now returns 2 roots, 2586 files and 25502 operations in 18.8 seconds without source edits or dependency installation. Twenty-four focused tests pass. The existing Rust loader owns source visibility and Cargo membership; this changes no OKF metadata or C4 boundaries. Cargo membership follows local path dependencies including dev, build and target tables; only normal dependencies contribute graph edges.

Release versions are prepared in the isolated codex/rust-workspace-scanner-release worktree, preserving other agents unfinished changes. Full bun run check passed: 16 Node tests, 609 Bun tests, 36 skipped, zero failures. Focused native Rust checks passed separately.

Specification and quality review traced scan -> rustProjects -> members -> implicit dependency closure -> sourceCrates -> native analysis -> combined observation. Shared file identity and existing uncertainty behavior remain intact. No new C4 elements, OKF fields, runtime dependencies or fallback paths. The fix is bounded within the existing Rust adapter. All changed functions pass the complexity limit. Release branch bumps the contract and every previously published scanner because their committed source has changed since publication; JavaScript remains its initial 0.1.0 release.
<!-- SECTION:NOTES:END -->
