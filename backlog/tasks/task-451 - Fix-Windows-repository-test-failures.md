---
id: TASK-451
title: Fix Windows repository test failures
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 10:23'
updated_date: '2026-09-20 10:52'
labels: []
dependencies: []
references:
  - java-src-index
  - src-index
  - runtime
  - swift-src-index
modified_files:
  - test-bun/java-gradle.test.ts
  - .github/workflows/ci.yml
  - package.json
  - docs/scanners/swift/validation.md
type: bug
ordinal: 523000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The ordinary Windows CI run 35473844959 failed in an existing Java Gradle path assertion and timed out in the Python ownership and repeat-scan test. Alex explicitly requested fixing both failures while publishing the qualified Swift package. Preserve source-analysis behavior, assertions, concurrent test isolation and existing time limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Java Gradle test verifies the same discovered directories with native Windows and Unix path separators.
- [x] #2 The Python ownership and repeated-scan scenario completes within the existing time limit in the complete Windows suite, with its assertions and independent fixtures preserved.
- [x] #3 The complete repository check passes on Windows, Linux and macOS, and the investigation and actual results are recorded.
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
1. Keep the existing Java Gradle discovery test and compare its expected nested directory using path.join. The reproduced Windows failure rejected the correct directory solely because the expected separator was Unix-specific; the existing seven tests provide sufficient coverage.
2. Bound concurrent tests to two in the existing test:viewer command. Native Windows profiling identifies concurrent Python interpreter startup as the cost: ownership takes 17.03s at four concurrent cases and 7.94s at two; the whole Python file takes about 26s either way. Preserve test.concurrent, independent packages and fixtures, all assertions, and the 20-second limit. Existing Python tests cover the supported result; no new test is needed.
3. Verify the final two-line change with focused Java checks and the complete repository check on Windows, Linux and macOS. Remove temporary diagnostic workflow code and record observed results. No scanner behavior, OKF metadata or C4 boundary changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Temporary native Windows diagnostic run 35505152125 compares the existing Python ownership case alone, then all Python cases with concurrency 4 and 2. It records package-build, fixture-setup and scanner-call durations without changing assertions or timeouts. The Java path expectation now uses path.join; its existing seven tests pass locally (43 assertions). Bun 1.4.1 is both declared and installed. Its CLI and official parallel/lifecycle documentation distinguish within-file test.concurrent from separate process-level --parallel; no file-parallel option is being added. The temporary workflow instrumentation will be removed before final validation.

Windows diagnostics 35505152125 passed and exposed CPU contention: ownership alone 5.95s, four concurrent cases 17.03s, two concurrent cases 7.94s. Its two scan calls took 9.20s and 7.60s at concurrency four, versus 3.92s and 3.84s at two. Full-file wall time was 25.5s and 25.9s respectively. Runner: 4 logical CPUs, 16 GB RAM, Bun 1.4.1. The previous complete-suite timeout was 20.16s. Correct the execution cap, then verify the whole suite; do not weaken the scenario or increase the timeout.

Implemented the measured cap of two and native Java path expectation; removed all temporary workflow instrumentation. Full local bun run check passed: 16 Node tests, 601 Bun tests, 36 optional skips, zero failures. Commits 79411c5d and 8f7285f9 are pushed on codex/swift-cross-platform. Complete three-OS validation is running at https://github.com/MrLesk/Groma.md/actions/runs/35505469431. The permanent change is two existing lines, with no new tests, assertions, fixtures or scanner behavior.

Implementer quality review: the final flow is package.json test:viewer -> Bun within-file scheduling -> existing independent tests. The cap controls CPU contention without serializing tests or changing their contract. The Java assertion still rejects missing/extra directories; only native separator construction changes, so harmless wording and implementation refactors remain unconstrained. The temporary diagnostic workflow is fully removed. There are no new cases, fixtures, runtime abstractions or production changes. This bounded two-line test-runner fix uses the implementer's own review; no separate architecture reviews are required. Linux/macOS final CI checks passed; Windows is executing the full suite. TASK-444's owner is carrying these same two corrections into its user-approved PR108 merge and will preserve the cap.

Final CI run https://github.com/MrLesk/Groma.md/actions/runs/35505469431 passed on Windows, Linux and macOS at 8f7285f9. Windows: 16 Node tests, 596 Bun passes, 41 existing optional skips, zero failures; the formerly failing Java case took 128.78ms and Python ownership/repeat-scan case took 6.75s within the unchanged 20s limit. Linux and macOS each passed 601 Bun tests with 36 optional skips, plus their Node suites. All three standalone binary builds passed. No retry was needed for this final run. Swift validation documentation now links the passing full Windows result.

Specification review: AC1 is proven by the existing Windows Gradle scenario and the Unix suites; AC2 by the complete Windows suite with the unchanged ownership and repeatability assertions; AC3 by the successful three-host workflow and full local check. Quality review confirms the only lasting implementation changes are native path construction in one expectation and the concurrency cap in one command. The workflow diagnostics were removed; no added test cases, changed timeouts, removed assertions or production scanner behavior. Documentation and task notes describe the final flow and evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the Windows Gradle assertion to expect native path separators and reduced within-file test concurrency to two after measuring Python interpreter startup contention. All assertions, independent fixtures and 20-second limits remain. Full CI 35505469431 passed checks and standalone builds on Windows, Linux and macOS; the Windows Python case now completes in 6.75 seconds. The permanent fix changes two existing lines; temporary diagnostics were removed.
<!-- SECTION:FINAL_SUMMARY:END -->
