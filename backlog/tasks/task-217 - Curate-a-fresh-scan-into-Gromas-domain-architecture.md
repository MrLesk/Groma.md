---
id: TASK-217
title: Curate a fresh scan into Groma's domain architecture
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 15:13'
updated_date: '2026-08-30 17:29'
labels: []
dependencies: []
references:
  - accept
  - architecture-comparison
  - architecture-model
  - architecture-reader
  - architecture-watch
  - architecture-writer
  - backlog-plugin
  - c-scanner
  - chrome
  - cli
  - coding-agent
  - commands
  - core
  - create
  - details
  - edit
  - flow
  - flow-controls
  - git
  - groma
  - hierarchy
  - human-architect
  - instructions
  - iso-camera
  - iso-map
  - iso-projection
  - layer-modes
  - navigation
  - observed-curation
  - page
  - plain-text-view
  - project-editor
  - project-profile
  - projection
  - render
  - revision-history
  - scan-lifecycle
  - scan-observation
  - scanner
  - screen
  - sheet-composition
  - sheet-routing
  - source-viewer
  - task-diff
  - terminal-host
  - terminal-painting
  - terminal-viewer
  - typescript-scanner
  - view-host
  - viewer-semantics
  - web-server
  - web-shell
  - web-viewer
  - web-viewer-details
  - web-viewer-hierarchy
  - welcome
  - work-focus
  - work-overlay
  - work-projection
  - world-layout
  - world-loader
