---
id: TASK-169
title: Bring the web architecture experience to the terminal
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 19:54'
updated_date: '2026-08-24 20:59'
labels: []
dependencies: []
references:
  - semantic-view
  - projection
  - projection-camera
  - navigation-spatial
  - screen
  - navigation
  - camera
  - terminal-viewer
  - layout
  - projection-routes
  - relationship-text
modified_files:
  - src/semantic-view.ts
  - src/viewers/tui/projection-display.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/organisms/chrome.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/molecules/hatch.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/camera.ts
  - test-bun/camera.test.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - test-bun/projection.test.ts
  - test-bun/semantic-view.test.ts
  - test-bun/tui-theme.test.ts
  - AGENTS.md
  - docs/viewers/tui/index.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/camera.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation-spatial.md
  - src/types.ts
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - test-bun/projection-routes.test.ts
  - test-bun/tui-campus.test.ts
  - src/viewers/tui/layout.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/molecules/selection.ts
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/relationship-text.md
priority: high
type: feature
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs `groma view`, Groma shows a readable terminal-native projection of the same architecture meaning as the web viewer. The root map keeps actors on the left, internal systems with their containers and collapsed groups in the middle, and external systems on the right. A container can open a fixed-scale child map containing its groups and components. The hierarchy and optional details panel remain available for fast navigation and inspection. The map derives grayscale shades and patterns from the terminal palette for light and dark themes; Groma green is its only chromatic map accent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root map shows actors, internal systems, their containers and collapsed named groups, and external systems without showing component cards.
- [x] #2 Enter opens a selected container as a fixed-scale map of its groups and components, Backspace returns to the root map, and no geometric zoom changes the scale.
- [x] #3 The persistent hierarchy lists flows and architecture with the shared `●` actor, `■` system, `□` container, and `▪` component glyphs and stays synchronized with map selection.
- [x] #4 The details panel reserves terminal width when open, shows the current selection, and can be closed without changing world geometry.
- [x] #5 Active flows highlight their promoted routes while unrelated architecture remains visible and stable.
- [x] #6 The map derives a readable grayscale from light and dark terminal palettes, distinguishes actors, systems, containers, groups, and external systems without relying on hue, and uses Groma green as its only colored map accent.
- [x] #7 Architecture and work refreshes preserve valid selection, scope, and viewport state without rearranging the visible map unnecessarily.
- [x] #8 Focused automated tests cover scope transitions, projection and layout invariants, navigation, camera stability, palette rules, world immutability, and lifecycle; `groma view` is visually checked at 120x36 and 200x60.
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
1. Keep the existing ELK-produced ArchitectureWorld as temporary box and route geometry. Do not add another scene adapter and do not change shared placement, routing or dependencies.
2. Simplify the existing TUI projection to two visible scopes over that world: root shows actors, internal systems, containers, collapsed groups and external systems while hiding components; container scope shows the selected container, its groups and components.
3. Use one fixed readable projection scale. Remove geometric zoom and animation; selection only pans the viewport enough to stay visible. Enter opens containers and Backspace returns to root.
4. Keep and adapt the existing hierarchy, details, flows, work markers, search and refresh lifecycle. Hierarchy selection opens the scope where its item is visible, and details always reserves width.
5. Derive neutral surfaces, strokes and patterns from terminal foreground/background. Use ANSI green only for selection and active-flow emphasis on the map.
6. Update focused concurrent tests around the TUI projection, scope, navigation, camera, palette and lifecycle without asserting ELK placement quality. Verify groma view with tui-test at 120x36 and 200x60.

7. Enforce frame stability in the real TUI: selection changes only terminal colors, inactive relationship labels stay off, and routes/cards keep their cells; verify with before/after tui-test map-region comparison.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope correction: placement and routing are being replaced in parallel for both viewers. TASK-169 therefore owns only the TUI scene contract, interaction and painting. Its temporary graph-to-scene adapter is isolated and intentionally minimal so the replacement can remove it without changing the UI.

Plan correction: keeping ELK is the smaller temporary choice. The earlier TerminalScene adapter proposal was unnecessary indirection and will not be implemented. TASK-169 consumes the existing ArchitectureWorld until the parallel placement replacement lands.

Implemented the final two-scope TUI directly over the existing ELK ArchitectureWorld. Removed fit-all zoom, zoom controls, camera animation, the intermediate TUI container level, optional hierarchy state, and the separate camera controller. Root and container scopes use one fixed scale with minimal selection panning; hierarchy, details, flows, search, work, and refresh remain integrated. Cold simplicity review findings were applied and its targeted re-review found no regression. Full-context architecture review found no authority-backed blocker and recommends keeping the current navigation/projection and atoms/molecules/organisms boundaries until the shared placement replacement settles. Verification: bun run check passed 95 Node tests and 178 viewer tests; final focused TUI suite passed 48 tests; tui-test captured root and container views at 120x36 and root at 200x60; + produced a byte-identical frame.

Late tui-test gap audit found a blocking rendered-frame issue: an outer selection border overwrote routes and selection-dependent relationship labels changed map cells even though the camera stayed fixed. This is within AC5 and the TUI map stability contract; fix before final approval.

Completed the missing end-to-end tui-test matrix. The first arrow-frame comparison caught a real paint-layer defect: an outer selection frame and selection-dependent labels changed map cells. Removed that overlay, kept selection as in-place terminal color, and restricted map labels to active flows; details retains all relationship text. Final tui-test evidence: 120x36 root with details open/closed; root-to-CLI container transition; Commands to Plain text view arrow changed details while the full map character region remained byte-identical; r refresh remained byte-identical; active container flow rendered green route cells and its label; / search selected Terminal viewer and synchronized the hierarchy; fresh 200x60 launch rendered 200 columns. Full bun run check passed 95 Node and 178 viewer tests. The repeated full-context complexity review found no blocker.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt groma view as a terminal-native fixed-scale root/container map over temporary ELK geometry. Persistent hierarchy, reserved optional details, collapsed groups, stable promoted flows, terminal-derived grayscale patterns, and one green accent are integrated. The old semantic-zoom camera and paint overlays were removed for a net reduction of 666 lines including the palette test. Verified with 95 Node tests, 178 viewer tests, a complete tui-test interaction matrix at 120x36 and 200x60, byte-identical on-screen arrow and refresh map comparisons, and cold/full-context architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
