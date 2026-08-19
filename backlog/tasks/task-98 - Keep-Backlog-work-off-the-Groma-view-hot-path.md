---
id: TASK-98
title: Keep Backlog work off the Groma view hot path
status: Done
assignee:
  - '@grok'
created_date: '2026-08-19 18:08'
updated_date: '2026-08-19 18:12'
labels: []
dependencies:
  - TASK-96
references:
  - src/view-host.ts
  - src/backlog-plugin.ts
  - view-host
  - backlog-plugin
priority: high
type: bug
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens groma view, the map must appear from architecture alone. Backlog is optional: if work can be loaded, Groma shows markers; if the CLI is slow or fails, the viewer still opens and architecture still refreshes. Backlog reads must not sit on startup or on architecture/scan refresh.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view opens from architecture without waiting for a Backlog CLI read
- [x] #2 A failed or slow Backlog read leaves the map working, with no work markers until a successful read
- [x] #3 Architecture and scan refreshes still apply when Backlog is unavailable
- [x] #4 A successful later Backlog read still projects exact-id markers onto the open view
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
1. Load architecture first and mount the viewer with no work. Pull Backlog in the background and update only after a successful read.
2. Architecture and scan watches refresh architecture only. Work watch pulls Backlog only. A failed read leaves the last good work array (empty at start) and never rejects.
3. Cover hung and rejected reads plus the existing later-success refresh. Do not add retry or a second CLI strategy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Architecture mounts first with empty work. Backlog is pulled in the background. Architecture/scan watches never call the Backlog CLI. A failed read keeps the last good work (empty at start) and does not reject. bun test test-bun/work.test.ts test-bun/viewer-lifecycle.test.ts test-bun/viewer-live.test.ts — 13 pass. bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view opens from architecture alone. Backlog markers appear only after a successful later read. A slow or failed backlog CLI does not block startup or architecture refresh. Verified with bun test work/viewer-lifecycle/viewer-live (13 pass) and bunx tsc --noEmit.
<!-- SECTION:FINAL_SUMMARY:END -->
