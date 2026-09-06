---
id: TASK-30
title: Split the TUI into viewers/tui atomic folders
status: Done
assignee: []
created_date: '2026-08-15 13:27'
updated_date: '2026-08-15 13:29'
labels: []
dependencies: []
references:
  - src/viewer
  - docs/viewers/tui/index.md
priority: medium
type: chore
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the TUI plugin to src/viewers/tui and split paint primitives into atoms/ and molecules/ files, matching atomic design. Organisms and the view template stay beside those folders. Behavior does not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TUI sources live under src/viewers/tui with atom files in atoms/ and molecule files in molecules/
- [x] #2 groma view and existing TUI tests still pass
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
1. Move the TUI plugin to src/viewers/tui.
2. Split atoms and molecules into one file each under atoms/ and molecules/; put chrome and world in organisms/.
3. Update CLI, tests, and the terminal-interface code reference. Delete src/viewer.
4. Run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TUI lives at src/viewers/tui. Atoms are one file each under atoms/, molecules under molecules/, chrome and world under organisms/. paint.ts composes the template. CLI, tests, and the terminal-interface code reference now use that path. src/viewer is gone.

Verification: bun run check passed (tsc, architecture, 85 Node, 6 TUI).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved the TUI plugin to src/viewers/tui with atom and molecule files in their own folders. Verified with bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
