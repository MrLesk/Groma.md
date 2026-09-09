---
id: TASK-330
title: Fix intermittent Windows scanner test timeouts
status: In Progress
assignee:
  - '@windows_ci'
created_date: '2026-09-09 21:16'
updated_date: '2026-09-09 21:18'
labels:
  - testing
  - scanner
dependencies: []
references:
  - scan-lifecycle
  - 'https://github.com/MrLesk/Groma.md/actions/runs/34405453834'
documentation:
  - docs/scanners/vue/validation.md
modified_files:
  - test-bun/vue-scanner.test.ts
priority: high
type: bug
ordinal: 376000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When developers run the repository CI, the supported scanner watch scenarios must complete reliably on Windows without rerunning a failed job until it happens to pass. CI run 34405453834 at d8028d50ff0962038261209008c00620a1a5613f failed only the Vue SFC source/template edit and failed-scan preservation scenario after 20000 ms. An identical Vue timeout was observed before the component naming change; the stalled stage and cause remain unknown. Investigate the observed timeout, establish its cause with stage-level evidence, and fix the smallest responsible test or product lifecycle path. Preserve actual file-change delivery, complete scans, map preservation on failed analysis, cleanup, and concurrent independent tests. Earlier Windows live-source watcher failures are relevant comparison evidence if they share the same demonstrated cause. Do not hide failures with retries, longer timeouts, skipped assertions, Windows exclusions, or reduced concurrency. Keep the regular CI topology unchanged unless a concrete diagnostic or workflow change is separately approved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The stalled stage and root cause of the observed Windows timeout are supported by diagnostic or reproduction evidence, with a clear distinction between cause and hypothesis.
- [ ] #2 The supported Vue source and template edits, watched rescan, failed-analysis map preservation, and cleanup complete reliably after the fix, preserving the same observable behavior.
- [ ] #3 A focused regression check exercises the identified cause; repeated affected-scenario verification on one fixed Windows revision passes without retries, timeout increases, skipped behavior, or reduced test concurrency.
- [ ] #4 The change uses the existing domain owner and preserves test isolation, lifecycle cleanup, and scanner ownership; runner or watcher lifecycle changes are checked against official documentation for the installed versions.
- [ ] #5 Focused checks, the complete repository check, required simplicity reviews, and final CI on macOS, Linux, and Windows pass; the evidence and remaining limits are recorded.
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
1. Trace the unchanged Vue test lifecycle and compare timeout logs with stage-level timing on the actual supported scenario.
2. Establish Windows-native reproduction evidence and separate confirmed cause from hypotheses; report the smallest fix before material changes.
3. Implement only the responsible lifecycle or test correction, preserving existing assertions, concurrency, timeout and CI topology.
4. Run focused regression and scenario checks, coordinate fixed-revision Windows verification and full repository checks with the root agent, then perform specification and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added temporary stage timings to the existing Vue watch scenario without changing its operations, assertions, concurrency or timeout. Focused local run passed 4 tests and 27 assertions. Timing log /tmp/groma-task330-vue-stages-local.log showed setup 1.083s, three direct scans complete 1.877s, watch ready 1.879s, fold 2.177s, closed 2.178s, rejected malformed-source scan 2.181s to 8.067s, cleanup 8.084s. Windows diagnostics will use the existing CI workflow; this run gathers failure-stage evidence and is not validation of a fix.
<!-- SECTION:NOTES:END -->