modified_files:
  - src/architecture-path.ts
  - src/markdown-emitter.ts
  - src/scan-reconciler.ts
  - src/accept.ts
  - src/create.ts
  - src/curate.ts
  - src/edit.ts
  - src/cli.ts
  - test/create.test.ts
  - test/edit.test.ts
  - src/instructions.ts
  - docs/index.md
  - docs/agent-instructions/index.md
  - src/relate.ts
  - test/relate.test.ts
  - docs/product-model.md
  - docs/component-markdown.md
  - test/curate.test.ts
  - >-
    groma/observed/systems/groma/containers/cli/components/architecture-comparison.md
  - groma/observed/systems/groma/containers/cli/components/architecture-path.md
  - groma/observed/systems/groma/containers/cli/components/cli-git.md
  - groma/observed/systems/groma/containers/cli/components/curate.md
  - groma/observed/systems/groma/containers/cli/components/relate.md
  - >-
    groma/observed/systems/groma/containers/cli/components/validate-architecture.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/chrome.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/details.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/flow.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/hierarchy.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/paint.md
  - groma/observed/systems/groma/containers/web-viewer/components/control.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/flow-controls.md
  - groma/observed/systems/groma/containers/web-viewer/components/kind.md
  - groma/observed/systems/groma/containers/web-viewer/components/mode.md
  - groma/observed/systems/groma/containers/web-viewer/components/orbit.md
  - groma/observed/systems/groma/containers/web-viewer/components/pointer.md
  - groma/observed/systems/groma/containers/web-viewer/components/project.md
  - groma/observed/systems/groma/containers/web-viewer/components/separation.md
  - groma/observed/systems/groma/containers/web-viewer/components/shell.md
  - groma/observed/systems/groma/containers/web-viewer/components/structure.md
  - groma/observed/systems/groma/containers/web-viewer/components/view.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-control.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-hierarchy.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-paint.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-view.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/work-overlay.md
  - groma/observed/README.md
  - groma/observed/actors/coding-agent.md
  - groma/observed/actors/human-architect.md
  - groma/observed/systems/git/system.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - groma/observed/systems/groma/containers/cli/components/create.md
  - groma/observed/systems/groma/containers/cli/components/edit.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - >-
    groma/observed/systems/groma/containers/cli/components/lint-web-scrollbars.md
  - groma/observed/systems/groma/containers/cli/components/naming.md
  - groma/observed/systems/groma/containers/cli/components/plain-world.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - groma/observed/systems/groma/containers/cli/container.md
  - groma/observed/systems/groma/containers/core/components/accept.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-reader.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-watch.md
  - groma/observed/systems/groma/containers/core/components/markdown-emitter.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/core/components/scan-reconciler.md
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - groma/observed/systems/groma/containers/core/components/world-layout.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/core/container.md
  - groma/observed/systems/groma/containers/scanner/components/.gitkeep
  - groma/observed/systems/groma/containers/scanner/components/csharp-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/scan.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-observation.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/container.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/action-path.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/layout.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation-spatial.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-routes.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/relationship-text.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/tree.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/work-focus.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - groma/observed/systems/groma/containers/view-host/container.md
  - groma/observed/systems/groma/containers/web-viewer/components/button.md
  - groma/observed/systems/groma/containers/web-viewer/components/highlight.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-camera.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/map-debug.md
  - groma/observed/systems/groma/containers/web-viewer/components/motion.md
  - groma/observed/systems/groma/containers/web-viewer/components/page.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-chrome.md
  - groma/observed/systems/groma/containers/web-viewer/container.md
  - groma/observed/systems/groma/system.md
  - >-
    groma/observed/systems/groma/containers/cli/components/architecture-model-helpers.md
  - groma/observed/systems/groma/containers/cli/components/cli-cli.md
  - groma/observed/systems/groma/containers/cli/components/helpers.md
  - groma/observed/systems/groma/containers/cli/components/text.md
  - groma/observed/systems/groma/containers/core/components/core-core.md
  - groma/observed/systems/groma/containers/core/components/core-types.md
  - groma/observed/systems/groma/containers/core/components/observation.md
  - >-
    groma/observed/systems/groma/containers/create/components/architecture-path.md
  - groma/observed/systems/groma/containers/create/components/create-create.md
  - >-
    groma/observed/systems/groma/containers/create/components/markdown-emitter.md
  - groma/observed/systems/groma/containers/create/components/naming.md
  - groma/observed/systems/groma/containers/create/container.md
  - groma/observed/systems/groma/containers/edit/components/curate.md
  - groma/observed/systems/groma/containers/edit/components/edit-edit.md
  - groma/observed/systems/groma/containers/edit/container.md
  - >-
    groma/observed/systems/groma/containers/plain-world/components/plain-world-plain-world.md
  - groma/observed/systems/groma/containers/plain-world/container.md
  - groma/observed/systems/groma/containers/relate/components/relate-relate.md
  - groma/observed/systems/groma/containers/relate/container.md
  - groma/observed/systems/groma/containers/scanner/components/adapter.md
  - groma/observed/systems/groma/containers/scanner/components/files.md
  - groma/observed/systems/groma/containers/scanner/components/graph.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-scanner.md
  - groma/observed/systems/groma/containers/scene/components/compose.md
  - groma/observed/systems/groma/containers/scene/components/element-order.md
  - groma/observed/systems/groma/containers/scene/components/forces.md
  - groma/observed/systems/groma/containers/scene/components/grid.md
  - groma/observed/systems/groma/containers/scene/components/measure.md
  - groma/observed/systems/groma/containers/scene/components/pack.md
  - groma/observed/systems/groma/containers/scene/components/place.md
  - groma/observed/systems/groma/containers/scene/components/rank.md
  - groma/observed/systems/groma/containers/scene/components/route-geometry.md
  - groma/observed/systems/groma/containers/scene/components/route-lanes.md
  - groma/observed/systems/groma/containers/scene/components/route-spacing.md
  - groma/observed/systems/groma/containers/scene/components/route.md
  - groma/observed/systems/groma/containers/scene/components/scene-scene.md
  - groma/observed/systems/groma/containers/scene/components/types.md
  - groma/observed/systems/groma/containers/scene/container.md
  - groma/observed/systems/groma/containers/server/components/backlog-mark.md
  - groma/observed/systems/groma/containers/server/components/badge.md
  - groma/observed/systems/groma/containers/server/components/blueprint.md
  - groma/observed/systems/groma/containers/server/components/button.md
  - groma/observed/systems/groma/containers/server/components/camera.md
  - groma/observed/systems/groma/containers/server/components/control.md
  - groma/observed/systems/groma/containers/server/components/editor.md
  - groma/observed/systems/groma/containers/server/components/highlight.md
  - groma/observed/systems/groma/containers/server/components/island.md
  - groma/observed/systems/groma/containers/server/components/kind.md
  - groma/observed/systems/groma/containers/server/components/list.md
  - groma/observed/systems/groma/containers/server/components/map-debug.md
  - groma/observed/systems/groma/containers/server/components/map.md
  - groma/observed/systems/groma/containers/server/components/marks.md
  - groma/observed/systems/groma/containers/server/components/motion.md
  - groma/observed/systems/groma/containers/server/components/orbit.md
  - groma/observed/systems/groma/containers/server/components/page.md
  - groma/observed/systems/groma/containers/server/components/paint-buildings.md
  - groma/observed/systems/groma/containers/server/components/paint-ground.md
  - groma/observed/systems/groma/containers/server/components/paint-routes.md
  - groma/observed/systems/groma/containers/server/components/payload.md
  - groma/observed/systems/groma/containers/server/components/pins.md
  - groma/observed/systems/groma/containers/server/components/pointer.md
  - >-
    groma/observed/systems/groma/containers/server/components/project-markdown.md
  - groma/observed/systems/groma/containers/server/components/project-profile.md
  - groma/observed/systems/groma/containers/server/components/project.md
  - groma/observed/systems/groma/containers/server/components/read.md
  - groma/observed/systems/groma/containers/server/components/render.md
  - groma/observed/systems/groma/containers/server/components/row.md
  - groma/observed/systems/groma/containers/server/components/scale.md
  - groma/observed/systems/groma/containers/server/components/selection.md
  - groma/observed/systems/groma/containers/server/components/separation.md
  - groma/observed/systems/groma/containers/server/components/server-chrome.md
  - >-
    groma/observed/systems/groma/containers/server/components/server-control-2.md
  - groma/observed/systems/groma/containers/server/components/server-control.md
  - groma/observed/systems/groma/containers/server/components/server-details.md
  - groma/observed/systems/groma/containers/server/components/server-git.md
  - >-
    groma/observed/systems/groma/containers/server/components/server-hierarchy.md
  - groma/observed/systems/groma/containers/server/components/server-paint.md
  - groma/observed/systems/groma/containers/server/components/server-pins.md
  - groma/observed/systems/groma/containers/server/components/server-project.md
  - groma/observed/systems/groma/containers/server/components/server-read.md
  - >-
    groma/observed/systems/groma/containers/server/components/server-selection.md
  - groma/observed/systems/groma/containers/server/components/server-server.md
  - groma/observed/systems/groma/containers/server/components/server-text.md
  - groma/observed/systems/groma/containers/server/components/server-theme.md
  - groma/observed/systems/groma/containers/server/components/server-view-2.md
  - groma/observed/systems/groma/containers/server/components/server-view.md
  - groma/observed/systems/groma/containers/server/components/shell.md
  - groma/observed/systems/groma/containers/server/components/sidebar-section.md
  - groma/observed/systems/groma/containers/server/components/state.md
  - groma/observed/systems/groma/containers/server/components/status-filter.md
  - groma/observed/systems/groma/containers/server/components/structure.md
  - groma/observed/systems/groma/containers/server/components/style.md
  - groma/observed/systems/groma/containers/server/components/svg.md
  - groma/observed/systems/groma/containers/server/components/tip.md
  - groma/observed/systems/groma/containers/server/components/url.md
  - groma/observed/systems/groma/containers/server/components/view.md
  - groma/observed/systems/groma/containers/server/components/visible.md
  - groma/observed/systems/groma/containers/server/container.md
  - groma/observed/systems/groma/containers/view-host/components/action-path.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/architecture-watch.md
  - groma/observed/systems/groma/containers/view-host/components/backlog.md
  - groma/observed/systems/groma/containers/view-host/components/border.md
  - groma/observed/systems/groma/containers/view-host/components/boundary.md
  - groma/observed/systems/groma/containers/view-host/components/card.md
  - groma/observed/systems/groma/containers/view-host/components/cell.md
  - groma/observed/systems/groma/containers/view-host/components/chrome.md
  - groma/observed/systems/groma/containers/view-host/components/details.md
  - groma/observed/systems/groma/containers/view-host/components/flow-marker.md
  - groma/observed/systems/groma/containers/view-host/components/flow.md
  - groma/observed/systems/groma/containers/view-host/components/hatch.md
  - groma/observed/systems/groma/containers/view-host/components/hierarchy.md
  - groma/observed/systems/groma/containers/view-host/components/layout.md
  - groma/observed/systems/groma/containers/view-host/components/model.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/navigation-spatial.md
  - groma/observed/systems/groma/containers/view-host/components/navigation.md
  - groma/observed/systems/groma/containers/view-host/components/paint.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/projection-routes.md
  - groma/observed/systems/groma/containers/view-host/components/projection.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/relationship-text.md
  - groma/observed/systems/groma/containers/view-host/components/spine.md
  - groma/observed/systems/groma/containers/view-host/components/theme.md
  - groma/observed/systems/groma/containers/view-host/components/tree.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-model.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-navigation.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-paint.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-route.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-terminal-viewer.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/view-host-view-host.md
  - groma/observed/systems/groma/containers/view-host/components/world.md
  - src/scanner/typescript/files.ts
  - test-bun/scanner-evidence.test.ts
  - groma/observed/systems/groma/containers/cli/components/observed-curation.md
  - groma/observed/systems/groma/containers/cli/components/plain-text-view.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-writer.md
  - groma/observed/systems/groma/containers/core/components/sheet-composition.md
  - groma/observed/systems/groma/containers/core/components/sheet-routing.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scan-observation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/terminal-painting.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/viewer-semantics.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/layer-modes.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-shell.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/revision-history.md
  - groma/observed/systems/groma/containers/scanner/components/c-scanner.md
  - scripts/validate-architecture.ts
  - test/validate-architecture.test.ts
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect starts from a fresh groma scan and curates its atomic file evidence through Groma, the Web map shows a minimal domain-owned architecture rather than scattered file-shaped components. Rebuild this repository observed architecture from fresh scan evidence, restoring the applicable descriptions, authored relationships, and annotations from the previous model without preserving obsolete IDs or structure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Groma exposes a supported operation to assign or clear a sibling component group without direct Markdown editing
- [x] #2 Groma exposes a defensive operation to combine scanner-created component evidence into one named component without duplicate Code ownership or partial writes
- [x] #3 A fresh scan of this repository is curated into the approved CLI, Core, Scanner, Terminal viewer, View host, and Web viewer domain groups
- [x] #4 The rebuilt architecture restores applicable human descriptions and authored relationships while removing stale, empty, duplicate, and file-shaped components
- [x] #5 The resulting Web map and plain architecture view show the same minimal grouped model, and architecture validation plus bun run check pass
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
1. Extend the existing authoring path so `create --observed` builds the semantic scaffold and `edit` groups, ungroups, moves, or combines observed scan evidence. Keep plan authoring unchanged.
2. Centralize architecture paths and Markdown field rewrites. Validate each structural operation completely before writing.
3. Add focused tests for observed creation, structural curation, preserved meaning, relationship authoring, and rejected operations that leave the tree unchanged. Update the public authoring docs.
4. Exclude test-support directories from TypeScript scan input, then rebuild `groma/observed` from one fresh scan.
5. Curate atomic evidence into CLI, Core, Scanner, Terminal viewer, View host, and Web viewer domains. Restore only applicable descriptions, annotations, and relationships.
6. Remove stale, empty, duplicate, singleton-group, and file-shaped architecture records without preserving obsolete IDs.
7. Add the minimum observed relationship command needed to author and remove exact collaborations defensively.
8. Verify focused tests, repeated clean scans, model invariants, architecture validation, plain output, the rendered Web map, `bun run check`, and the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and focused-tested the defensive authoring boundary: observed creation, group set/clear, empty component moves, and empty component/container combination. All 24 create/edit/accept focused tests pass; targeted TypeScript and Biome checks pass with no new complexity warning.

