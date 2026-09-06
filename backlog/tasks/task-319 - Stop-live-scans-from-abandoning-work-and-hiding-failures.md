---
id: TASK-319
title: Stop live scans from abandoning work and hiding failures
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 21:51'
updated_date: '2026-09-06 21:55'
labels: []
dependencies: []
references:
  - web-server
  - scanner-modules
modified_files:
  - src/scanner/registry.ts
  - src/viewers/web/map-session.ts
  - test-bun/web-task-live.test.ts
  - src/viewers/web/server.ts
  - test-bun/scanner-modules.test.ts
  - groma/relationships.md
ordinal: 357000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three CI failures on main share one theme: watcher and scanner lifecycles racing test teardown.

1. Ubuntu, `test-bun/web-task-live.test.ts`: "Unhandled error between tests: Unable to remove watcher: Invalid argument". The test calls `server.close()` without awaiting it, then removes the repository; inotify drops the watch with the directory and Parcel's later `unsubscribe` fails with EINVAL as an unhandled rejection.
2. Windows, `web-startup.test.ts` "a loading browser reaches the actual failure when startup rejects": `EBUSY` removing the repository right after the server closed. `collectObservations` runs scanners with `Promise.all`; when the paused scanner rejects, the TypeScript scanner's `git -C <root> ls-files` child is still running with the repository as its working directory, which locks the directory on Windows. A failed scan currently leaves other scanners running.
3. Windows, `web-startup.test.ts` live-scan test: with the added diagnostics the failure reads "generation 1; groma/ holds index.md, project.md", so no rescan ever folded. `groma web` passes no `onError` to `watchScan`, so a failed live rescan is silently dropped; `export --watch` and `scan --watch` print it. Whether the rescan threw or the source event never arrived cannot be told until the web session reports errors too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A scan that fails waits for every scanner before rejecting, so no scanner child process outlives `scanRepository`
- [x] #2 `groma web` prints a failed live rescan to stderr like `export --watch` and `scan --watch` do
- [x] #3 `web-task-live.test.ts` awaits server shutdown before removing the repository
- [x] #4 `bun run check` passes
- [x] #5 Closing the web viewer while its map is still being prepared waits for that preparation and closes the resulting map
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root causes, each confirmed from code:
- `web-task-live.test.ts` did not await `server.close()` before removing the repository. inotify drops a watch with its directory, so Parcel's later `unsubscribe` failed with EINVAL as an unhandled rejection between tests (Ubuntu run 34061616815). Fixed by awaiting the close.
- `collectObservations` used `Promise.all`; the first rejection returned while other scanners still ran. In the paused-scanner startup test the TypeScript scanner's `git -C <root> ls-files` child was still alive with the repository as working directory, which on Windows locks it and made the teardown `rm` fail with EBUSY (Windows run 34061805524). Now `Promise.allSettled` waits for every scanner and rethrows the first failure. New test: a failing scanner rejects only after a slower sibling has finished.
- `startWebViewer.close()` closed `map` without waiting for a still-running `openMap`, so a map finishing after close leaked its watchers. It now awaits `preparing` first.
- `groma web` passed no `onError` to `watchScan`, silently dropping failed live rescans while `export --watch` and `scan --watch` print them. It now prints the message to stderr, which also makes the remaining Windows live-scan failure diagnosable: the run showed "generation 1; groma/ holds index.md, project.md", so either the rescan threw (now visible) or the event never arrived.

Known remaining Windows risk, not fixed here: Parcel's `WindowsBackend::subscribe` only queues an APC and returns; `ReadDirectoryChangesW` is armed later on the backend thread, and Windows records changes only from that first call. A file written between `subscribe()` resolving and the APC running is lost. FSEvents and inotify arm synchronously, so this is Windows-only and needs an upstream fix or a Parcel snapshot catch-up.

`bun run check`: Node 110 pass, Bun 343 pass.
<!-- SECTION:NOTES:END -->
