---
id: TASK-227.1
title: Open scrollable Advanced commands in Welcome
status: Done
assignee:
  - '@codex'
created_date: '2026-09-01 18:56'
updated_date: '2026-09-01 19:16'
labels: []
dependencies: []
references:
  - welcome
modified_files:
  - src/welcome/view.ts
  - src/welcome.ts
  - test-bun/welcome.test.ts
  - README.md
  - docs/product-model.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - src/welcome/model.ts
parent_task_id: TASK-227
type: enhancement
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers open Advanced commands from the interactive Welcome as a dedicated read-only screen, so the complete command reference remains usable at normal terminal heights without compressing or moving the primary launcher. The screen reuses the Welcome shell and Instructions reading controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on the launcher Advanced commands row opens a dedicated read-only command screen; returning restores the unchanged launcher with Advanced selected.
- [x] #2 The Advanced screen keeps repository context, a visible Back row, plugin readiness, and its footer visible while clipping command references to the available viewport.
- [x] #3 J and K scroll references by one command, while PageUp and PageDown scroll by one visible page; scroll controls appear only when the list overflows.
- [x] #4 Advanced command references never become selectable and never dispatch commands; Enter on Back and Backspace return to the launcher.
- [x] #5 Every entry starts at the first reference, and plain Welcome output remains unchanged.
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
1. Replace launcher expansion state with a dedicated Advanced screen and return to the launcher with Advanced selected.
2. Project Advanced commands as one-line read-only rows inside a clipped viewport between visible Back and pinned plugin/footer rows.
3. Reuse the existing J/K and PageUp/PageDown reading-direction mapping and painted scroll bounds; reset scroll on every entry.
4. Update focused state and terminal-frame tests for 24-row rendering, one/page scrolling, Back behavior, non-dispatch, tall-screen controls, and unchanged plain output.
5. Update docs and observed architecture, run checks, and repeat required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context review classified this as an L1 Welcome interaction change. Reuse the Instructions reading keys, keep Up/Down semantics unchanged, and avoid a generic scrolling abstraction.

Implemented launcher-owned advancedScroll and a clipped Advanced reference viewport. The painter keeps the five primary rows, plugin readiness, and footer pinned; it reports page size and max scroll so J/K and PageUp/PageDown clamp correctly. Collapse resets scroll to zero.

Verification: changed-file Biome lint, TypeScript, git diff check, 12/12 Welcome tests, and 14/14 CLI/plain tests pass. The 110x30 frame keeps groma web at its original row, plugins on row 28, footer on row 29, shows two references, advances one with J, advances one two-command page with PageDown, and reopens at the first reference. bun run check reaches 97/99 Node tests; only the unchanged shared-host watch failures remain (EMFILE and the dependent scan --watch timeout).

Quality review found the accepted pinned-accordion layout physically impossible at the normal 24-row terminal height: there was zero room for a reference and the plugin row overwrote the table border. Alex selected a separate Advanced screen over compacting the splash or requiring 30 rows. The task contract and plan now reflect that approved decision.

Replaced the failed accordion approach with the approved dedicated Advanced commands screen. At 110x24 it keeps repository context, Back, seven command references, plugin readiness, and the footer visible. J/K move one reference, PageUp/PageDown move the seven-row page, Enter or Backspace returns with Advanced selected, and reopening resets to the first reference. The focused Advanced interaction tests, changed-file Biome lint, TypeScript check, and git diff check pass. The full repository check is currently blocked by shared unrelated work: an unused src/cli.ts import, five groma init failures from its changed contract, and the known scan watcher timeout/EMFILE failures.

Cold simplicity review traced launcher → Advanced state → clipped painter bounds → reading keys → launcher return. It found and removed the obsolete two-space accordion prefix from Welcome width calculation. The reviewer found no reason to merge the separate Advanced and Instructions scroll states; the direct screen-specific flow is easier to understand. Focused checks pass after the simplification.

The full-context complexity review confirmed the dedicated screen and the Welcome controller/model/view/test domain grouping. It recommended two small cleanup changes: one pure readingScroll helper now centralizes shared line/page clamping while screen handlers remain explicit, and tests use advancedIndex instead of hard-coded navigation counts. Focused Advanced and Instructions interaction tests, changed-file Biome lint, TypeScript, and git diff checks pass after these changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the height-limited Advanced accordion with a dedicated read-only Welcome screen. Repository context, Back, plugin readiness, and footer stay fixed while J/K and PageUp/PageDown scroll the clipped command list; Enter or Backspace returns with Advanced selected, and each entry resets to the first reference. Verified in a 110x24 terminal frame, with focused Advanced and Instructions interaction tests, changed-file Biome lint, TypeScript, and git diff checks. Simplicity, specification, quality, and full-context complexity reviews pass. The full shared-workspace check remains red only in concurrently modified initialization and watcher tests outside TASK-227.1.
<!-- SECTION:FINAL_SUMMARY:END -->
