---
id: TASK-227.2
title: Present Advanced commands as a reference table
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 19:20'
updated_date: '2026-09-01 19:39'
labels: []
dependencies: []
references:
  - welcome
modified_files:
  - src/welcome/view.ts
  - test-bun/welcome.test.ts
  - README.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - src/welcome/model.ts
  - design-qa.md
parent_task_id: TASK-227
type: enhancement
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers opening Advanced commands see the same bordered command-and-description table language used by Instructions, while the dedicated screen continues to work at normal terminal heights.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Advanced commands screen renders visible references in the same bordered two-column table structure used by Instructions.
- [x] #2 Every advanced command row shows its concise description beside the command.
- [x] #3 J/K and PageUp/PageDown scroll by complete command rows while repository context, Back, plugin readiness, and footer stay fixed.
- [x] #4 At 110x24, the table shows only complete rows without overlapping fixed content.
- [x] #5 Enter or Backspace returns with Advanced selected, and reopening starts at the first command.
- [x] #6 The launcher marks groma instructions and Advanced commands with a small green trailing chevron, matching the selected first mockup without changing row height or behavior.
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
1. Reuse the Welcome table painter for the visible Advanced command page and show complete command-and-description rows.
2. Calculate page size in complete table entries within the space above plugin readiness.
3. Add one semantic nested-page marker to launcher rows and render it as the selected green trailing chevron.
4. Update focused interaction tests and documentation for the table behavior without testing decorative glyphs.
5. Capture the selected launcher state, compare it with the chosen mockup, run focused and repository checks, then complete required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This follows the approved Instructions visual language. Keep the dedicated Advanced screen and its existing read-only state; do not add selectable command rows or a new table abstraction.

Reused drawTable for the Advanced viewport. The page size is the number of complete two-line table entries plus borders that fit above pinned plugin readiness; at 110x24 this is three commands. J/K shifts one command, page keys shift three, and all command descriptions remain visible beside their commands. Focused Advanced and Instructions tests, changed-file Biome, TypeScript, and git diff checks pass. The 110x24 rendered frame shows three complete bordered rows with no overlap. bun run check reaches 102/104 Node tests; only the unchanged shared-host scan watcher timeout and EMFILE failures remain. The complete Welcome test has 11/12 passing; its unrelated missing-Backlog case now fails because concurrent TASK-233 requires initialized Groma storage.

Alex selected the first nested-page mockup: a small green trailing chevron after groma instructions and Advanced commands. Preserve the existing table, row height, descriptions, and navigation behavior.

Implemented the selected first mockup with one semantic opensPage row flag and one shared green trailing chevron renderer. The table width accounts for the marker, but launcher geometry and key handling are unchanged. Full-color tui-test capture at 110x30 confirms both nested-page rows; the combined comparison with the selected mockup passes design QA with no P0/P1/P2 findings. Focused lint, TypeScript, and four Welcome interaction/style tests pass. bun run check again reaches 102/104; only the unchanged shared-host watcher timeout and EMFILE failures remain.

Cold simplicity review passed. It traced nested-page row construction through the shared chevron painter and Advanced paging/table rendering, and found no deletion or consolidation that would improve the implementation. Keeping opensPage required on every Welcome row makes invalid or accidental nested markers less likely than an optional field.

The full-context complexity review found one duplicated layout source: welcomeSheet separately listed page labels and their chevrons for width measurement. Widths now derive from launcherRows, advancedRows, and instructionRows, so opensPage alone controls both display and measured layout. Focused tests, Biome, TypeScript, and git diff checks pass after the simplification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Presented Advanced commands in the shared bordered command-and-description table, with complete-row scrolling at normal terminal heights. The launcher now marks Instructions and Advanced commands with the selected small green trailing chevron, using one semantic opensPage source for both rendering and layout. Verified with focused interaction/style tests, changed-file Biome, TypeScript, a 110x24 table frame, and a full-color 110x30 tui-test capture compared with the selected mockup; design QA and all required reviews pass. bun run check reaches 102/104, with only the unchanged shared-host watcher timeout and EMFILE failures.
<!-- SECTION:FINAL_SUMMARY:END -->
