---
id: TASK-465
title: Reduce CI time with cached Swift builds and isolated test workers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 16:49'
updated_date: '2026-09-20 17:43'
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
- [x] #1 CI reuses a Swift test package only when the operating system, CPU, toolchain and package inputs match; changed inputs rebuild it.
- [x] #2 Linux, macOS and Windows retain the complete repository check and standalone binary build, with the existing test assertions, isolation and timeouts.
- [x] #3 An actual CI run proves the cache-miss build and a subsequent run proves cache-hit reuse; report measured durations and any remaining gap to the 2–3 minute target.
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
1. Cache the built Swift test package in the existing CI matrix using an exact key covering OS/CPU, Bun version, Swift toolchain setup, scanner sources/build/manifest, shared scanner contract and source helpers, dependency lockfile, documentation and licenses. Use no restore prefixes.
2. Run Swift setup and compilation only on a cache miss. Retain every repository check, the Linux/macOS/Windows jobs, the standalone build and the unchanged release workflow.
3. Run the Bun suite in two isolated file workers with one active test case per worker. This keeps the previous overall two-case concurrency budget while allowing separate files to progress in parallel. Keep every scenario, assertion, fixture and 20-second timeout. Document file isolation and the total concurrency limit.
4. Test authority is the requested faster CI with complete checks retained. No new domain rule or missing behavioral coverage exists, so add no tests. Validate the workflow and cache inputs, run bun run check, then measure native cache-miss and cache-hit runs. All four Swift tests must run in both states. Investigate failures rather than retrying or relaxing assertions or timeouts.
5. Perform implementer specification/quality review and the requested full-context complexity review. Finalize and commit/push only owned files in shared main. Preserve unrelated documentation and other agents' changes. Do not release, tag or publish packages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline Windows run 35518618384: Swift setup 87s, Swift package 772s, check 200s; Bun suite 190.33s. Linux check 90s; macOS check 100s. Cache YAML validated locally: only Swift setup/build are conditional, with exact-key matching and the original full check/platform matrix retained. Bun version and declared packageManager both equal 1.4.1; --parallel=2 and isolation behavior verified against the official versioned docs and local help.

The isolated-file experiment passed with the exact same 621 pass, 36 expected skips and 2128 assertions. Two workers reduced local Bun suite time from 79.68s to 48.34s (about 39%). No test sources or assertions changed. Cache-only full check also passed: 16 Node, 621 Bun, zero failures.

Final local bun run check passed after enabling --parallel=2: 16 Node tests and 621 Bun tests, 36 existing optional skips, zero failures, 2128 Bun assertions; Bun suite 39.66s. Only the two pre-existing complexity warnings remain. The code diff is 15 workflow lines, one runner flag, and concise documentation. Repository version remains 0.3.3 and release metadata changes have been undone. Native CI cache-miss/cache-hit validation is next; task remains In Progress until that evidence is available.

Candidate 54c24351 pushed to shared main with only this task files; the separate TASK-464 fixture fix 8c009627 was pushed alongside it. Native cold CI 35524252313 has passed macOS in 1m44s (check 68s) and Linux in 3m30s (Swift setup 47s, build 59s, check 94s). Both exact-key caches are saved. Windows is still performing its first Swift build.
Implementer specification review: the existing three-OS matrix, all checks, standalone build, test assertions/timeouts and per-file fixture ownership remain. Cache keys include every input read or bundled by the Swift builder: toolchain setup, Swift directory, project-files helper, scanner contract, package docs, lockfile and license, plus OS/CPU/Bun. Cache reuse and final native timing remain pending; completion is not claimed.
Implementer quality review traced checkout -> exact cache -> missing-package build -> existing full check with two isolated file workers -> binary build -> successful cache save. No production scanner or release-flow behavior changed, no stale cache prefix is accepted, and no extra test infrastructure or test assertions were added. Package version remains 0.3.3. The four-file change has one owner per setting and no further task-scoped simplification was found. A cold simplicity agent is not required for this small configuration change.

Full-context complexity review completed after the implementer reviews: keep the implementation; no blocking findings or material simplifications. The reviewer traced the exact-cache restore, conditional Swift build, full checks and standalone build, and confirmed clear ownership in the workflow, Swift builder and package test command. Native Windows cold completion and warm timing remain the final verification gate.

Native cold run 35524252313 built Swift and passed all four Swift tests on Windows, but the full suite failed two existing large-world tests: arrow navigation reachability and viewport painting both exceeded the unchanged 20-second limit (23.7s). The previously green Windows baseline took 15.9s for these cases. Linux and macOS passed. Investigating the fixture and execution difference before choosing a correction; no timeout, assertion, scenario or retry relaxation is authorized.

