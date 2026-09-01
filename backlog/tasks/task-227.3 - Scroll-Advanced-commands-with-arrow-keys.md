---
id: TASK-227.3
title: Navigate and describe Advanced commands
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 19:43'
updated_date: '2026-09-01 20:15'
labels: []
dependencies: []
references:
  - welcome
modified_files:
  - src/welcome.ts
  - src/welcome/view.ts
  - src/welcome/model.ts
  - test-bun/welcome.test.ts
  - README.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
parent_task_id: TASK-227
type: bug
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers can select each Advanced command and read its explanation below the command table, using the same interaction pattern as Instructions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Up and Down move the selection between Back and Advanced command rows, and the table keeps the selected row visible.
- [x] #2 Every Advanced command shows its concise explanation below the table when selected.
- [x] #3 J/K scroll the selected command explanation by one line and PageUp/PageDown scroll it by one visible page without changing the selected command.
- [x] #4 Advanced command rows remain read-only; Enter returns only from Back, while Backspace always returns to the launcher.
- [x] #5 The footer explains command selection and description scrolling.
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
1. Add a short explanation to each Advanced command in the existing welcome model.
2. Give Advanced separate table and description scroll state; Up/Down selects commands while J/K and page keys scroll the selected explanation below the table.
3. Update tests, public documentation, and the observed Welcome component; verify in a constrained terminal and run required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced the installed groma command with tui-test: Down selected Advanced and Enter opened it correctly, but Up/Down then did nothing because handleAdvancedKey accepted only J/K and page keys. Keep references non-selectable and reuse the existing bounded scroll state.

Alex identified the architectural mismatch: Advanced reused the Instructions table painter but not its cursor navigation pattern. Pause the simple arrow-as-scroll patch and decide whether Advanced rows should share selectable table navigation while remaining non-executable.

Alex confirmed the stronger correction: copy the Instructions row-cursor behavior instead of treating arrow keys as an independent scroll shortcut.

Implemented a selected row for Advanced commands, made the viewport follow it, and routed arrows, J/K, and page keys through one bounded navigation operation. Enter is inert on command rows and returns only from Back; Backspace always returns.

Verification: focused Advanced tests pass (2/2), TypeScript passes, git diff --check passes, and tui-test at 110x24 showed the selection moving to groma scanner list with the table shifted and the full footer visible. The repository check reached 102/104 Node tests; only the known shared-host scan --watch timeout and EMFILE watcher failures remained. Running the complete Bun welcome file also exposed one unrelated fixture failure because concurrent filesystem work now requires /workspace/example to be initialized; both tests changed by this task pass in isolation.

Cold simplicity review: PASS. The reviewer found the key → selected index → viewport correction → rendered cursor flow direct, understandable, and already minimal; no deletion or consolidation was recommended.

Specification review: PASS. All five acceptance criteria and the Definition of Done have direct code, test, documentation, and tui-test evidence. Quality review: PASS. No correctness, hidden-selection, navigation-state, or read-only Enter regression was found in the task-scoped diff.

Full-context complexity review: PASS. Keep the domain split between controller, row model, and painter. Do not add a generic Instructions/Advanced navigation abstraction because their movement rules differ; the current explicit guards and bounded selection allow fewer mistakes.

Reopened after Alex identified the missing lower description panel. The earlier implementation copied row selection but still omitted the complete Instructions pattern: selected item content below the table with separate content scrolling.

Implemented the complete Instructions-style interaction. Advanced opens on the first command, Up/Down selects command rows and maintains a separate table viewport, while J/K and page keys scroll only the selected command explanation below the table. Added a concise explanation for every command.

Focused verification: 2/2 Advanced tests pass, TypeScript passes, and git diff --check passes. tui-test at 110x24 showed the export explanation below the selected row; after moving to groma create and pressing J, the selected row stayed fixed while the lower explanation advanced by one line.

Repository check again reached 102/104 tests; the same unrelated scan --watch timeout and EMFILE watcher failures remain. Task-scoped Biome lint passed with no diagnostics.

Cold simplicity review accepted one deletion: removed the redundant test that restated static content presence. The inferred command type already requires content on every entry, while interaction tests verify the selected explanation renders and scrolls.

Corrected specification review: PASS. Corrected quality review: PASS. Both confirmed the first-command default, command viewport, per-command lower explanation, independent description scrolling, return behavior, and 110x24 layout.

Full-context complexity review found one supported-flow bug and one consolidation: selection-boundary keys reset description scroll despite no movement, and Advanced/Instructions duplicated Markdown viewport painting. Applying both within the current domain boundaries.

Targeted complexity re-review: PASS. Boundary movement preserves scrolled content, the shared Markdown viewport keeps Advanced and Instructions behavior, and no regression was found. Final repository run remained 102/104 with only the same unrelated scan-watch timeout and EMFILE failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Advanced now uses the complete Instructions-style pattern. It opens on the first command, Up/Down selects command rows while the table keeps the selection visible, and every selected command shows a concise explanation below the table. J/K and page keys scroll only that explanation. Command Enter remains inert; Enter on Back and Backspace return to the launcher.

The shared Welcome view now has one private Markdown viewport painter used by Advanced and Instructions. Verified by 3/3 focused Advanced/Instructions tests, TypeScript, task-scoped Biome, git diff --check, and tui-test at 110x24. Simplicity, specification, quality, full-context complexity, and targeted re-review passed. The repository run reached 102/104, with only unrelated watcher timeout and EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
