---
id: TASK-368
title: Explain unsupported Backlog CLI commands
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 09:02'
updated_date: '2026-09-13 09:06'
labels: []
dependencies: []
references:
  - backlog-plugin
modified_files:
  - plugins/work-sources/backlog/src/index.ts
  - test-bun/backlog-cli.test.ts
  - docs/viewers/index.md
type: bug
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog 1.48.0 is present on PATH but rejects the JSON option Groma needs. Task loading should tell colleagues to update Backlog instead of exposing only an unknown-option error. The installed command must remain the only access to Backlog data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Required JSON or watch options rejected by Backlog produce clear upgrade guidance in task-read and watch errors.
- [x] #2 Saved architecture remains available when integration fails; supported Backlog retains live task updates.
- [x] #3 Groma does not update Backlog automatically or inspect its storage.
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
Translate unsupported JSON/watch option errors at the Backlog adapter boundary. Preserve the existing viewer handling of unavailable task data and verify old and supported CLI behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification and quality review: both read and watch failures translate only unsupported required JSON/watch options into explicit npm upgrade guidance; other errors retain their existing messages. Backlog access remains CLI-only and no automatic update was added. Tests cover old JSON support, missing watch support and replacement of supported live snapshots. Actual Backlog 1.48.0 with compiled Groma reports the upgrade command while web returns 200 and saved Markdown is unchanged. Full bun run check passes: 16 Node tests and 282 Bun tests, 6 existing native-tool skips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Specification and quality review: both read and watch failures translate only unsupported required JSON/watch options into explicit npm upgrade guidance; other errors retain their existing messages. Backlog access remains CLI-only and no automatic update was added. Tests cover old JSON support, missing watch support and replacement of supported live snapshots. Actual Backlog 1.48.0 with compiled Groma reports the upgrade command while web returns 200 and saved Markdown is unchanged. Full bun run check passes: 16 Node tests and 282 Bun tests, 6 existing native-tool skips.
<!-- SECTION:FINAL_SUMMARY:END -->
