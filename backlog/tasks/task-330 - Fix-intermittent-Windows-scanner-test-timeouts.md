---
id: TASK-330
title: Fix intermittent Windows scanner test timeouts
status: In Progress
assignee:
  - '@windows_ci'
created_date: '2026-09-09 21:16'
updated_date: '2026-09-09 21:42'
labels:
  - testing
  - scanner
dependencies: []
references:
  - scan-lifecycle
  - 'https://github.com/MrLesk/Groma.md/actions/runs/34405453834'
  - adapter
  - java-scanner-build
  - web-server
documentation:
  - docs/scanners/vue/validation.md
modified_files:
  - test-bun/vue-scanner.test.ts
  - test-bun/java-scanner.test.ts
  - src/scanner.ts
  - test-bun/web-startup.test.ts
  - .github/workflows/ci.yml
  - test-bun/scanner-watch.test.ts
priority: high
type: bug
ordinal: 376000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When developers run the repository CI, the supported scanner watch scenarios must complete reliably on Windows without rerunning a failed job until it happens to pass. CI run 34405453834 at d8028d50ff0962038261209008c00620a1a5613f failed only the Vue SFC source/template edit and failed-scan preservation scenario after 20000 ms. An identical Vue timeout was observed before the component naming change; the stalled stage and cause remain unknown. Investigate the observed timeout, establish its cause with stage-level evidence, and fix the smallest responsible test or product lifecycle path. Preserve actual file-change delivery, complete scans, map preservation on failed analysis, cleanup, and concurrent independent tests. Earlier Windows live-source watcher failures are relevant comparison evidence if they share the same demonstrated cause. Do not hide failures with retries, longer timeouts, skipped assertions, Windows exclusions, or reduced concurrency. Keep the regular CI topology unchanged unless a concrete diagnostic or workflow change is separately approved. Diagnostic run 34406164910 also reproduced timeouts in both Java compiler success/rejection tests and failure of the empty-project live-map scan. These supported CI failures are in scope; investigate their causes separately until evidence establishes a connection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The stalled stage and root cause of the observed Windows timeout are supported by diagnostic or reproduction evidence, with a clear distinction between cause and hypothesis.
- [ ] #2 The supported Vue source and template edits, watched rescan, failed-analysis map preservation, and cleanup complete reliably after the fix, preserving the same observable behavior. The Java compiler success/rejection scenarios and empty-project live-map scan also complete with their original observable behavior and cleanup.
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

The failed baseline locates the source-event gap after subscription readiness and before any rescan. Use synchronous Windows native source registration through Bun fs.watch in scan-lifecycle while retaining Parcel on other platforms. Keep original async assertions and diagnostics for the controlled Windows comparison, and add a direct immediate-first-source-edit regression.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added temporary stage timings to the existing Vue watch scenario without changing its operations, assertions, concurrency or timeout. Focused local run passed 4 tests and 27 assertions. Timing log /tmp/groma-task330-vue-stages-local.log showed setup 1.083s, three direct scans complete 1.877s, watch ready 1.879s, fold 2.177s, closed 2.178s, rejected malformed-source scan 2.181s to 8.067s, cleanup 8.084s. Windows diagnostics will use the existing CI workflow; this run gathers failure-stage evidence and is not validation of a fix.

Diagnostic run 34406164910 (f0bde5b) failed both Java compiler scenarios at 20 seconds and the empty-project live-map scenario after 10.4 seconds (generation 1; only index.md/project.md). Vue passed in 11.825 seconds: subscribe ready 6.309s, source write 6.310s, fold 7.725s, close 7.726s, failed scan 7.744–11.778s. Local TypeScript API timing attributed a 5.412s rejected-scan delay partly to pending async API work and close (1.9s). An external controlled test copy awaiting the scan before error assertions reduced that stage to 169ms. Bun 1.4.1 expect.rs process_promise still invokes wait_for_promise; upstream issue 33261 identifies nested-loop hangs with asynchronous matchers and concurrent subprocess I/O. This is a supported hypothesis, not yet the proven Windows cause. Second diagnostic revision adds temporary Java stages, selected native watcher traces, and empty-project write timing; all original assertions and operations remain unchanged.

Alex explicitly approved the prepared temporary Windows repetition step. The existing CI job now runs the same Java, Vue, and web-startup files with Bun 1.4.1 --rerun-each=10 --timeout=20000 --bail=1 after installation. No retry, concurrency override, new job, dependency, or permanent topology change was added. Installed-runner witnesses verified ten total executions, nonzero exit despite later passing repetitions, and immediate failure on the first bad repetition with --bail=1. The step is diagnostic and must be removed before final delivery. Original async assertions remain unchanged for this baseline.

Windows baseline 34407681352 at a2f282d failed Vue repetition 8: all sibling tests finished by 4545ms; watch ready 6898ms; template write 6899ms; no native callback before timeout 20162ms. The rejection matcher had not run, ruling it out as the direct cause of this failure. Parcel 2.6.0 WindowsBackend::subscribe queues first ReadDirectoryChangesW via QueueUserAPC and returns without waiting. Bun 1.4.1 win_watcher.rs starts uv_fs_event_start synchronously; its pinned oven-sh/libuv 8023581113b276e7c1aee3f82da57ca0893faab1 calls ReadDirectoryChangesW before returning. Approved correction uses that existing Windows runtime path only in watchScan. It preserves skipped root/file matching, settling, one scan owner, errors, and waiting for watcher close plus active scanning. Architecture watching stays unchanged. Local focused checks passed 15 tests, one existing Maven skip, across Java/Vue/web startup/new immediate-write regression in 3.82s; changed-file lint and typecheck passed. Source review found no blocking defect or new domain concept; OKF/C4 representation is unchanged and scan-lifecycle retains ownership. Windows execution is still required; temporary traces and repetition step remain.
<!-- SECTION:NOTES:END -->
