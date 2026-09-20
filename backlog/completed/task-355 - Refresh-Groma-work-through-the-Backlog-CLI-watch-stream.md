---
id: TASK-355
title: Refresh Groma work through the Backlog CLI watch stream
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 13:39'
updated_date: '2026-09-12 13:44'
labels: []
dependencies: []
references:
  - backlog-plugin
  - work-source-contract
  - terminal-host
modified_files:
  - plugins/work-sources/backlog/src/index.ts
  - packages/work-source/src/index.ts
  - src/view-host.ts
  - docs/viewers/creating-a-plugin.md
  - docs/product-model.md
  - docs/viewers/web/index.md
  - groma/systems/groma/containers/view-host/components/backlog-plugin.md
type: enhancement
ordinal: 401000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog 1.52.0 now provides task list --json --watch. Groma disabled filesystem task watching to keep Backlog storage private; connect the CLI stream so open viewers and continuous exports receive task updates again without knowing the storage layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Backlog work source reads complete successive JSON task lists from the CLI and notifies existing hosts after complete snapshots, including fragmented output.
- [x] #2 Task edits refresh live work and watched exports through the existing work-source contract without source scanning or direct Backlog filesystem access.
- [x] #3 Closing a work subscription stops its CLI process and prevents subsequent notifications; watch failures are reported without retries or filesystem fallback.
- [x] #4 Current documentation describes CLI-driven task updates; focused live CLI verification and the repository check pass.
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
1. Reuse Backlog command launch behavior for a long-lived JSON watch process and frame complete JSON objects. 2. Keep the latest streamed task list in the work source and notify existing consumers; await process cleanup on close. 3. Update current docs and the existing component description. 4. Verify fragmented stream and process lifecycle behavior plus a real task edit in a disposable export, then run bun run check and review the scoped change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex confirmed the shared flow must serve regular Groma as well as export watch. The existing Backlog work source is used by both Web and terminal hosts and static export; implement live ingestion there, not in export. Observed Backlog 1.52.0 emits successive complete pretty-printed JSON objects, not JSON lines. Existing task data and architecture roles remain unchanged.

Implemented one shared Backlog ingestion path in the existing plugin for regular Web, terminal, and watched export. The stream framer recognizes complete JSON objects across stdout chunks while respecting quoted and escaped characters; UTF-8 decoding belongs to the process stream. Every response replaces the cached task list before notifying the host. Subsequent reads reuse that list, with CLI reads for workflow configuration and selected task details. Work-source close now permits a promise, and the terminal host awaits it alongside its existing watches. Windows shutdown targets the command process tree; no local Windows execution was available. No direct Backlog storage access, retries, polling, or new storage abstraction was added.

Focused evidence: /tmp/groma-task-355-stream.ts passed fragmented multiline JSON, split UTF-8, braces in quoted text, multiple full objects per chunk, replacement by an empty task list, no duplicate task-list commands during watched reads, idempotent awaited shutdown, no callbacks after close, and CLI failure reporting. /tmp/groma-task-355-live.ts used a disposable plain-view fixture and Backlog custom work-items storage; real title/status edits updated regular Web work and watched export while stored architecture, world, and architecture generation stayed unchanged. tui-test verified an open regular terminal host changes its work list and selected task after a CLI title edit, then exits on Ctrl+C. Screenshot /tmp/groma-task-355-terminal.svg and text /tmp/groma-task-355-terminal.txt. One initial text wait timed out because a long title wrapped; the captured terminal already showed the update, and a short title completed the same flow successfully. No watch processes remain.

Final validation: bun run check passed with 16 Node tests, 256 Bun tests, six unavailable Rust/Go toolchain skips, zero failures and zero lint warnings; log /tmp/groma-task-355-check.log. git diff --check passed. Implementer simplicity, specification and quality review found no blocking defect in this bounded integration. All behavior remains in the existing Backlog plugin; no new C4 concept or OKF metadata was introduced. The stream transport does not depend on project language or task storage layout. Current docs and existing component responsibility were updated. Disposable checks were used rather than adding repository plumbing-test suites.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Connected backlog task list --json --watch to the shared work-source plugin used by Web, terminal and watched export. Complete JSON responses replace the task list and notify hosts; close stops and awaits the CLI process. Verified real updates across all three consumers, fragmented output, snapshot replacement and process lifecycle. Repository check passed: 16 Node and 256 Bun tests, six toolchain skips. No direct Backlog filesystem access or source-scan coupling. Uncommitted pending user confirmation.
<!-- SECTION:FINAL_SUMMARY:END -->
