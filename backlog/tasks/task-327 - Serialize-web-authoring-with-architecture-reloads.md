---
id: TASK-327
title: Serialize web authoring with architecture reloads
status: Done
assignee:
  - '@web-reload-race'
created_date: '2026-09-08 22:13'
updated_date: '2026-09-08 22:17'
labels:
  - web
dependencies: []
references:
  - src/viewers/web/map-session.ts
  - src/architecture-watch.ts
  - /tmp/reproduce-web-authoring-race.ts
  - web-server
modified_files:
  - src/viewers/web/map-session.ts
  - test-bun/web-authoring-race.test.ts
priority: high
type: bug
ordinal: 371000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer adding or removing an actor through the web map can overlap a watcher-triggered architecture read. The current read queue does not cover the filesystem write: a reload can list the actor, then removal deletes it before the read, causing an ArchitectureReadError for the missing Markdown and failing server shutdown. This was reproduced independently without Angular scanning. Preserve the ordinary successful add/remove flow by ordering the HTTP write and its following reload with watcher reloads through the existing world queue. Keep architecture meaning and storage behavior unchanged; do not hide missing-file errors, add retries, or weaken tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When an actor removal overlaps a watcher-triggered reload, the write and reload complete in order without a missing-file architecture error, and the removed actor is absent from the resulting map.
- [x] #2 A deterministic independent regression test exercises the overlapping read/write ordering and server close; existing web authoring assertions remain intact.
- [x] #3 The existing map publication and error-reporting behavior is preserved, with no retry or swallowed read error, and the repository check passes.
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
1. Reproduce the watcher read overlapping ordinary HTTP removal using an independent temporary fixture. 2. Queue the write and its own reload on the existing world chain; separate the reload body to avoid waiting on itself and preserve error propagation. 3. Add an isolated deterministic concurrent regression for ordering, HTTP response, latest map, and shutdown. 4. Run focused web tests and implementer specification/quality reviews, then request coordinator review and an exclusive repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed independently with /tmp/reproduce-web-authoring-race.ts: HTTP remove returns 200 after deleting the actor while a watcher read is held; server.close rejects ArchitectureReadError/ENOENT. Other active tasks have no modified-file overlap. Shared-check source freeze released by coordinator.

Dedicated isolated regression passes with queued write/reload. Restoring only map-session.ts to HEAD temporarily makes the same regression fail at HTTP removal must wait for the watcher reload; corrected source was restored immediately. Original independent harness also established the missing-file shutdown failure. No architecture semantics or published contracts change.

Focused verification: 14 authoring/race/startup tests pass; 12 live/shutdown/task-live tests pass; scoped Biome passes. Implementer specification review: AC1 and AC2 have deterministic old-fail/new-pass HTTP ordering, removed actor absent in latest payload, and successful server close; AC3 preserves publication generation/page invalidation/broadcast and existing 400 errors, with full check pending coordinator slot. Implementer quality review: no new queue abstraction, retries, swallowed reader errors, architecture model changes, or changed assertions/timeouts. The HTTP caller awaits the original run while the existing world chain remains usable after rejection. Two scoped files, both under 500 lines; no blocking finding. Public documentation needs no change because this restores existing behavior.

Exclusive full repository check passed (exit 0): bun run check; Bun suite 383 pass, 1 skip, 0 fail across 78 files. Full log /tmp/task-327-full-check.log. Coordinator final full-context review and acceptance remain pending; no staging, commit, or push performed.

Final full-context review passed with no required changes: smallest reuse of the existing queue and existing errors remain visible. Coordinator accepted deterministic baseline-fail/fix-pass HTTP ordering, latest map and successful shutdown proof, plus complete repository check (Node 110 pass; Bun 383 pass, 1 skip, 0 fail). All acceptance criteria and Definition of Done are verified. No public contract or documentation changes are needed for this behavior-restoring fix. Coordinator authorized scoped commit and push under an exclusive index lease.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Serialized ordinary web writes and their reload with watcher reloads using the existing world queue. The isolated regression fails with baseline ordering and passes with the fix, verifying HTTP success, the updated map, and clean shutdown. Existing authoring assertions remain unchanged. All 26 focused tests and the full repository check pass; implementer and final full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
