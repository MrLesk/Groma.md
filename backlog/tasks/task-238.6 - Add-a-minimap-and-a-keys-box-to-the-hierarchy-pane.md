---
id: TASK-238.6
title: Show a keys box with ?
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 15:46'
labels:
  - tui
dependencies:
  - TASK-238.8
modified_files:
  - src/viewers/tui/keys.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/terminal-viewer.ts
  - docs/viewers/tui/index.md
  - test-bun/keys.test.ts
parent_task_id: TASK-238
priority: medium
type: feature
ordinal: 266000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing `?` shows a keys box listing every map key: arrows, Enter, Backspace, Tab, Escape, `/`, `w`, `[`, `]`, `t`, `s`, `x`, `h`, `p`, `r`, `?` and Ctrl+C. It takes the details pane area, opening the pane if it is folded, so it never overlays the map; Escape or `?` closes it and restores the previous details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `?` shows the keys box in the details pane area and opens that pane if it was folded; Escape or `?` closes it and the previous details return
- [x] #2 The listed keys are exactly the keys the viewer handles; a test compares the list with the key table
- [x] #3 The map never changes while the keys box is open
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
1. keys.ts (new): one table of the map keys the viewer handles, each with its label, its action or its special handling, and its meaning; terminal-viewer.ts maps key names to actions from that table, so a key added there is listed and handled together.
2. navigation.ts: toggle-keys ('?') shows the keys box in the details pane, opening the pane if folded, the way the profile does; Escape or ? closes it and the previous details return; the map ignores the box.
3. panes: view.ts builds the keys box view from the table (label column, meaning), no tab; the footer says how to close it.
4. Tests: the keys box lists exactly the table's labels and the viewer handles exactly the table's keys; ? opens the pane when folded, Escape restores the previous details, and the projection does not change while the box shows. Docs: the keys section names ?.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: keys.ts holds the one table of keys the viewer handles (MAP_KEYS: key name, reducer action or the viewer's own handling, ctrl) and the rows of the keys box (KEYS_BOX: label, meaning, the names it stands for); terminal-viewer.ts resolves a key press through MAP_KEYS, so a key exists in both or in neither. toggle-keys ('?') is a details mode like the profile: it opens the details pane if folded, shows the box, and Escape or ? closes it with the previous details returning; folding the details ends it; the map is untouched. keysLines draws label and meaning, wrapped. Docs list ?. Tests: the box lists exactly the handled keys, ? opens the folded pane and Escape restores while the projection stays identical, and a mounted viewer shows the Keys title and gives the selection back; terminal suites green, typecheck clean, lint back to the 4 pre-existing warnings after sharing one toggleDetailsMode and one modeView. tui-test capture at 120x36 shows the box in the details pane with the footer '? close   esc close'. Reviews: implementer-only while the review agents are rate-limited until 12:50; separate-agent passes owed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pressing ? shows a keys box in the details pane, opening the pane if it was folded, that lists exactly the keys the viewer handles from the one key table both read; ? or Escape closes it and the previous details return, and the map never changes while it shows. A test compares the box with the key table.
<!-- SECTION:FINAL_SUMMARY:END -->
