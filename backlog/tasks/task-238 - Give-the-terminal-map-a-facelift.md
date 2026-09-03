---
id: TASK-238
title: Give the terminal map a facelift
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 20:20'
labels:
  - tui
  - render
dependencies: []
references:
  - 'https://claude.ai/code/artifact/e748f7d4-fb0a-4fe8-af7b-8727a745f727'
  - screen
  - navigation
documentation:
  - docs/viewers/tui/index.md
modified_files:
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/panes/view.ts
priority: high
type: feature
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view`, Groma shows the terminal map approved on the design page: grey plus the brand green; kinds by glyph, shape and surface pattern; depth by line weight; origin by line style. The root map lists each island as rows, one row per child with one block per component and the current task at the row end; the selected island is fitted to the map width and centered, neighbours peek in the padding, Left and Right pan to them. Enter opens a container map fitted and centered the same way, its buildings one row per floor. Chrome and panes are OpenTUI renderables; the map is one renderable whose painter reads Core sheet. Design and frames: https://claude.ai/code/artifact/e748f7d4-fb0a-4fe8-af7b-8727a745f727. rataflow: conventions only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every subtask is done and `groma view` at 120x36 and 200x60 matches the root map and container map frames on the design page
- [x] #2 On the large-world fixture, arrow keys reach every element of the current scope, the selected system or container stays centered, and the map scrolls only as far as a selection needs
- [x] #3 Task corners and status toggles on the map match the browser Live work behaviour
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
1. Confirm all eleven subtasks are Done with complete acceptance criteria.
2. Drive groma view through tui-test at 120x36 and 200x60, capture the root and a container, and compare the fixed chrome, rows, buildings, details, and camera behavior with the approved design.
3. Reuse the passing large-world, Work, focused TUI, and full repository test evidence for the behavioral parent criteria.
4. Run the parent specification, quality, simplicity, and full-context complexity reviews without changing code; finalize the parent only if no acceptance-backed gap remains.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cold parent simplicity review found two unused mount options. Removed the uncalled initial level and camera options; supported initial selection remains currentId.

Correction from the full typecheck: level is used by the source-details test entry point, so it remains. Only the truly unused camera mount option was removed.

Parent verification: all 11 subtasks are Done with complete acceptance criteria. tui-test captured root and CLI-container frames at 120x36 and 200x60; fixed chrome, root rows, container buildings, details, fixed scale, centered selection, and neighbour peeking match the approved design. Large-world tests prove reachability, centering, and minimal camera movement; Work tests prove task corners and status filters match the web projection. Cold simplicity review passed after removing only the unused initial camera option. Implementer specification review found all three parent criteria satisfied; quality review found no reproducible supported-flow defect or unnecessary new indirection. Full check passes 106 Node and 267 Bun tests with 13 unchanged warnings.

Full-context complexity review found the runtime cycle navigation -> navigation-spatial -> navigation. Moved the shared ancestor lookup into spatial navigation and updated callers so the reverse dependency is type-only; no behavior changed.

Applied the full-context review recommendation: spatial navigation now owns ancestor lookup, so navigation depends on spatial navigation without a runtime reverse import. Final bun run check passes 106 Node and 267 Bun tests with the 13 pre-existing complexity warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed and verified all eleven terminal-map subtasks. tui-test frames at 120x36 and 200x60 confirm the approved root and container layouts; large-world and Work tests prove navigation, camera, task corners, and shared status behavior. Removed one unused camera option and the navigation runtime import cycle. Full repository check passes 106 Node and 267 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
