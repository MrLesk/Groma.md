---
id: TASK-310
title: Ship Apple Silicon only on macOS
status: Done
assignee:
  - '@alex'
created_date: '2026-09-06 17:57'
updated_date: '2026-09-06 18:02'
labels:
  - release
  - ci
dependencies:
  - TASK-309
references:
  - scripts/npm/cli.cjs
  - .github/workflows/release.yml
  - CONTRIBUTING.md
modified_files:
  - scripts/npm/cli.cjs
  - test-bun/npm-cli.test.ts
  - .github/workflows/release.yml
  - CONTRIBUTING.md
  - README.md
ordinal: 348000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stop publishing an Intel Mac binary. Release and npm install support Apple Silicon on macOS, plus the existing Linux and Windows x64/arm64 packages. The npm wrapper refuses Intel Macs with an unsupported-architecture error instead of resolving groma.md-darwin-x64. Do not ship a universal Darwin binary.

Follows TASK-309, which published six platform packages including groma.md-darwin-x64.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Release CI no longer builds, uploads, or publishes bun-darwin-x64 or groma.md-darwin-x64.
- [x] #2 The npm wrapper never resolves groma.md-darwin-x64. Intel Macs receive an unsupported-architecture error and a non-zero exit without spawning a binary.
- [x] #3 Apple Silicon still resolves groma.md-darwin-arm64 when Node reports x64 under Rosetta, so those Macs are not treated as Intel.
- [x] #4 Published-platform documentation states that macOS requires Apple Silicon and that Intel Macs are unsupported.
- [x] #5 Automated tests cover wrapper architecture selection, including the Intel refusal, and bun run check passes.
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
1. Drop the Darwin x64 release/build/publish matrix entries and the groma.md-darwin-x64 optional dependency. 2. Resolve only groma.md-darwin-arm64 on macOS; treat darwin/x64 without Apple Silicon hardware as an unsupported Intel Mac. 3. Detect Apple Silicon with hw.optional.arm64 so a Rosetta Node still gets the arm64 package. 4. Document Apple Silicon-only macOS support. 5. Add concurrent wrapper tests and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dropped bun-darwin-x64 / groma.md-darwin-x64 / macos-15-intel from the release matrix and wrapper optionalDependencies. macOS now ships only groma.md-darwin-arm64. The npm wrapper resolves that package for darwin/arm64 and for darwin/x64 when hw.optional.arm64 is 1 (Rosetta Node on Apple Silicon). Intel Macs get "groma.md does not support Intel Macs (darwin/x64)." and runWrapper returns spawned:false without calling spawn.

Specification review: AC1 command assertion found no bun-darwin-x64, groma.md-darwin-x64, or macos-15-intel in release.yml or cli.cjs, and retained groma.md-darwin-arm64. AC2 wrapper tests prove Intel has no package, the Intel error, and spawn is not called. AC3 Rosetta x64 + Apple Silicon resolves groma.md-darwin-arm64. AC4 README and CONTRIBUTING state Apple Silicon-only macOS. AC5 bun test test-bun/npm-cli.test.ts 7/7; bun run check 108 Node and 340 Bun tests, six pre-existing complexity warnings, git diff --check clean.

Quality review: no fat binary, no Darwin x64 fallback package, no SIGILL handling. Hardware probe is only hw.optional.arm64 with stderr ignored. Linux and Windows x64/arm64 unchanged. README already had an unrelated uncommitted rewrite; this task added the two-line macOS support note in Get started.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
macOS releases now ship only groma.md-darwin-arm64. Intel Macs get an unsupported-architecture error without a Darwin x64 package or fat binary; Apple Silicon still uses the arm64 package under Rosetta Node. Verified with wrapper tests (7/7), a release-artifact assertion, and bun run check (108 Node, 340 Bun).
<!-- SECTION:FINAL_SUMMARY:END -->
