---
id: TASK-444
title: Fix Rust workspace loading and publish current scanners
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:17'
updated_date: '2026-09-20 11:07'
labels: []
dependencies: []
references:
  - rust-src-index
  - csharp-src-index
  - java-src-index
  - src-index
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
  - plugins/scanners/csharp/src/adapter.ts
  - scripts/package-csharp-scanner.ts
  - scripts/scanner-release.ts
  - test-bun/csharp-packaging.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - docs/scanners/publishing.md
  - plugins/scanners/rust/src/index.ts
  - test-bun/scanner-exclusions.test.ts
  - test-bun/java-gradle.test.ts
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
- [x] #5 Updated scanner packages, including JavaScript, are published through the existing release process and verified from npm.
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
1. Add minimal fixture regressions for shared module paths and implicit workspace members. 2. Correct Rust crate source roots and workspace membership/inheritance in the existing project loader. 3. Verify fixtures and the full Codex scan, then run repository checks. 4. Prepare changed package versions and use the existing multi-platform release workflow; verify published packages.

5. Split the C# self-contained worker into platform npm packages and retain the existing scanner package as a small adapter with exact optional dependencies, following the existing Groma CLI delivery pattern. Qualify fresh installs and all platform package tests, then publish JavaScript and C# and verify npm versions.

6. Address PR108 review findings in the existing Rust adapter. Source listing must retain selected target-directory inputs and include shared path modules reached through literal path attributes (ScannerPlugin.listSourceFiles contract and reproduced fixture omission). Existing listing coverage only exercises src-local files; add one fixture assertion for shared.rs and compare native observation files with the listing. Cargo edition inheritance is opt-in; an omitted package edition must use 2015 (Cargo manifest contract). Existing workspace coverage uses only explicit inheritance; change its implicit support member to omit edition and use a valid 2015 gen identifier, then check both the crate edition and successful native scanning. Reproduce failures before the fixes, run focused tests and bun run check, and push the reviewed correction to PR108.

7. Merge and release as Alex requested. Integrate current main, preserve the approved TASK-451 Windows path and measured concurrency corrections, and fix the reproduced clean-CI Vue exclusion test setup. The existing test references an unbuilt local Vue package, so it fails before exercising exclusions on a fresh checkout; build a private package inside that test, as the existing Vue tests do. Preserve every assertion and the timeout, with no new behavior test. Validate the merged state, merge PR108, trigger scanner-only release on main and verify public Rust 0.1.3.
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

Alex explicitly approved the C# packaging fix and requested browser npm login. Login now succeeded. The C# change is delivery plumbing owned by the existing scanner builder, adapter and release script: no new OKF concepts, metadata or C4 elements. Ordinary Markdown readers see unchanged architecture records. Only the current five supported targets are packaged; no generic runtime-package framework is added.

JavaScript 0.1.0 is now published and verified in npm. C# uses exact platform optional dependencies; each host build stages the adapter and complete runtime, assembly emits separate runtime packages, and publication waits for runtimes before publishing the adapter. The npm-package installation test passed on macOS without project tools (13 assertions), all six packaged C# integration tests passed (29 assertions), and bun run check passed 16 Node and 601 Bun tests with 36 opt-in skips. The cold simplicity review passed; corrected the assembly comment it identified. Implementer specification and quality review traced source/staged build, platform assembly, publication ordering, normal module resolution and SDK-free scan/outline flows. No language analysis, OKF meaning or C4 ownership changed; native Windows/Linux package qualification and initial runtime publications remain.

The full-context complexity review passed with no blockers or material simplification recommendations. Normal optional dependencies are the minimum sufficient delivery change for the observed npm size failure. GitHub trusted publishing for JavaScript was blocked by automatic approval review because persistent npm security settings were not explicitly authorized; requested separate approval for JavaScript and the five new runtime packages. This does not block manual publication with the completed npm login.

npm pack measured the new macOS C# runtime at 41,167,899 bytes and its adapter at 13,443 bytes, compared with the rejected 214.6 MB combined package. The exact published JavaScript 0.1.0 package installs through Groma and scans Codex: 4 files and 65 operations. C# fix commit cfb1ee3c is in ready PR108; build-only release run 35472519649 is qualifying all five platforms before initial runtime publication.

C# split release qualification completed successfully in run 35472519649: repository checks and all scanner package suites passed on macOS ARM64, Linux x64/ARM64 and Windows x64/ARM64. Each C# host test packed and installed the adapter and runtime before the SDK-free scan. Downloading the qualified artifacts for initial manual runtime publication; GitHub publishing permission remains a separate pending question.

Initial runtime publication reached npm but each child returned EOTP because the shared release subprocess helper inherited stdout/stderr without stdin. Corrected the helper to inherit stdin as well, enabling the existing npm browser approval flow in a terminal. No runtime artifact or scanner behavior changed; repository checks are rerunning. No C# runtime version was accepted by these failed attempts.

Repository checks pass after the npm terminal-input correction: 16 Node tests, 601 Bun tests, 36 opt-in skips, zero failures. The change only connects the existing publication subprocess to the caller terminal; all qualified scanner artifacts are unchanged.

All five platform artifacts were assembled successfully. The corrected release command now presents npm browser approval for each of the five initial C# runtime publications; opened all five approval pages in the default browser. Publication is waiting for the account holder to complete those approvals. The adapter will publish after the runtime group succeeds. Public C# installation verification and AC5 remain pending; no credential or approval URL was stored in the repository.

