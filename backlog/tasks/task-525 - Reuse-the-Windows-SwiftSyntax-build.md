---
id: TASK-525
title: Reuse the Windows SwiftSyntax build
status: Done
assignee: []
created_date: '2026-09-24 19:47'
updated_date: '2026-09-24 19:52'
labels: []
dependencies: []
modified_files:
  - plugins/scanners/swift/build.ts
  - test-bun/swift-scanner.test.ts
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - docs/scanners/swift/index.md
  - .gitignore
ordinal: 610000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows CI and release jobs compile SwiftSyntax from source because the Windows toolchain ships runtime DLLs without the parser development modules. In run 36046592368 that compile took 10 minutes 21 seconds after the Swift test-package cache missed. The builder deletes its SwiftPM directory when the build finishes, and the test-package cache key also covers the dependency lockfile and the shared project helper, so a change that does not affect the Swift worker pays for the full compile again. Release builds never restore a SwiftPM directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A second Windows build with the same toolchain and SwiftSyntax revision reuses the existing SwiftPM directory and relinks the worker.
- [x] #2 CI restores that directory when the Swift test-package cache misses, and the release workflow restores it before building scanner packages.
- [x] #3 The Swift test-package cache stays valid when only the dependency lockfile or plugins/scanners/projects.ts changes.
- [x] #4 The Swift maintainer page describes the reused Windows build.
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
1. Keep the Windows SwiftPM package in GROMA_SWIFT_PM_CACHE, or ~/.cache/groma/swift-scanner when that is unset. Copy Package.swift and the worker into it and leave .build in place. swift build --disable-index-store then relinks the worker.
2. Cache .groma/swift-syntax-build in CI when the Swift test-package cache misses, and in the release workflow on Windows. Key it by OS, CPU, the Swift setup action, and Package.swift. Point GROMA_SWIFT_PM_CACHE at that directory for the build.
3. Drop bun.lock and plugins/scanners/projects.ts from the Swift test-package cache key. Keep packages/scanner, because the built adapter bundles it; a contract change rebuilds the adapter and relinks, and the SwiftPM cache keeps SwiftSyntax.
4. Test decision: prepareWindowsSwiftPackage leaves an existing .build marker in place and writes the manifest and worker. Authority is the requested reuse. The failure is a fresh temp directory deleting compiled SwiftSyntax. No test covers that directory. A second synchronous check reads GROMA_SWIFT_PM_CACHE as the package root, catching a CI path the builder ignores. No Swift compiler is required.
5. Update the Swift maintainer page. Run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Local bun run check passed: Biome reported only existing warnings, tsc passed, 16 Node tests passed, 744 Bun tests passed with 48 skips. The new Windows SwiftPM tests passed. actions/cache@v6 matches the existing cache steps; the v6 tag is v6.1.0 (55cc834, 2026-06-26). Windows cache reuse has not been measured on a runner yet.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Windows builds keep the SwiftPM package in GROMA_SWIFT_PM_CACHE, or ~/.cache/groma/swift-scanner locally, and leave its .build directory in place. CI restores .groma/swift-syntax-build when the Swift test-package cache misses, and the release workflow restores the same directory on Windows before staging scanner packages. The test-package cache key no longer includes bun.lock or plugins/scanners/projects.ts. Verified by the SwiftPM package tests and bun run check: 16 Node tests, 744 Bun tests, 48 skips, zero failures.
<!-- SECTION:FINAL_SUMMARY:END -->
