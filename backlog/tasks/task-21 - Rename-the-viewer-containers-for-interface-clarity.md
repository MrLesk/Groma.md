---
id: TASK-21
title: Rename the viewer containers for interface clarity
status: Done
assignee:
  - '@codex'
created_date: '2026-08-02 18:54'
updated_date: '2026-08-02 19:04'
labels: []
dependencies: []
references:
  - groma/plans/05-tui-viewer/systems/groma/containers/viewer/container.md
  - >-
    groma/plans/05-tui-viewer/systems/groma/containers/terminal-viewer/container.md
modified_files:
  - groma/plans/05-tui-viewer
type: docs
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the current Revision 05 architecture unambiguous without rewriting completed Revisions 01 through 04. The existing browser container keeps its stable identity and becomes readable as Web viewer; the new terminal container is named Terminal viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Revisions 01 through 04 remain byte-identical to their committed completed states
- [x] #2 Revision 05 presents the existing stable ID viewer as Web viewer without changing its ID or Markdown path
- [x] #3 Revision 05 presents the new terminal application as Terminal viewer with stable ID terminal-viewer and matching Markdown path
- [x] #4 All Revision 05 parent IDs and Markdown links resolve and the full repository check passes
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
1. Leave completed Revisions 01 through 04 unchanged.
2. In Revision 05, keep the existing browser container ID and path as viewer while changing its readable name to Web viewer.
3. In Revision 05, rename the new TUI container identity and path to terminal-viewer and its readable name to Terminal viewer.
4. Validate Revision 05 and run the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The first rename attempt modified completed revisions and changed the existing viewer stable ID. The human architect clarified that completed revisions are immutable. Those edits were rolled back; Revision 05 now expresses the naming change as a modification to the existing viewer and gives only the newly introduced terminal viewer a new stable ID.

Verification:
- `git diff --exit-code` over Revisions 01–04 and their indexes exited 0.
- Revision 05 validation found 19 elements and 25 resolved relationships.
- Cold simplicity review found the rename minimal and understandable, with nothing to delete or collapse. Its first full check encountered one source-refresh timing failure outside this task; a fresh targeted rerun of `bun run check` exited 0 with all 6 revisions valid and 126/126 tests passing, and the targeted re-review passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clarified only Revision 05: the established `viewer` identity and path are now presented as Web viewer, while the newly introduced terminal renderer uses `terminal-viewer` and Terminal viewer. Revisions 01–04 remain byte-identical. Verified by immutable-revision diff, architecture validation, cold simplicity review, and a fresh `bun run check` with 126/126 tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->
