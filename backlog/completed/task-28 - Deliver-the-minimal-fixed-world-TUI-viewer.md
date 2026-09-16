---
id: TASK-28
title: Deliver the minimal fixed-world TUI viewer
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 19:07'
updated_date: '2026-09-05 15:23'
labels: []
dependencies: []
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
  - projection
  - navigation
  - screen
  - terminal-painting
  - core
  - world-layout
  - architecture-model
  - projection-sheet
  - projection-root
  - terminal-viewer-projection-root
  - terminal-viewer-projection-container
modified_files:
  - src/viewers/tui/projection-sheet.ts
  - src/viewers/tui/projection-root.ts
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/molecules/row.ts
  - test-bun/root-layout.test.ts
  - test-bun/container-layout.test.ts
  - test-bun/projection.test.ts
  - test-bun/large-world.test.ts
  - test-bun/navigation.test.ts
  - test-bun/routes.test.ts
  - docs/viewers/tui/index.md
  - src/core.ts
  - src/types.ts
  - test/core.test.ts
  - test-bun/openclaw-view.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/sheet-scene.test.ts
  - src/world-layout.ts
  - test/world-layout.test.ts
  - package.json
  - bun.lock
  - test-bun/projection-routes.test.ts
  - test-bun/chrome.test.ts
  - test-bun/tree.test.ts
  - docs/product-model.md
  - groma/systems/groma/containers/core/container.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - groma/systems/groma/containers/core/components/world-layout.md
  - groma/systems/groma/containers/view-host/components/projection-sheet.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/projection-sheet.md
  - groma/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/systems/groma/containers/terminal-viewer/components/projection-root.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/projection-container.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/terminal-viewer-projection-root.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/terminal-viewer-projection-container.md
  - groma/systems/groma/containers/terminal-viewer/components/row.md
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the human architect a terminal interface for reviewing the annotated architecture returned by Groma core as one fixed nested world. The map sits inside fixed chrome and uses one readable scale: larger terminals reveal more canvas instead of changing geometry. Root scope shows the architecture landscape; Enter opens only a container's component scope; Backspace returns to root; arrows select visible peers while the camera moves only enough to keep the selection visible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running groma view in an initialized non-empty project opens the terminal viewer with the complete annotated architecture and shared fixed sheet supplied through Groma core
- [x] #2 The viewer renders one fixed world with directed routes and never reads architecture Markdown or calculates world layout itself
- [x] #3 The screen keeps one-row header and footer chrome around reserved hierarchy, map, and details panes, with one blank row above and below
- [x] #4 The root map shows actors, systems, containers, collapsed groups, and external systems without component cards
- [x] #5 Enter opens only a container scope with that container, its groups, and components; Backspace returns to root; arrows never change scope
- [x] #6 Arrowing selects the nearest visible peer in its direction, and the camera pans only enough to keep that selection visible
- [x] #7 Cards, routes, and relationship labels keep the same world cells while selection stays on screen, and the details pane follows the current selection
- [x] #8 Terminal-theme-compatible observed and draft marks remain visible; Escape leaves the focused mode without exiting; Ctrl+C exits and restores the terminal
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence
- [x] #2 Relevant checks pass and changes remain task-scoped
- [x] #3 Public contracts or documentation are updated when behavior changes
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes
- [x] #5 All 24 TASK-28 child slices are Done
- [x] #6 Focused core-model, projection, rendering, navigation, details, and lifecycle suites plus bun run check pass
- [x] #7 A real-terminal walkthrough records root, details, one container scope, stable navigation, a 200x60 view, and exit
- [x] #8 The required cold simplicity and full-context complexity reviews find no unresolved material issue
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Project the shared sheet into fixed terminal cells, preserving item and route coordinates across viewport sizes.
2. Show the root landscape and one isolated container scope with nearest-peer arrows and minimal camera reveal.
3. Remove the superseded width-fitted row layout, replacement route builder, and unused ELK world pipeline.
4. Align TUI documentation and behavioral tests, then verify with focused suites, tui-test at 120x36 and 200x60, and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parent contract correction on 2026-09-03: the original criteria described the superseded semantic-zoom and overlay viewer from early TASK-28 child slices. The authoritative project TUI contract now requires fixed chrome, fixed world coordinates and scale, root/container scopes, nearest-peer arrows, and details that follow selection. The parent criteria now describe the delivered design; obsolete plus/minus zoom, planned/missing chips, overlay, and full-screen details are not restored.

Cold simplicity review on 2026-09-03 found a blocking contract gap: the TUI still recomputes width-dependent root/container geometry and routes, container arrows can cross scope, and the camera centres holders instead of revealing minimally. TASK-28 remains In Progress for this correction.

Implementation correction completed on 2026-09-03: root and container views now project shared sheet geometry at one fixed terminal scale; shared route points remain authoritative; root includes collapsed groups and hides components; container scope excludes neighbours; arrows use one nearest-visible-peer rule; camera movement only reveals the current target. Removed the row renderer and the unused ELK world loader, implementation, dependency, and layout-only tests. Updated public TUI documentation and stale width-fit/navigation tests.

Verification: focused fixed-world suite 32/32; focused chrome/tree/details/lifecycle/surface suites 32/32 (the history watcher also passes in the full unsandboxed run); real tui-test captured 120x36 root/details and 200x60 root/container/arrow/Backspace/Ctrl+C; full bun run check passed outside the sandbox with 104 Node tests and 268 Bun tests. The lint step reports the same 13 existing complexity warnings and no errors.

Full-context complexity review: runtime ownership and flow were judged direct and domain-local. It found one material self-architecture issue: duplicate projection records, projection-sheet under the wrong container, and an obsolete empty row record. Resolved through Groma curation by folding all six projection source files into the existing terminal-viewer projection component and removing the duplicate and obsolete records. bun scripts/validate-architecture.ts then passed with 113 elements, 98 relationships, and 1 draft. The implementer verified the review finding is fully resolved; no optional findings remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the fixed-world TUI on the shared sheet: stable terminal coordinates and routes, isolated root/container scopes, nearest-peer navigation, minimal camera reveal, fixed chrome, current-selection details, and clean exit. Removed the replaced row/width-fit renderer and unused ELK world pipeline. Updated public docs and consolidated projection ownership in the Groma self-map. Verified with focused suites, real tui-test sessions at 120x36 and 200x60, architecture validation, and bun run check (104 Node + 268 Bun tests).
<!-- SECTION:FINAL_SUMMARY:END -->
