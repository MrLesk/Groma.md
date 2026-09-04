---
id: TASK-244
title: Restore the approved Terminal Facelift view
status: Done
assignee:
  - '@codex'
created_date: '2026-09-04 06:25'
updated_date: '2026-09-04 07:03'
labels:
  - tui
  - render
dependencies: []
references:
  - /Users/alex/Downloads/Terminal Facelift.pdf
  - projection
  - navigation
  - terminal-painting
modified_files:
  - src/viewers/tui/projection-root.ts
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/molecules/row.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
  - test-bun/root-layout.test.ts
  - test-bun/container-layout.test.ts
  - test-bun/projection.test.ts
  - test-bun/navigation.test.ts
  - test-bun/large-world.test.ts
  - test-bun/projection-routes.test.ts
  - src/viewers/tui/projection-sheet.ts
  - src/viewers/tui/model.ts
  - docs/viewers/tui/index.md
  - test-bun/chrome.test.ts
  - test-bun/tree.test.ts
priority: high
type: bug
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens `groma view` in an initialized non-empty project, Groma shows the root and container maps approved in the Terminal Facelift reference. TASK-28 later replaced the fitted island-and-row representation delivered by TASK-238 with a fixed sheet projection, so the supported opening screen no longer matches the approved design or TASK-238 acceptance criteria.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At 120 columns and wider, opening `groma view` shows the root map with hierarchy, map and details panes; a container row is selected, its system island is fitted and centered, and neighbouring islands peek at both sides
- [x] #2 The root map places actor, system and external islands west to east; every system lists one row per container with its kind glyph, one block per component and its current task at the row end; groups and container slabs are absent
- [x] #3 Enter on a container row opens its fitted container map with zones, building floors, task corners, routes and sibling-container peeking; Backspace returns to the same root selection
- [x] #4 Arrow navigation follows the approved island, row, building and sibling rules; the camera pans or scrolls only as far as the selected subject needs and map cells remain stable while the selection stays on screen
- [x] #5 The approved grey-and-one-green surface, building, route and work styling remains intact, as do search, details, source, diff, history, live update and empty-project behavior
- [x] #6 `tui-test` captures at 120x36 and 200x60 match the approved root and container examples, the generated large-world checks pass, and `bun run check` passes
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
1. Recover the fitted root/container projection and navigation domain operations from the verified TASK-238 implementation before TASK-28. 2. Adapt those operations to the current viewer model while preserving newer chrome, details, live-update and empty-project behavior. 3. Restore focused layout, navigation, route and large-world regression tests around the approved opening flow. 4. Validate root and container flows with tui-test at 120x36 and 200x60, then run the full repository check and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recovered the fitted TUI-owned root and container layouts while retaining Core sheet placement as semantic input. Root systems now render container rows with component blocks and work markers; container scope renders zones, component buildings, floors, routes and sibling peeks. Removed the obsolete fixed-sheet TUI adapter.

Verification: tui-test captured the opening root, stable Down/Up selection, Enter container, Backspace return and a 200x60 root under /private/tmp/groma244-tui-artifacts. The 120x36 opening frame matches the Terminal Facelift PDF, including the selected CLI row, centred Groma island and neighbour peeks. The lower empty canvas follows the approved sheet-row placement. Playwright rendered the captured SVG for visual inspection. Focused layout/navigation/projection/chrome/tree tests passed. Final bun run check passed: 104 Node tests and 272 Bun viewer tests. The first full rerun exposed one transient web-live timeout; the isolated file passed 8/8 and the next complete gate passed.

Reviews: the cold simplicity review found no blocking complexity and removed one unused export. The implementer specification and quality reviews found the accepted flow complete. The full-context complexity review found two possible default-selection paths; projection now delegates to the same first-root-row rule as initial navigation, with a regression test. No generic capability layer or compatibility path was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restored the approved Terminal Facelift root and container maps with fitted TUI-owned layouts, stable spatial navigation, task markers and current viewer features. Verified against the 12-page PDF with tui-test at 120x36 and 200x60, Playwright-rendered captures, focused regressions and a green bun run check (104 Node and 272 viewer tests).
<!-- SECTION:FINAL_SUMMARY:END -->
