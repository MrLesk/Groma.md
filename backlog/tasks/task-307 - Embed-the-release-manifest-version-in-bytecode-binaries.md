---
id: TASK-307
title: Embed the release manifest version in bytecode binaries
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 16:07'
updated_date: '2026-09-06 16:58'
labels: []
dependencies: []
references:
  - welcome
  - commands
  - build
modified_files:
  - src/welcome/model.ts
  - src/cli.ts
  - scripts/build.ts
  - package.json
  - .gitignore
  - test-bun/release-version.test.ts
  - CONTRIBUTING.md
  - bun.lock
ordinal: 345000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the package manifest as the single source of version data in source and single-file Bun bytecode builds. Release CI will update the checkout manifest from its tag before compiling, then synchronize main after publication. Keep no dedicated version-preparation command or script. The source workspace identifies the public groma.md package while remaining private for separate binary packaging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI version and welcome version read the same manifest in development and in the compiled executable without a runtime package.json lookup.
- [x] #2 Version preparation belongs directly in release CI; the source workspace contains no release:version command or set-release-version script.
- [x] #3 A regression updates a private checkout manifest to a different release version, builds the actual CLI, and verifies that the isolated binary retains that version after removing the checkout.
- [x] #4 The repository check passes and the build/release version sequence is documented.
- [x] #5 The root manifest and lockfile identify the package as groma.md and retain accurate workspace metadata.
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
1. Keep static manifest version imports and the single-file bytecode build. 2. Remove the dedicated version script and package alias; update the binary regression to change its private manifest directly. 3. Correct the package name and refresh the lockfile. 4. Update documentation, run repository checks, and verify the local binary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented static JSON imports for the CLI and welcome version, plus a single-file Bun bytecode build using ESM, minification, and linked source maps. The build reads the prepared package.json version at compile time, so the resulting binary has no runtime manifest lookup.

Removed the release:version package command and set-release-version script. Release CI prepares package.json directly from the tag in its disposable checkout before running bun run build. The regression edits that private manifest, runs the source CLI and build, deletes the checkout, and verifies the isolated binary version and plain welcome output.

Renamed the private root workspace to groma.md and refreshed bun.lock. CONTRIBUTING.md documents the build and release sequence. No npm publication workflow or standalone asset packaging is introduced. The scanner-created build and stale set-release-version records were not edited or committed; the stale removal command correctly refused because the record is scanner-owned.

Verification: the focused release regression passes; bun run build creates a 79 MB macOS ARM64 executable, and the isolated binary reports 0.1.0 for --version and --help. An earlier complete bun run check for this same final change passed 106 Node tests and 332 Bun tests with six existing complexity warnings. A fresh sandbox rerun reached the pre-existing watcher/server tests but failed on host FSEvents and ephemeral-port restrictions; no changed test failed. git diff --check passes. No public release or npm publication was performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Use package.json as the sole release version source for development and compiled binaries. Added the Bun bytecode build command, switched CLI and welcome version reads to static manifest imports, removed the release:version/set-release-version preparation code, renamed the private root workspace to groma.md, and documented the CI preparation sequence. Verified with the release-version regression, an isolated compiled binary, git diff --check, and the recorded full repository check (106 Node and 332 Bun tests).
<!-- SECTION:FINAL_SUMMARY:END -->
