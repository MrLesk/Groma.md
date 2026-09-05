---
id: TASK-247
title: Fix web details scrolling and Back button styling
status: Done
assignee:
  - '@web_details_fix'
created_date: '2026-09-05 13:00'
updated_date: '2026-09-05 13:20'
labels: []
dependencies: []
references:
  - web-shell
  - task-diff
  - page
modified_files:
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer selects a different architecture item or Backlog task in the web viewer, the details panel starts at its heading. When they open a file diff from a task and return, the task restores its previous reading position. The details Back button uses the existing shared button style. Keep map navigation, task list controls, search, and architecture detail ordering unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a different architecture item or task opens its details at the top, even after scrolling the previous item.
- [x] #2 Opening a task file diff and returning restores the task reading position.
- [x] #3 The details Back button uses the same existing style as comparable web buttons.
- [x] #4 The supported web interactions are checked in a browser and bun run check passes.
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
1. Reset the existing details scroll in the shell when the selected item identity changes. 2. Save task summary scroll before file drill-down; restore after repaint and again after the existing width animation settles, while the same task summary remains selected. 3. Limit tab button overrides to tab controls so Back uses shared chrome-button styling. 4. Document selection and return behavior, verify both in Chromium, and run focused checks plus bun run check. 5. Complete cold simplicity and implementer specification/quality reviews, then coordinator full-context review. Leave In Progress for Alex acceptance without commit or push.

6. Final contextual review passed without material findings. Alex approved closure; commit only this task and release overlapping files to TASK-248.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification reproduced a short-record return defect: the existing pane width transition clamped saved scroll 561px to 322px. Restore once after repaint and again after the current pane animations settle, only while the same task summary remains selected. Long-record return and new-selection top already pass.

Browser checks now pass: architecture selection resets 300px to 0; task selection starts at 0; long task diff return restores 1421px exactly; short task return restores 629px exactly after width settles. Back computed style is shared 1px border, 6px radius, 32px height. Captures: /tmp/task247-architecture-top.png, /tmp/task247-task-before-diff.png, /tmp/task247-diff.png, /tmp/task247-task-return.png, /tmp/task247-task-top.png. Focused checks pass 17/17. First full gate had one web-live architecture-watch timeout; isolated web-live passed 8/8. Rerunning the full gate without browser work.

Quiet final bun run check passed (exit 0): Node 104/104 and Bun 283/283. Log: /tmp/task247-check-final.log. Scoped diff has no whitespace errors. Changed source files are 87, 145 and 397 lines. Code is ready for coordinator cold simplicity review; acceptance criteria, finalization, commit and Done remain pending.

Cold simplicity review passed without findings. Implementer specification review passed: AC1 is proven by architecture scroll 300-to-0 and task selection at 0 in Chromium; AC2 by exact long-record 1421px and short-record 629px diff return; AC3 by the inspected Back capture and shared 1px border, 6px radius and 32px height; AC4 by those browser interactions and successful final bun run check (Node104/104, Bun283/283). Evidence paths and the initial watcher timeout with isolated recovery are recorded above. DoD1 is supported by this criterion evidence; DoD2 by focused17/17, full checks and the four-file task-scoped diff; DoD3 by docs/viewers/web/index.md; DoD4 by the updated plan and correction/verification notes. Implementer quality review found no reproducible defect or authority-backed blocker in the supported flow. Selection identity stays in the shell, task drill-down keeps its single saved position, and existing shared button styling is reused. No added dependency, generic extension, compatibility path or unrelated code change. All changed source files remain below 500 lines. TASK-248 may edit separate sections in overlapping files; its work is not part of this review or task ownership. Frozen for coordinator final full-context review. In Progress pending Alex acceptance; no staging, commit or push.

Final full-context complexity review passed with no material findings or architecture changes. Alex explicitly requested closure so TASK-248 can continue without conflict. All four acceptance criteria and four Definition of Done items are verified. Closing and committing only TASK-247 files/hunks; preserving TASK-248 and all unrelated work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Details start at the heading for a newly selected architecture item or task. Back from a task file diff restores the reading position, including after the width transition, and uses the shared button styling. Browser checks prove selection reset and exact long/short diff return; focused17/17 and bun run check Node104/104 Bun283/283 passed. Cold simplicity, implementer specification/quality, and full-context complexity reviews passed without remaining findings. Closed at Alex request.
<!-- SECTION:FINAL_SUMMARY:END -->
