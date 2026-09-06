---
id: TASK-299
title: Expand the shared Web details panel
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 13:42'
updated_date: '2026-09-06 13:58'
labels: []
dependencies: []
references:
  - web-shell
  - page
  - source-viewer
  - task-diff
  - render
  - web-viewer-authoring
  - flow-controls
modified_files:
  - features/details-panel.feature
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/source/view.ts
  - src/viewers/web/task-diff/view.ts
  - src/viewers/web/source/highlight.ts
  - src/viewers/web/organisms/editable.ts
  - test-bun/web-shell.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/flow/reader.ts
type: feature
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect can expand or collapse the shared Web details panel while reading elements, relationships, flows, tasks, source or diffs. The approved responsive layout covers the content width on narrow screens, keeps the hierarchy on small desktops, and leaves useful map space on large desktops. A horizontal opposing-arrow button points outward to expand and inward to collapse. Source and diff expansion share the same panel width owner. Completed acceptance-criteria checkmarks become clearer without checkbox controls or other content redesign.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every supported details view exposes the same expand/collapse button beside Close, with outward arrows when compact and inward arrows when expanded.
- [x] #2 Expanded details use the full content width on narrow screens, preserve the hierarchy on small desktops, and leave useful map space on large desktops; long prose stays readable and source/diffs can use the panel width.
- [x] #3 Source and diff views use the shared expansion behavior; opening and returning from files preserves a manual panel-width choice and the existing reading flow.
- [x] #4 Expansion preserves selection, hierarchy state, camera position and reading position without changing architecture geometry or saved Markdown.
- [x] #5 Completed acceptance criteria have clear read-only checkmarks without checkbox styling; the rest of the content layout is preserved.
- [x] #6 Focused state checks, browser verification and bun run check pass, with the supported behavior documented.
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
1. Keep expansion in the shared Web shell and centralize responsive width rules; source and diffs use that same expanded mode by default, while an explicit user choice applies across content. 2. Add the horizontal opposing-arrow control beside Close and preserve selection, camera, forms and reading position during width changes. 3. Adapt the panel to available viewport space, retain comfortable prose width and allow code/diffs to use the full reader. 4. Strengthen the existing read-only criterion checkmark without checkbox styling. 5. Document the supported flow, test expansion state, verify real browser layouts and run bun run check. Perform the required full-context complexity review and discuss any material recommendations before finalizing and committing only task-owned changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one session-local width owner in Web shell; source/diff file-open state supplies only the default. Central CSS replaces both domain width overrides. A fixed compact dock keeps camera framing unchanged while the panel expands over it. Shared controls stay available while scrolling. Flow file cleanup now runs before the flow reader: browser verification reproduced stale task-diff styling when opening a flow directly from a diff, and verified the correction. Flow return sits below shared controls. No OKF, C4, stored Markdown, or geometry changes: this is presentation state owned by the existing Web shell, independent of project language. Browser verification covered task, element, relationship, flow, source and diff; default file expansion, persistent manual compact/expanded choice, and file return. Checked 390px and 834px full-width readers without horizontal page overflow, 1440px hierarchy-preserving expansion, 1920px 960px reader leaving 576px of map, light/dark appearance, and read-only checked criteria. Toggling width preserved URL, selected relationship, hierarchy state and all 227 observed map transforms. Long task content remained in its current reading area after reflow, with controls visible. Focused shell tests pass. First full check passed: 106 Node tests and 329 Bun tests, 6 pre-existing lint warnings outside task changes. Implementer simplicity, specification and quality reviews found no remaining blocker; width behavior stays in the shell, and the required final full-context complexity review follows.

Final bun run check passed after the flow-return correction: 106 Node tests, 329 Bun tests, 0 failures; 6 unchanged lint complexity warnings outside the modified code. Final full-context complexity reviewer found no material recommendations or blockers: one shared optional width choice and shared CSS give clear ownership; keeping content readers separate and the camera dock fixed is the simplest approved approach. No further extraction or panel framework is needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added shared responsive expansion for element, relationship, flow, task, source and diff details, with opposing-arrow controls, persistent manual width choice and clearer read-only acceptance checkmarks. Removed separate source/diff width overrides and corrected direct diff-to-flow cleanup. Verified browser layouts at 390, 834, 1440 and 1920 pixels, navigation and camera stability, focused state tests and the complete repository check. Full-context complexity review passed without material recommendations.
<!-- SECTION:FINAL_SUMMARY:END -->
