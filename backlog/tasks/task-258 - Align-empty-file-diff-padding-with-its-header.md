---
id: TASK-258
title: Align empty file diff padding with its header
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:26'
updated_date: '2026-09-05 17:29'
labels: []
dependencies: []
references:
  - task-diff
modified_files:
  - src/viewers/web/task-diff/view.ts
type: bug
ordinal: 297000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens an unchanged file from a Backlog task in the Web details pane, the No changes message aligns with the file heading and source information. The supplied screenshot shows it touching the pane edge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The unchanged-file message has the same 22 px horizontal inset as the source information above it.
- [x] #2 Task summary status messages and populated diff rows retain their existing spacing; browser verification and bun run check pass.
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
Add one scoped spacing rule for status text inside the file diff, verify the reported unchanged file in the browser, and run the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added one CSS rule scoped to status text inside the file diff. Reproduced the reported TASK-254 unchanged compose.ts file in the browser: before, status padding was 0 and source padding was 22 px; after, both text starts align at the same 22 px inset. Accepted screenshot: /tmp/groma258-padding-after.png. The selector excludes summary statuses and populated diff rows. Cold simplicity, own specification/quality, and full-context complexity reviews pass with no findings. No public contract/documentation change or decorative test is needed. bun run check passes with 104 Node and 301 Bun tests; log /tmp/groma258-check.log.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned the unchanged-file message with the source information using a scoped 22 px horizontal inset. Verified the reported file in the browser and passed bun run check: 104 Node and 301 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
