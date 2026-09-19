---
id: TASK-442
title: Show the implementation plan before task references and file changes
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 21:08'
updated_date: '2026-09-19 21:12'
labels: []
dependencies: []
references:
  - task-diff-control
modified_files:
  - src/viewers/web/task-diff/view.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 515000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer reading a task in the Web details panel must scroll past references and a potentially long file list before reaching the implementation plan. Put the plan earlier so the planned work can be read before its supporting changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a task with an implementation plan shows that plan before References and Modified files in the Web details panel.
- [x] #2 Existing task content, reference navigation and file diff actions keep their current behavior.
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
1. Move the existing implementation-plan section after task checklists and before references in the task summary renderer.
2. Update the documented section order.
3. Review the small diff, explain the current Git comparison labels, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved the existing plan renderer after task checklists and before references. Updated only the documented section order; unrelated existing documentation edits are preserved. Task selection still loads details through createTaskDiffControl, and paintTaskSummary retains section ownership, empty-section handling, callbacks and incremental updates. No new UI/content tests were added for this mechanical reorder.

Browser verification on a temporary source-built server: TASK-442 displayed Implementation plan before References and Modified files; its source diff opened; keyboard Back restored the same summary order; its architecture reference opened Task changes panel. A pointer click on Back in the wide diff view hit the existing overlaid camera controls; keyboard activation confirmed the Back action, and that separate layout issue was left outside this change.

The sandbox run could not create test listeners or file watchers. The complete bun run check passed outside the sandbox: 16 Node tests and 608 Bun tests passed, 35 skipped, 0 failures; existing lint notices remain. git diff --check passed. Implementer specification and quality reviews confirm the requested reorder with no added behavior, dependencies or architecture concepts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementation plan now appears before References and Modified files in Web task details, with the documented order updated. Verified in the browser, including reference navigation and file-diff actions, and with bun run check (16 Node and 608 Bun tests passed; 35 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
