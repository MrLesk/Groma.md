---
id: TASK-169.1
title: Show Backlog tasks in terminal Work focus
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 20:58'
updated_date: '2026-08-26 19:37'
labels: []
dependencies: []
references:
  - navigation
  - screen
  - terminal-host
  - terminal-viewer
  - work-focus
  - layout
  - projection
modified_files:
  - src/viewers/tui/model.ts
  - src/view-host.ts
  - src/types.ts
  - src/work/projection.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/work/model.ts
  - src/viewers/tui/work/paint.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/organisms/chrome.ts
  - test-bun/work.test.ts
  - test-bun/navigation.test.ts
  - test-bun/chrome.test.ts
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/work-focus.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - docs/viewers/tui/index.md
  - src/viewers/tui/work/navigation.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/layout.ts
  - test-bun/projection.test.ts
  - groma/observed/systems/groma/containers/terminal-viewer/components/layout.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - design-qa.md
parent_task_id: TASK-169
priority: high
type: feature
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect runs `groma view`, Groma always shows Backlog task anchors and a compact task recap at the bottom of the map. Pressing `w` opens the task-focused side panes. Selecting a task centers the fixed-scale terminal map on its touched architecture: when all touched components share one container, Groma opens that component view; otherwise it stays at root and centers their promoted visible containers as one set. If that set is larger than the terminal viewport, the fixed scale remains and the camera centers the complete set. Closing Work focus restores the prior architecture, flow, pane, scope, selection, and camera state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Outside Work focus, every mapped Backlog task keeps a compact border-docked marker on its visible architecture anchor without covering map content.
- [x] #2 A compact recap reserved at the bottom of the map summarizes available work and tells the architect to press w for task details; it follows the existing terminal visual system and does not overlay the world.
- [x] #3 Pressing w enters and leaves Work focus without changing the stored architecture world, sheet geometry, or geometric scale.
- [x] #4 Work focus lists Backlog tasks by configured workflow status and lets arrow keys select one task at a time while Enter focuses its details.
- [x] #5 Selecting a task opens component scope when all touched components share one container; otherwise it centers their promoted root anchors as one bounds set. The complete set is shown together when it fits the viewport, and remains centered at the fixed terminal scale when it does not.
- [x] #6 The selected task details show its ID, status, assignees, title, description, acceptance-criteria progress, modified files, and architecture references in the reserved details pane.
- [x] #7 The selected task highlights every touched visible element and routes leaving those elements; refresh preserves valid selection and safely clears a removed task.
- [x] #8 Leaving Work focus restores the prior architecture selection, scope, camera, flow presentation, pane focus, details visibility, details scroll, and flow cursor.
- [x] #9 Focused concurrent tests cover persistent markers, recap layout, task navigation, multi-element camera framing, component-scope choice, geometry invariants, refresh lifecycle, and restoration; tui-test verifies normal and Work states at 120x36 and 200x60 against the web task bar and approved Work mockup.
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
1. Reuse the web task meaning (`touchedElements`) and terminal visible-endpoint promotion so one Work selection resolves every visible task target and the smallest useful scope.
2. Extend terminal projection camera attention from one element to a fixed-scale bounds set, centering every target together and showing the complete set whenever it fits the terminal viewport.
3. Keep task anchors projected in normal and Work modes, and reserve a compact map-bottom recap row that summarizes active work and points to `w`, using the existing TUI atoms and palette.
4. Preserve all pre-Work architecture, flow, pane, scope, selection, and camera state while Work owns its task navigation and temporary projection.
5. Update focused concurrent tests, terminal documentation, and observed architecture; verify normal and Work states with tui-test at 120x36 and 200x60, then rerun simplicity and defensive architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Work focus over the existing fixed terminal world. The view host passes the complete WorkSnapshot; the terminal work domain owns status grouping, task navigation/details, shared touched-element projection, and border markers. The obsolete assignee-only terminal projection and marker were deleted.

An earlier simplicity pass removed normal-mode anchors under the narrower original scope. After comparison with the live web viewer and the attached Backlog island, the accepted scope changed: task markers and a compact recap now remain visible outside Work. Selecting a task reuses touchedElements and visible-endpoint promotion to frame every visible target. If every target belongs to one container, Work temporarily opens that component map; otherwise it uses the root map. The terminal keeps its one fixed geometric scale.

Work never rewrites architecture or flow state. It owns a temporary projection and camera, while its discriminated selection state safely handles delayed, preserved, and removed tasks. Closing Work restores the exact prior pane focus, details visibility and scroll, flow cursor, scope, selection, and camera. The map viewport reserves one row for the recap, so neither it nor the side panes cover the world.

Verification: bun run check passes 95 core tests and 158 viewer tests. Focused concurrent tests cover persistent anchors, recap layout, task navigation, touch projection, multi-target framing, scope choice, refresh, geometry invariants, and restoration. tui-test verified normal and Work states at 120x36 and 200x60, including TASK-172 opening the Web viewer component map. Visual QA compared the recap with the live web task island. git diff --check passes and task source files remain below 500 lines.

The revised cold simplicity review reconstructed the complete flow and found no production code or focused tests to delete. It identified this stale correction history and the obsolete work-projection task reference; both were corrected before final review.

The final defensive review exposed the fixed-scale viewport limit. The task contract now states the terminal equivalent explicitly: one-container tasks open component scope; cross-container targets form one centered root bounds set; oversized sets remain centered without geometric zoom. An automated oversized-bounds test now covers that rule. The review also led to the clearer WorkPresentationSnapshot name and one redundant list-prefix branch being removed. The targeted re-review passed with no blocker, and the final focused typecheck plus 33 concurrent tests passed. A later full-suite attempt was blocked before tests by unrelated concurrent web `ViewState.hud` edits; the complete suite had already passed 95 core and 158 viewer tests before those external edits.

Completion verification after Alex approval: `bun run check` passed. Biome completed with existing complexity warnings, TypeScript passed, and all 81 Node plus 170 Bun tests passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added persistent terminal Backlog markers and a reserved map-bottom work recap. Work focus now uses the shared task-touch model to open a single-container component view or center a cross-container root bounds set, while preserving the fixed map scale and restoring the exact prior architecture and flow state on exit. Verified with full-suite 95 core and 158 viewer passes before unrelated concurrent web edits, a final focused typecheck and 33 concurrent tests, tui-test at 120x36 and 200x60, and comparison with the live web task island. Cold simplicity and full-context defensive architecture reviews passed after their corrections.
<!-- SECTION:FINAL_SUMMARY:END -->