Profiling isolated the timeout cost to large-world sheet routing during shared fixture preparation (572 routes, about 4.7s locally). Three bounded queue-storage experiments preserved complete serialized scene output for large-world, viewer-view and openclaw-view; existing focused checks passed, but timing improvements were too small to justify touching production routing. All route-search edits were restored exactly to HEAD; no map or routing change remains. The difference introduced by file workers is up to four active cases instead of the prior two. Testing two isolated file workers with one active case each to preserve the prior overall concurrency budget without weakening scenarios, assertions or timeouts.

The complete suite with two file workers and one active case per worker passed: 621 pass, 36 expected skips, zero failures and 2128 assertions in 47.44s, versus the original serial-file 79.68s. Adopt --parallel=2 --max-concurrency 1 while retaining the 20000ms timeout. This keeps at most two active test cases overall and changes no test source, fixture or assertion. Native Windows must confirm the reduced contention.

Balanced final command passed bun run check: 16 Node tests, 621 Bun tests, 36 existing optional skips, zero failures and 2128 assertions; Bun suite 46.97s. Implementer specification/quality re-review is limited to the native timeout correction: two isolated file workers with one active case each retain the prior maximum of two active cases across the suite. All test sources, assertions, fixtures and 20-second limits remain unchanged; production routing matches HEAD exactly. Documentation states the final concurrency limit. Native verification remains pending, and a targeted full-context re-review is requested for this correction.

Correction commit 4807c353 is pushed to shared main. Targeted full-context re-review confirmed the two-case overall limit is the simplest sound response to the observed contention; no blocking findings. Native CI run 35525683776 is validating the correction. Linux/macOS should reuse their existing exact caches; Windows still needs its first successfully cached build.

Native correction run 35525683776: cached Linux passed in 1m09s (621 Bun pass, 36 skips, zero failures, 54.07s suite); cached macOS passed in 1m43s. Both restored their exact Swift package caches, skipped Swift setup/build, and passed all four Swift tests plus the standalone build. On Linux the formerly slow large-world reachability case fell from 21.8s with four active cases to 9.15s with two. Windows is still building its uncached Swift package.

Windows cold validation passed on 4807c353: job 14m46s, Swift setup 105s, package build 595s, repository check 152s, standalone build 2s. All 616 applicable Windows Bun tests passed with 41 existing platform skips, 2082 assertions and no failures; all four Swift tests ran. Large-world reachability passed in 16.37s and viewport painting in 20ms. The exact Windows package cache was saved (29.8 MB). Attempt 2 of run 35525683776 is now measuring the same commit with cache hits; all three OSes skipped Swift setup and build.

Final native verification: https://github.com/MrLesk/Groma.md/actions/runs/35525683776, attempt 2 at exact commit 4807c353, passed all three jobs with exact Swift cache hits. Windows: 3m00s; macOS: 2m23s; Linux: 2m01s. Swift setup and package compilation were skipped on every host, while every repository check, all four Swift package tests and the standalone binary build passed. Linux/macOS retained 621 pass, 36 expected skips and 2128 assertions; Windows retained 616 pass, 41 platform skips and 2082 assertions. Zero failures everywhere.
AC1 evidence: native cache misses built packages and saved exact OS/CPU/Bun/input keys; subsequent restores used those exact keys with no restore prefixes. Input coverage was checked against the existing builder and official cache behavior. AC2 evidence: final native step outcomes and test logs preserve the full three-host checks, assertions, fixtures, isolation and 20-second limits. AC3 evidence: successful Windows cold run was 14m46s; the same commit with all caches warm completed its slowest job in 3m00s, versus the earlier 18m16s baseline. Linux/macOS warmed earlier at 1m09s/1m43s and at 2m01s/2m23s in the final attempt, showing normal runner variation.
The measured cached run reaches the approximately 2–3 minute target. Cold Windows compilation still takes several minutes after relevant Swift/package inputs change or cache eviction; this change does not promise a three-minute cold build or a fixed runner duration. Both requested reviews and the targeted timeout-correction review are complete with no blocking findings. All 11 protected pending files still match their original hashes, and the production-routing experiment is fully reverted. No release, tag, version bump or package publication was made.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reduced ordinary CI by caching the complete Swift test package with exact input keys and running the unchanged Bun suite in two isolated file workers, one case per worker. Updated contributor and Swift CI documentation.

Verified bun run check locally and native cold/cache-hit behavior in run 35525683776. Final cached jobs: Windows 3:00, macOS 2:23, Linux 2:01; all checks, standalone builds and four Swift tests passed on every OS. The previous slowest job was 18:16. Fresh Windows Swift builds remain slow when the cache must be rebuilt. No test assertions or timeouts were weakened, and no production code changed.

Committed only task-owned changes in shared main. Preserved the existing documentation and other agents' edits. Nothing released.
<!-- SECTION:FINAL_SUMMARY:END -->
