---
id: TASK-465
title: Reduce CI time with cached Swift builds and isolated test workers
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-20 16:49'
updated_date: '2026-09-20 16:55'
labels: []
dependencies: []
modified_files:
  - .github/workflows/ci.yml
  - docs/scanners/swift/index.md
  - package.json
  - CONTRIBUTING.md
priority: high
type: enhancement
ordinal: 541000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested reducing ordinary CI from about 18 minutes toward 2–3 minutes. The successful Windows job in run 35518618384 spent 772 seconds rebuilding the Swift test package, 87 seconds installing Swift, and 200 seconds running the repository check. Windows packages build pinned SwiftSyntax sources because the toolchain omits parser development modules. Ordinary CI repeats this build for every commit even when all package inputs are unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI reuses a Swift test package only when the operating system, CPU, toolchain and package inputs match; changed inputs rebuild it.
- [ ] #2 Linux, macOS and Windows retain the complete repository check and standalone binary build, with the existing test assertions, isolation and timeouts.
- [ ] #3 An actual CI run proves the cache-miss build and a subsequent run proves cache-hit reuse; report measured durations and any remaining gap to the 2–3 minute target.
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
1. Add an exact-key cache to the existing CI matrix for the built Swift test package. Include runner OS/CPU, Bun version, Swift toolchain setup, scanner sources/build/manifest, shared scanner contract and source-file helpers, dependency lockfile, and package documentation/licenses in the key. No restore prefixes.
2. Run Swift setup and package compilation only when that exact cache is absent; continue to run every existing check and the standalone build. Leave the release workflow unchanged.
3. Test authority: the user requested faster CI with its supported checks preserved. No new domain rule or missing behavioral coverage exists, so add no tests. Validate YAML and key input coverage locally, run bun run check, then measure real cold and warm CI on the same commit. Cache reuse must still pass all four Swift package tests.
4. Perform implementer specification/quality review and the requested full-context complexity review. Finalize and commit/push only owned files; leave the user documentation and architecture edits untouched. No release, tag or npm publication.

After the cache, investigate the remaining 190-second Windows Bun suite with the installed Bun 1.4.1 file-parallel runner. The installed help and official bun-v1.4.1 docs distinguish --parallel=2 (two isolated file workers) from --max-concurrency=2 (two concurrent tests inside each file). Measure the complete existing suite before changing its command. Keep the same jobs, tests, timeouts, reports and within-file limit; no sharding, retries or assertions change.

Local measurement passed all 621 tests and 2128 assertions with two isolated file workers: 48.34s versus 79.68s serial-file baseline. Add --parallel=2 to the existing test:viewer command while retaining --max-concurrency 2 and --timeout 20000. This changes no CI jobs or coverage boundaries. Document the difference between file workers and within-file concurrency in CONTRIBUTING.md, then verify the complete check and native CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline Windows run 35518618384: Swift setup 87s, Swift package 772s, check 200s; Bun suite 190.33s. Linux check 90s; macOS check 100s. Cache YAML validated locally: only Swift setup/build are conditional, with exact-key matching and the original full check/platform matrix retained. Bun version and declared packageManager both equal 1.4.1; --parallel=2 and isolation behavior verified against the official versioned docs and local help.

The isolated-file experiment passed with the exact same 621 pass, 36 expected skips and 2128 assertions. Two workers reduced local Bun suite time from 79.68s to 48.34s (about 39%). No test sources or assertions changed. Cache-only full check also passed: 16 Node, 621 Bun, zero failures.

Final local bun run check passed after enabling --parallel=2: 16 Node tests and 621 Bun tests, 36 existing optional skips, zero failures, 2128 Bun assertions; Bun suite 39.66s. Only the two pre-existing complexity warnings remain. The code diff is 15 workflow lines, one runner flag, and concise documentation. Repository version remains 0.3.3 and release metadata changes have been undone. Native CI cache-miss/cache-hit validation is next; task remains In Progress until that evidence is available.
<!-- SECTION:NOTES:END -->
