---
id: TASK-444
title: Fix Rust workspace loading and publish current scanners
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-19 21:17'
updated_date: '2026-09-19 21:49'
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
  - .github/workflows/release.yml
  - docs/scanners/rust/validation.md
  - package.json
  - test-bun/scanner-fresh-checkout.test.ts
type: bug
ordinal: 517000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanning Codex with the published Rust package fails on offline Cargo dependencies. The current source avoids Cargo but rejects valid shared module paths and loads implicit workspace packages without inherited edition or dependencies. Alex approved fixing the reproduced loaders, regression coverage, and publishing updated scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rust loads valid repository-local shared module paths and preserves one physical file identity.
- [x] #2 Implicit path-dependency workspace members retain inherited edition and local dependencies without duplicate standalone scans.
- [x] #3 The complete Codex repository scans with the corrected Rust package without source edits or application dependency installation.
- [x] #4 Focused regression tests and bun run check pass; documentation records the supported behavior and verification.
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

Release commit 97353f42 is isolated on codex/rust-workspace-scanner-release; draft PR https://github.com/MrLesk/Groma.md/pull/108. Five-platform Release workflow 35470188287 started with publication enabled. The local npm login is expired; browser login is pending for first publication of JavaScript. JavaScript 0.1.0 package built and read four Codex JavaScript files (the two bin entrypoints remain excluded by its existing source selection). Rust 0.1.2 local package built.

Release job 105969611090 failed before scanner builds: Temurin has no JDK 25 for Windows ARM64. The isolated release workflow now selects Microsoft JDK 25 for that one platform, whose official download page lists Windows ARM64 support. Other platforms retain Temurin. This is a reproduced publication blocker under acceptance criterion 5.

The actual Rust 0.1.2 package passes readiness and scans the entire Codex repository: 2586 files, 25502 operations, 2 roots. Replacement release workflow 35470306741 uses Microsoft JDK 25 only on Windows ARM64. Publication remains pending.

Linux release validation exposed six Python timeouts at 20 seconds while ten concurrent tests each built a package and started separate Pyodide interpreters. The packaged Linux ARM64 suite passes Python. The release branch bounds test concurrency within each file to four while preserving all assertions, 20-second timeouts, test isolation and concurrent execution. Bun official parallel-test documentation and installed Bun 1.4.1 help confirm --max-concurrency; the declared runner is also 1.4.1. No file-level parallel or isolation option changes.

The exact isolated release branch also passes bun run check after bounding test concurrency: 16 Node tests, 600 Bun tests, 36 opt-in skips, zero failures. All ten Python tests pass; the slowest takes 3.66 seconds locally. Counts differ from the shared checkout because unrelated uncommitted test files are excluded. macOS arm64 and both Linux platform package suites passed in workflow 35470306741.

Windows package builds succeeded, but all fresh-checkout tests failed before scanner execution: relocating git.exe via a symlink loses its DLL lookup location (exit 53). On Windows the isolated test PATH now names the actual Git executable directory; Unix still uses the isolated Git symlink. No language SDK or project dependency directories are restored to PATH. Final Linux repository validation passed with the concurrency cap in run 35470653541.

The exact isolated release branch passes bun run check after the Windows Git harness fix: 16 Node tests, 600 Bun tests, 36 opt-in skips, zero failures. Windows execution is being requalified in the final release workflow.

Final release workflow 35470904452 uses commit b4ff1355. Repository checks and packaged scanner tests have passed on Linux x64/ARM64, macOS ARM64 and Windows ARM64; Windows x64 is still building. The Windows ARM64 pass confirms the Git executable location correction. The installed Groma 0.3.3 CLI also installed the local Rust 0.1.2 package, passed readiness and scanned the regression fixture, preserving one owner for its shared source file. JavaScript first publication still needs a renewed npm login; npm whoami returns E401.

All five platform package suites and repository validation passed in release run 35470904452. npm accepted the contract and ten scanners, including Rust 0.1.2. The actual npm-installed Rust package scans Codex with 2586 files and 25502 operations; Groma 0.3.3 also passes a fresh install, readiness, fixture scan and second-checkout restore. Updated Rust validation documentation. JavaScript was rejected with E404 because it has no initial authenticated publication. C# was rejected with E413: the five-platform self-contained package is 214.6 MB compressed. No C# runtime content was removed: source analysis uses the bundled runtime assemblies as references. A platform-specific package split is a larger delivery change; awaiting Alex direction.
<!-- SECTION:NOTES:END -->
