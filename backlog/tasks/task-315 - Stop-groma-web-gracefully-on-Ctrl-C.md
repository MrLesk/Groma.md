---
id: TASK-315
title: Stop groma web gracefully on Ctrl-C
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 20:53'
updated_date: '2026-09-06 20:56'
labels: []
dependencies: []
modified_files:
  - src/cli.ts
  - test-bun/web-shutdown.test.ts
ordinal: 353000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer running `groma web` in a terminal presses Ctrl-C (or the process receives SIGTERM). Today nothing in Groma handles the signal: the runtime kills the process outright and the HTTP server, live event stream clients, and file watchers are torn down by the operating system rather than closed by Groma. `groma export --watch` and `groma scan --watch` already close their resources and exit on these signals; `groma web` must do the same through the `close()` that `startWebViewer` already returns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sending SIGINT to a running `groma web` process closes the server and exits with code 0, and the port accepts a new listener afterwards
- [x] #2 SIGTERM behaves the same as SIGINT
- [x] #3 `groma web` started through the next-available-port path shuts down the same way
- [x] #4 The signal handling shared by `groma web`, `groma export --watch`, and `groma scan --watch` lives in one helper in `src/cli.ts`
- [x] #5 `bun run check` passes
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
1. Add `stopOnSignal(close)` to `src/cli.ts`: register once-only SIGINT/SIGTERM handlers that unregister themselves, await `close()`, then `process.exit()`. It returns nothing; the resources being closed keep the event loop alive until then.
2. `openWeb`: keep the viewer returned by `startWebViewer` / `startWebOnNextPort` and call `stopOnSignal(() => viewer.close())`.
3. `exportWeb` and `runScan`: replace their inline handlers with the helper.
4. Test in `test-bun/web-shutdown.test.ts`: spawn `src/cli.ts web --port <free>` on a fixture repository, wait for `/ready`, send SIGINT (and SIGTERM in a second case), assert exit code 0 and that the port can be bound again.
5. `bun run check`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `test-bun/web-shutdown.test.ts` spawns `src/cli.ts web` on a fixture repository, waits for `/ready`, sends SIGINT or SIGTERM, and asserts exit 0 plus a rebindable port; both cases fail against the previous `cli.ts` (process killed by the signal, non-zero exit) and pass with the change. `groma scan --watch` still stays alive without its blocking promise: the watcher keeps the event loop running, and SIGINT ends it. Compiled `dist/groma web` exits 36 ms after SIGINT. `bun run check`: 342 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`groma web` now registers SIGINT/SIGTERM handlers through a shared `stopOnSignal` helper in `src/cli.ts`, closes the server, live clients, and watchers via the `close()` `startWebViewer` already returned, and exits 0. `export --watch` and `scan --watch` use the same helper. Verified by a new Bun test that signals a spawned `groma web` and by `bun run check`.
<!-- SECTION:FINAL_SUMMARY:END -->
