---
id: TASK-214
title: Replace the container checkbox glyph with a slab mark
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 13:52'
updated_date: '2026-08-30 14:54'
labels: []
dependencies: []
references:
  - paint
modified_files:
  - src/viewers/tui/atoms/kind.ts
  - docs/viewers/tui/index.md
  - src/viewers/atoms/kind.ts
  - src/viewers/tui/organisms/hierarchy.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/page.ts
  - src/viewers/web/atoms/kind.ts
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The outlined square used for containers looks like an interactive checkbox. Replace it with the approved white parallelogram glyph so containers read as architectural slabs across Groma while actors, systems, and components keep their current symbols.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every shared container kind indicator renders as ▱ instead of □
- [x] #2 Actor, system, and component indicators remain unchanged
- [x] #3 Viewer documentation uses the approved container symbol wherever it describes the kind glyphs
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
1. Move the shared kind glyph and label lookup to src/viewers/atoms/kind.ts, keeping the approved ▱ container mark and the other marks unchanged. 2. Import that shared owner directly from every Web and TUI consumer, then delete the renderer-specific kind files. 3. Keep the documented glyph list on ▱ and run focused verification plus bun run check without adding a decorative-glyph test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the approved container glyph as ▱ in the shared kind map and updated the TUI viewer glyph list. Focused verification prints ● ■ ▱ ▪, finds no □ in production code or docs, and git diff --check passes. bun run check passed lint and typecheck but the Node suite stopped on existing watcher failures: EMFILE too many open files and a dependent scan-watch timeout. Cold simplicity review found the task change minimal; its only apparent extra diff belongs to parallel TASK-211 and is excluded. The full-context architecture review recommends considering moving the shared kind map out of the TUI domain and deleting the Web re-export so both viewers import one shared owner directly.

Applied the approved ownership cleanup: src/viewers/atoms/kind.ts now owns all kind glyphs and labels; Web and TUI consumers import it directly; both renderer-local kind modules were deleted. Focused Web/details tests pass (6/6), the shared lookup prints ● ■ ▱ ▪, and TypeScript passes. A second bun run check again stopped only in the unrelated scan watcher tests: 79/81 Node tests passed, while scan --watch timed out after EMFILE (too many open files).

Rendered QA passed. In the Web viewer at http://localhost:49555 (1280×720), the legend, hierarchy, details children, and container relationships rendered ▱; selecting ▱ CLI opened Container · observed; the page was non-blank, had no framework overlay, and logged no warnings or errors. A direct PTY render of the terminal viewer showed ▱ Container in the legend and ▱ Web viewer on the map. tui-test was attempted first as required, but its temporary session exited before capture, so the working direct PTY was used as the terminal evidence. Final source checks: git diff --check passes, all eight TUI/Web consumers import src/viewers/atoms/kind.ts directly, and □ is absent from active source and docs. The targeted cold simplicity re-review and full-context architecture review both found no further changes: the shared viewer-domain atom is the simplest and clearest owner.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the checkbox-like container mark with ▱ across the Web and terminal viewers and viewer documentation. Consolidated glyph and label ownership in src/viewers/atoms/kind.ts, removed both renderer-local kind modules, and pointed every consumer directly at the shared atom. Verified in rendered Web and terminal views, with focused tests, TypeScript, and diff checks; the full repository check remains blocked only by the pre-existing EMFILE scan-watcher failures recorded in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
