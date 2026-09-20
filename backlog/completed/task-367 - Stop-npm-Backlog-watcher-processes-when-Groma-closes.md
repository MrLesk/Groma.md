---
id: TASK-367
title: Stop npm Backlog watcher processes when Groma closes
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 09:01'
updated_date: '2026-09-13 09:06'
labels: []
dependencies: []
references:
  - backlog-plugin
modified_files:
  - plugins/work-sources/backlog/src/index.ts
  - test-bun/backlog-lifecycle.test.ts
type: bug
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The npm Backlog launcher starts a native child. On macOS killing only the launcher leaves the native watch process running and shutdown waiting for inherited pipes. Direct native execution closes correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Closing a Backlog subscription stops its launcher and native child and resolves shutdown.
- [x] #2 Direct watchers still close and concurrent subscriptions do not stop one another.
- [x] #3 A regression test covers a launcher and native child arrangement.
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
Give each Unix watch subscription its own process group and terminate that group on close; preserve the existing Windows tree shutdown. Verify wrapper and direct execution independently.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two concurrent process-lifecycle regression tests pass. Actual Backlog 1.52.0 native and npm launcher subscriptions both close: 3 ms and 2 ms respectively, with no orphan watcher.

Flattened process termination out of the close state guard after Biome reported excessive cognitive complexity.

Specification and quality review: only watch subprocesses receive a Unix process group, and close terminates only that subscription. Direct and wrapper-child tests run concurrently and verify another subscription stays alive. Actual npm Backlog 1.52.0 closes in 2 ms; direct native in 3 ms. No public interface change or additional documentation needed for this lifecycle correction. Full bun run check passes with no lint warnings, 16 Node tests and 282 Bun tests; 6 existing native-tool tests skipped.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Specification and quality review: only watch subprocesses receive a Unix process group, and close terminates only that subscription. Direct and wrapper-child tests run concurrently and verify another subscription stays alive. Actual npm Backlog 1.52.0 closes in 2 ms; direct native in 3 ms. No public interface change or additional documentation needed for this lifecycle correction. Full bun run check passes with no lint warnings, 16 Node tests and 282 Bun tests; 6 existing native-tool tests skipped.
<!-- SECTION:FINAL_SUMMARY:END -->