Added observed metadata and relationship authoring required for the clean rebuild; 31 focused authoring tests pass, then structural tests were moved into test/curate.test.ts to keep test/edit.test.ts below 500 lines. Full check reaches the suite but two watch tests fail from EMFILE while parallel viewer work is active; typecheck and task-focused tests pass.

Fresh rebuild verification: two consecutive `groma scan` runs each reported created 0, refreshed 51, matched 0. Architecture validation reports 61 elements and 67 relationships. A model invariant check reports 51 components, 133 uniquely owned existing Code files, no duplicate owners, no blank components, and no singleton groups. The plain view reports the same 2 actors, 2 systems, 6 containers, and 51 components as the Web header. Browser QA exercised the Web container and Source viewer build evidence with no console errors. `bun run check` passes outside the restricted watcher sandbox: 90 Node tests and 178 Bun tests, zero failures.

Full-context architecture review: the six-container, domain-grouped model and 67 concrete relationships should remain. One blocking defensive finding remains for Alex's decision: `groma edit --combine` rejects authored prose and relationships on source records but can still delete authored `group` or `technology` metadata from an otherwise empty source. The smallest in-scope fix is to reject such sources and add one unchanged-tree regression case. Optional non-blocking follow-up: create/edit do not consistently reject trim-empty authored names or descriptions.

Applied the accepted final review fix: combine sources carrying authored `group` or `technology` metadata are rejected before rewrite preparation. The regression covers both metadata fields and proves the complete architecture tree remains unchanged after each rejection. Focused result: 10 tests passed. The targeted re-review found the original issue resolved with no new in-scope finding. Final `bun run check` result on the shared workspace: 90 Node tests and 193 Bun tests passed, zero failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt observed architecture from fresh scan evidence into six domain containers with grouped atomic responsibilities, restored current descriptions and collaborations, and removed stale file-shaped structure. Added defensive observed creation, grouping, moving, combining, and relationship authoring through Groma, with shared path and Markdown ownership. Verified repeated clean scans, 61-element plain/Web parity, 133 unique owned Code files, browser Source inspection, architecture validation, focused rejection invariants, and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
