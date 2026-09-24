---
id: TASK-500
title: Stop the Backlog watcher when Groma closes
status: To Do
assignee: []
created_date: '2026-09-23 19:25'
updated_date: '2026-09-23 19:32'
labels: []
dependencies: []
references:
  - plugins/work-sources/backlog/src/index.ts
  - 'https://github.com/oven-sh/bun/blob/bun-v1.4.1/docs/runtime/bunfig.mdx'
documentation:
  - docs/viewers/creating-a-plugin.md
priority: high
type: bug
ordinal: 581000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Closing Groma leaves `backlog task list --json --watch` processes running. On 2026-09-23 six were found with parent PID 1, the oldest over two hours old, from Groma sessions that ended by a closed terminal or a killed process. Groma starts the watcher detached (its own session and process group) so that closing a subscription can stop the Backlog npm launcher and its native binary together. As a side effect, a terminal hangup or a process-group kill never reaches the watcher, and Groma only stops it through its own shutdown code, which does not run when Groma is killed. An orphan exits only when Backlog next writes a task update to the closed pipe, so in a quiet repository it runs indefinitely.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When Groma is killed without running its shutdown, for example with SIGKILL, a directly installed Backlog watcher exits
- [ ] #2 A hangup sent to the process group running Groma, as when its terminal closes, also stops the Backlog npm launcher and its native watcher
- [ ] #3 Closing one subscription while Groma keeps running still stops that subscription launcher and native watcher and leaves other subscriptions running
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
1. Backlog adapter (plugins/work-sources/backlog/src/index.ts): start every Backlog process in Groma's own process group (drop `detached`) and with Bun's no-orphans setting (`BUN_FEATURE_FLAG_NO_ORPHANS=1`) in its environment. A Bun-built Backlog binary then exits when its parent (Groma or the npm launcher) goes away, even after SIGKILL. Closing a subscription kills only its direct child; the native binary under the npm launcher exits on its own. Windows keeps `taskkill /T`. Groma itself keeps its current lifetime: running Groma with `--no-orphans` would also make it exit when its own parent exits, which is a separate product decision and does not reach a watcher when Groma is killed.
2. Regression test (test-bun/backlog-lifecycle.test.ts). Authority: AC #1 and #2, reproduced failure (orphaned watchers after Groma died). Wrong result detected: the watcher keeps running after its owner is killed with SIGKILL, or after a hangup to the owner's process group. Gap: the existing test covers only an explicit close. Smallest test: run the subscription inside an owner process, kill the owner (SIGKILL on its pid for a direct watcher, SIGHUP to its group for a wrapped one) and assert the watcher processes exit. The existing close test keeps covering AC #3.
3. Docs: one sentence on Backlog process lifetime and the npm launcher limit in docs/viewers/creating-a-plugin.md.
4. Verify with the real CLI in a throwaway repo (SIGKILL, group SIGHUP, group SIGINT with no spurious watch error), then `bun run check`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Superseded by Backlog.md BACK-688: the watcher lifetime is fixed in Backlog (native binary and npm launcher), so Groma keeps its detached spawn and group close. Research evidence is recorded in BACK-688.
<!-- SECTION:NOTES:END -->