The five npm browser approval sessions ended with E404 from the approval completion endpoint before any runtime upload succeeded. They are no longer active; no background publishing command remains. Requested Alex availability before opening fresh publication approvals. C# source, package assembly and five-platform qualification are complete; publication and public-install verification remain pending.

Alex explicitly approved permanent npm publishing permission for release.yml in MrLesk/Groma.md for JavaScript and the five new C# runtime packages. The renewed npm web login succeeded on 2026-09-20. Initial runtime uploads use the qualified five-platform CI artifacts; the existing C# adapter already has the release workflow publishing path. npm documentation requires each new package to exist before trusted publishing can be configured.

npm accepted all five new C# runtime packages at 0.1.3. Created and verified GitHub trusted-publisher configurations for JavaScript and the runtime packages, scoped to MrLesk/Groma.md and release.yml. The existing C# adapter already had that trusted publisher. Release workflow 35504470207 is running on ada21479 with publish_scanners=true so CI publishes the adapter. Registry visibility is still propagating for the initial runtimes; public adapter installation remains pending.

Release workflow 35504470207 completed successfully on ada21479: repository checks, five native platform package suites and npm publication all passed. CI published @groma/scanner-csharp 0.1.3 with GitHub provenance; all five exact runtime optional dependencies are publicly available at 0.1.3. The actual npm package passed Groma fresh installation, readiness and a two-project C# fixture scan on macOS ARM64. A second checkout restored the recorded scanner selection with groma scanner install and passed readiness and scanning. All six new package trusted-publisher grants are verified for MrLesk/Groma.md release.yml. No further npm approval or release blocker remains.

Alex requested fixing actionable PR comments. Both review findings concern the supported Rust workspace flow. The existing Rust adapter owns the changes; OKF metadata and C4 boundaries remain unchanged. Source inputs do not themselves create architecture owners. This follows language and scanner contracts across repositories, rather than adding Codex-specific handling.

Both PR review regressions failed before the fix: shared.rs was omitted and an implicit package without an edition used 2024, causing valid gen syntax to abort the native scan. Rust listing now follows literal path-module references from selected target-directory sources, preserving the existing manifest-selection regression. Edition inheritance requires workspace=true; otherwise an omitted edition is 2015. Twenty focused workspace/source-listing tests pass, including the native fixture. Rust 0.1.3 is prepared for the next CI release; 0.1.2 remains the published version. Initial full-check failures included a corrected source-listing scope regression and sandbox-denied watchers/local servers; rerunning with required permissions. Initial broader native test invocation used an incorrect worker argument and lacked the staged package; preparing the existing qualified worker with the changed adapter before rerunning.

PR108 review correction verified: bun run check passes 16 Node and 602 Bun tests, with 36 opt-in skips and zero failures. All 12 native Rust tests pass with the qualified worker and rebuilt adapter, and 20 focused source-listing/workspace tests pass. Implementer specification and quality review traced listSourceFiles -> selected target directories -> shared literal path references and readRustProject -> opt-in edition selection -> native parsing. Existing manifest-selection coverage still passes. The regressions prove observable source coverage and parsing behavior, not prose or implementation text. No new domain or architecture design requires another delegated review. Rust 0.1.3 is prepared in this PR for a later release; the previously verified npm releases remain unchanged.

PR108 merge CI 35505835731 exposed the existing Windows Java separator failure and a newer main-branch Vue exclusions test referencing an unbuilt scanner. Merged origin/main into the isolated branch and coordinated the actual package.json overlap with TASK-451. These are reproduced release blockers; no scanner behavior or architecture model changes are needed.

Merged-state local verification passes: the unchanged Vue exclusion assertions now run against a package built in the test-owned temporary directory; all 11 focused Java/Vue tests pass. TASK-451 owner confirmed its exact two final changes and no newer correction. Full bun run check passes after integration; proceeding to fresh PR CI before merge and scanner-only release.

PR108 merge validation 35506158611 passed the full CI jobs on Linux, macOS and Windows. Merged PR108 as ae74717baec192b69a3548a3e3cd71369a904591 on 2026-09-20. Started scanner-only Release run 35506401167 from main with publish_scanners=true for Rust 0.1.3. Public fresh-install verification is prepared in an independent workspace fixture and awaits registry publication.

Final release complete: main-branch Release35506401167 passed repository validation and all five platform package suites, then npm accepted @groma/scanner-rust0.1.3 with GitHub provenance. Registry readback confirms 0.1.3. The actual public package passed Groma fresh installation, readiness, the workspace regression scan, shared.rs source listing and second-checkout restoration. It also scanned the complete Codex repository successfully: 2 roots, 2586 files, 25502 operations and 44 diagnostics, with no project source changes or dependency installation. PR108 is merged at ae74717baec192b69a3548a3e3cd71369a904591; no release blocker remains.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged PR108 and published the prepared scanners through CI. Rust 0.1.3 fixes shared-module source visibility and listing, implicit Cargo workspace membership and opt-in edition inheritance. The public package scans Codex (2586 files, 25502 operations) and passes fresh installation and second-checkout restoration. JavaScript 0.1.0 and C# 0.1.3 are published; C# uses exact platform runtime dependencies to avoid the npm upload limit. New package CI publishing permissions are configured. Linux/macOS/Windows PR CI and all five native release suites pass. The final local check passed 16 Node and 603 Bun tests, with 36 opt-in skips.
<!-- SECTION:FINAL_SUMMARY:END -->
