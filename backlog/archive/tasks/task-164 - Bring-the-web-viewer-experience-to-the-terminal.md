---
id: TASK-164
title: Bring the web viewer experience to the terminal
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-23 21:19'
updated_date: '2026-08-23 23:17'
labels: []
dependencies: []
references:
  - terminal-host
  - web-server
  - world-loader
  - sheet
  - tree
  - screen
  - render
  - projection
  - layout
  - view-host
  - page
  - sheet-router
  - details
  - drawing
  - hierarchy
  - interaction
  - state
  - work
  - architecture-model
  - details-renderer
  - work-projection
  - action-path
  - relationship-text
  - terminal-viewer
  - scanner-plugin
  - core
  - iso-map
  - iso-projection
modified_files:
  - src/viewers/payload.ts
  - src/viewer-model.ts
  - src/viewers/interaction.ts
  - src/viewers/tree.ts
  - src/viewers/kind.ts
  - src/viewers/details.ts
  - src/viewers/tui/state.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/layout.ts
  - src/viewers/tui/drawing.ts
  - src/viewers/tui/map.ts
  - src/viewers/tui/hierarchy.ts
  - src/viewers/tui/details.ts
  - src/viewers/tui/work.ts
  - src/viewers/tui/chrome.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/view-host.ts
  - src/viewers/web/server.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/organisms/hierarchy.ts
  - groma/observed/systems/groma/containers/core/components/sheet-router.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - groma/observed/systems/groma/containers/payload/container.md
  - >-
    groma/observed/systems/groma/containers/payload/components/projection-display.md
  - groma/observed/systems/groma/containers/view-host/components/details.md
  - groma/observed/systems/groma/containers/view-host/components/drawing.md
  - groma/observed/systems/groma/containers/view-host/components/hierarchy.md
  - groma/observed/systems/groma/containers/view-host/components/interaction.md
  - groma/observed/systems/groma/containers/view-host/components/state.md
  - groma/observed/systems/groma/containers/view-host/components/work.md
  - groma/observed/systems/groma/containers/viewer-model/container.md
  - groma/observed/systems/groma/containers/viewer-model/components/forces.md
  - groma/observed/systems/groma/containers/viewer-model/components/grid.md
  - groma/observed/systems/groma/containers/viewer-model/components/pack.md
  - groma/observed/systems/groma/containers/viewer-model/components/place.md
  - >-
    groma/observed/systems/groma/containers/viewer-model/components/port-layout.md
  - groma/observed/systems/groma/containers/viewer-model/components/rank.md
  - src/types.ts
  - src/core.ts
  - src/work/pins.ts
  - src/viewers/web/payload.ts
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - groma/observed/systems/groma/containers/core/components/forces.md
  - groma/observed/systems/groma/containers/core/components/grid.md
  - groma/observed/systems/groma/containers/core/components/pack.md
  - groma/observed/systems/groma/containers/core/components/place.md
  - groma/observed/systems/groma/containers/core/components/port-layout.md
  - groma/observed/systems/groma/containers/core/components/rank.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/drawing.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/hierarchy.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/state.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/work.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/details-renderer.md
  - groma/observed/systems/groma/containers/view-host/components/tree.md
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/url.ts
  - src/viewers/web/work/island.ts
  - test-bun/work-selection.test.ts
  - test-bun/web-selection.test.ts
  - test-bun/work-status-filter.test.ts
  - test-bun/web-flow-selection.test.ts
  - test-bun/web-url.test.ts
  - test-bun/inspect-details.test.ts
  - src/viewers/web/selection.ts
  - src/viewers/web/flow/state.ts
  - src/viewers/web/work/selection.ts
  - src/viewers/web/work/status-filter.ts
  - src/viewers/web/atoms/kind.ts
  - test-bun/camera.test.ts
  - test-bun/chrome.test.ts
  - test-bun/navigation.test.ts
  - test-bun/openclaw-view.test.ts
  - test-bun/projection-routes.test.ts
  - test-bun/projection.test.ts
  - test-bun/semantic-view.test.ts
  - test-bun/tui-campus.test.ts
  - test-bun/tree.test.ts
  - src/viewers/tui/atoms/border.ts
  - src/viewers/tui/atoms/cell.ts
  - src/viewers/tui/atoms/kind.ts
  - src/viewers/tui/atoms/text.ts
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/atoms/visible.ts
  - src/viewers/tui/camera.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/molecules/hatch.ts
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/molecules/selection.ts
  - src/viewers/tui/molecules/spine.ts
  - src/viewers/tui/molecules/work-marker.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/organisms/chrome.ts
  - src/viewers/tui/organisms/details.ts
  - src/viewers/tui/organisms/hierarchy.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/projection-display.ts
  - src/viewers/tui/projection-routes.ts
  - src/viewers/tui/tree.ts
  - test/world-layout.test.ts
  - test/core.test.ts
  - test-bun/web-page.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/sheet-grow.test.ts
  - test-bun/action-path.test.ts
  - test-bun/helpers.ts
  - test-bun/viewer-lifecycle.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/work.test.ts
  - src/work/projection.ts
  - src/element-order.ts
  - src/semantic-city.ts
  - src/semantic-view.ts
  - src/world-layout.ts
  - package.json
  - bun.lock
  - test-bun/terminal-state.test.ts
  - test-bun/terminal-projection.test.ts
  - test-bun/terminal-layout.test.ts
  - groma/observed/systems/groma/containers/view-host/components/action-path.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/action-path.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/relationship-text.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/relationship-text.md
  - groma/observed/systems/groma/containers/core/components/semantic-city.md
  - groma/observed/systems/groma/containers/core/components/semantic-view.md
  - groma/observed/systems/groma/containers/core/components/world-layout.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation-spatial.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-camera.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection-routes.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/layout.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - groma/observed/systems/groma/containers/view-host/container.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - docs/viewers/tui/index.md
  - docs/viewers/index.md
  - docs/viewers/creating-a-plugin.md
  - docs/product-model.md
  - docs/scanners/typescript/expected.txt
  - docs/viewers/web/index.md
  - docs/scanners/typescript/observation.txt
  - groma/observed/systems/groma/containers/terminal-viewer/components/tree.md
  - groma/observed/systems/groma/containers/core/container.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - test-bun/web-no-elk.test.ts
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - test-bun/work-pins.test.ts
priority: high
type: feature
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect runs `groma view`, the terminal presents the same single-world interaction model as the current web viewer in a flat terminal rendering. The map keeps actors west, internal systems in the middle, and external systems east. The web viewer remains behaviorally unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The terminal shows actors, internal systems, external systems, containers, components, groups, and relationships together in one stable flat world.
- [x] #2 Zoom changes only magnification; it never changes the represented architecture, enters a semantic level, or rearranges the world.
- [x] #3 The hierarchy, flow activation, architecture selection, work selection, details, pane visibility, and deselection rules match the current web viewer using terminal controls.
- [x] #4 The first view fits the complete map, manual camera movement is preserved across live updates, and work-only updates do not recompute layout or move the camera.
- [x] #5 Active flows light their relationship paths, and active work highlights every architecture element touched by the selected tasks.
- [x] #6 The terminal remains usable at 120x36 and 200x60, with names and details available through selection.
- [x] #7 The current web viewer has no visual or interaction behavior changes.
- [x] #8 Automated tests cover navigation state, selection, projection, camera, work updates, and world immutability with minimum fixtures.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 The supported terminal flow is verified with agent-tty at 120x36 and 200x60.
- [x] #6 Repository-facing implementation and task records use Groma terminology only.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make the terminal host publish the same immutable architecture graph, sheet scene, complete work snapshot, and work pins used by the current viewer model, with architecture and work updates kept independent.
2. Reuse the current pure selection, flow, task, status-filter, tree, action-path, and details rules from shared viewer domains while leaving web behavior unchanged.
3. Replace the terminal semantic-level and ELK projection path with one domain-grouped flat map renderer over SheetScene: actors west, systems central, external systems east, stable geometry, continuous camera magnification, spatial selection, and flat routes.
4. Rebuild the terminal shell around the current interaction model: compact header, retractable hierarchy with folded flows and structure, conditional What/How details, reserved live-work strip with filters and task activation, help, and clear keyboard controls.
5. Preserve selection and a user-moved camera across architecture updates; apply work-only updates without recomposing or moving the map.
6. Delete superseded semantic-level navigation, projection, tests, architecture declarations, and dependencies made obsolete by the single sheet path; update terminal and shared-viewer documentation to describe only the final system.
7. Add minimum concurrent fixtures and focused tests for state, projection, camera, work updates, and immutability; verify rendered behavior with agent-tty at 120x36 and 200x60.
8. Run the task-scoped subtraction pass, required cold simplicity review, regular specification and quality checks, then the full-context architecture review before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the single-world terminal viewer on ArchitectureGraph plus the immutable SheetScene. The terminal now has fixed hierarchy, map, details, work, header, and footer regions; one derived interaction state owns architecture, relationship, flow, task, filter, pane, details-cursor, and camera-touch state. Architecture and work publications are independent. Shared pure selection, tree, details, kind, action-path, and relationship rules remain under the view-host boundary; terminal painting and interaction modules belong to terminal-viewer; sheet geometry helpers remain implementation evidence owned by sheet and sheet-router. The browser viewer keeps its existing visible behavior and now imports the shared pure rules. Plain text view remains on AnnotatedArchitectureModel.

Legacy semantic-city, semantic-view, world-layout, ELK dependencies, semantic navigation/projection modules, atomic terminal renderer, duplicate browser state modules, obsolete tests, and obsolete architecture records were deleted. No compatibility or fallback path remains.

Verification:
- `bun run check` passed after the final navigation fix: TypeScript 7.0.2 typecheck, 90/90 Node tests, and 140/140 Bun viewer tests.
- `bun test --timeout 20000 test-bun/terminal-projection.test.ts` passed 6/6 after adding relationship-endpoint arrow coverage.
- `bun test --timeout 20000 test-bun/web-live.test.ts` passed 3/3. The first full `bun run test:viewer` attempt had 139 passes and one 20-second timeout in the live web Markdown-watch test; that test passed alone in 0.96 seconds and both later full checks passed.
- `git diff --check` passed. All TypeScript source and test files are at or below 500 lines; the largest is 498 lines.
- `bun src/cli.ts view --plain` succeeded on the current architecture (169 lines; 2 actors, 2 systems, 6 containers, 40 components), preserving the plain output path.

Terminal proof used an isolated agent-tty home after `agent-tty --home <temp> doctor --json` passed every environment and renderer check. Sessions were launched with `agent-tty --home <temp> create --json --cols 120 --rows 36 --cwd /Users/alex/projects/groma3 -- bun src/cli.ts view` and the same command at 200x60. At 120x36, flows expanded and activated, the details cursor entered a relationship and then an endpoint, a sibling arrow kept the map-region SHA-256 exactly `d24bccf706c450fb7568a1abd4c34f48e219e2fd7844a21500469b125721a111` before and after, + and Shift+Right changed only the camera, Live work exposed filters and TASK-164/TASK-156, TASK-164 activation opened its details and pins, Done filtering exposed terminal tasks, help stayed inside the map pane, and R preserved the complete screen hash `634d2ca72c30f31a7803404a6bb1697a4e969edbae0c88cac9fd8d1af50ca963`. At 200x60, initial fit and flow-highlighted 125% zoom/pan both preserved all fixed panes. Sessions were destroyed and `agent-tty ... list --json` returned no sessions.

Evidence artifacts:
- 120x36 selected live task: `/private/tmp/groma-task164-tty.ZjRn6I/sessions/01M0RASMXPEKRER98W87A6GBE3/artifacts/screenshot-92-reference-dark.png` (SHA-256 `b8acbbfd0eaeadfa738ca1eade9bafd6613a1dab133b6ba5db37c11830f8feeb`).
- 120x36 help: `/private/tmp/groma-task164-tty.ZjRn6I/sessions/01M0RASMXPEKRER98W87A6GBE3/artifacts/screenshot-101-reference-dark.png` (SHA-256 `82189a73277ed116f9d9f6c1c6f70de829365de356b3eb804d592d83830e4545`).
- 200x60 initial fit: `/private/tmp/groma-task164-tty.ZjRn6I/sessions/01M0RAWNRZ7BY6V5SNM7H77HHM/artifacts/screenshot-43-reference-dark.png` (SHA-256 `a74756317bf496fc4b750f95863bb1f83b313481b1139271515353be46792abe`).
- 200x60 flow plus zoom/pan: `/private/tmp/groma-task164-tty.ZjRn6I/sessions/01M0RAWNRZ7BY6V5SNM7H77HHM/artifacts/screenshot-163-reference-dark.png` (SHA-256 `a4329ebaf39ce13ddf69d274a9223bea50fb47722954dffa4d7d5983fa54cede`).

Non-blocking scanner follow-up: a normal `groma scan` is not idempotent for the final hand-authored multi-file Code lists. Reproduction on a temporary copy was: copy current `src`, `groma`, and `package.json`; initialize and stage a temporary Git repository; run `bun /Users/alex/projects/groma3/src/cli.ts scan`. It reported `created 0, refreshed 58, matched 0` and generated none of forces/grid/pack/place/port-layout/rank, but scan reconciliation replaces a matched element full Code list for each candidate. The first scan therefore leaves only the last matching file for sheet, drawing, interaction, iso-map, render, and similar semantic owners; a later scan can fail or promote the dropped files. TASK-164 does not change scanner reconciliation. The semantically correct multi-file owners are kept hand-authored in the main tree. The live agent-tty source watcher briefly reproduced that collapse after the navigation fix; all approved lists were restored before handoff.

TASK-164 remains In Progress. Acceptance criteria and Definition of Done were not checked, and the task was not finalized.

Post-simplicity review fix pass:
- Removed fixture-owned geometry from `box`, deleted dead terminal test helpers, and removed dummy unit positions from every caller. `test-bun/work-pins.test.ts` was added to the ordered modified-file list.
- Removed mount-time camera and selection injection and the camera branch from `setView`; the selection-only test hook remains because lifecycle, live-update, and work tests need deterministic selection.
- Narrowed terminal building projection to id, name, kind, origin, and bounds; narrowed routes to id and points; the map now paints building kinds without looking elements up in the world. Removed the unused web details type re-export.
- Made work-pane height depend only on explicit expansion, fixed the first forward work move to choose the first row, and removed the map-mode Space action and help entry. Expanded-work publication now has a 200x60 behavior test proving the map anchor does not move.
- Corrected the touched-set, shared details, flat terminal height, and camera-touch wording in the architecture and product docs. Manual `r` refresh remains because it directly reloads Markdown and keeps architecture refresh usable when work loading fails. Scanner reconciliation was not changed.

Post-review verification:
- `bun run typecheck` passed with TypeScript 7.0.2.
- Focused command `bun test --timeout 20000 test-bun/terminal-state.test.ts test-bun/terminal-layout.test.ts test-bun/terminal-projection.test.ts test-bun/work.test.ts test-bun/work-pins.test.ts test-bun/sheet-scene.test.ts test-bun/sheet-route.test.ts test-bun/sheet-grow.test.ts test-bun/web-url.test.ts test-bun/web-page.test.ts` passed 76/76. Its first run passed 75 and failed only because the expanded 120x36 test could not find the `Api` text anchor; the 200x60 supported-size test then passed and directly observed the same map anchor before and after publication.
- `bun run check` passed: TypeScript, 90/90 Node tests, and 141/141 Bun viewer tests.
- `git diff --check`, the added-lines prohibited-name scan, the obsolete-symbol scan, the changed-path traceability audit, and the source/test over-500-line scan all passed. The largest TypeScript file is `src/sheet/route.ts` at 498 lines.
- Exact affected architecture references remain present: screen, state, layout, projection, drawing, terminal-viewer, details, work-projection, render, and view-host.

Final targeted simplicity cleanup:
- Removed the unconsumed `containersFixtureRoot`, `overlaps`, and `contains` exports from `test-bun/helpers.ts`, together with their now-unused `assert`, `Bounds`, and `Point` imports. A multiline import scan confirmed that no test imports any of these helper exports; same-named sheet and test-local functions are independent.
- Corrected the terminal handle contract in `docs/viewers/creating-a-plugin.md` to `setView({ selectionId })`; no camera field or optional-view wording remains.
- `bun test --timeout 20000 test-bun/viewer-lifecycle.test.ts test-bun/tree.test.ts test-bun/work-pins.test.ts test-bun/terminal-state.test.ts` passed 16/16.
- `bun run check` passed with TypeScript 7.0.2, 90/90 Node tests, and 141/141 Bun viewer tests. `git diff --check` and the final dead-export/contract scans passed.

Blocking AC #3 review correction:
- The terminal work renderer now paints nothing when no pins exist. The reserved folded row remains a layout concern and stays unchanged.
- `w` opens work only when pins exist. If an expanded pane loses all pins, its expansion and map layout remain stable; `w` may close that retained state but cannot reopen empty work. Focus cycling still excludes empty work.
- Added isolated renderer coverage for initially empty work: no Live work control is painted and `w` leaves the single `Api` map anchor fixed. Strengthened the work-only publication test so it first loads a pin, expands work, removes every pin, and proves the map anchor remains fixed while the empty control disappears.
- Removed the stale key-count/camera-tween test comment. Corrected terminal work architecture wording from paths to every touched element, and documented that the row is reserved but empty until a mapped pin exists.
- Focused command `bun test --timeout 20000 test-bun/work.test.ts test-bun/viewer-lifecycle.test.ts test-bun/terminal-layout.test.ts test-bun/terminal-state.test.ts` passed 19/19.
- `bun run check` passed with TypeScript 7.0.2, 90/90 Node tests, and 142/142 Bun viewer tests. `git diff --check`, the added-lines prohibited-reference scan, changed-path traceability audit, and source/test size scan passed; the largest TypeScript file remains `src/sheet/route.ts` at 498 lines.
- Exact affected architecture references `work` and `screen` remain present. Scanner reconciliation and the web UI were not changed.

Final AC #3 focus correction:
- Both architecture and work reconciliation now return keyboard focus to the map when their resulting pin set is empty and the hidden work pane owned focus. Expansion, selection, camera-touch, layout, and other interaction state remain unchanged.
- The expanded-to-empty headless test now focuses the visible work pane before removing its final pin, then proves the work control disappears, the single Api map anchor stays fixed, and the map action hint returns. Reducer coverage exercises the same invariant through both reconcileMap and reconcileWork while checking retained work expansion and camera touch.
- Focused command `bun test --timeout 20000 test-bun/work.test.ts test-bun/terminal-state.test.ts test-bun/terminal-layout.test.ts` passed 15/15. The first focused run passed 14/15 and showed that `pressKey("tab")` emits literal text in the renderer harness; changing the test to the harness `pressTab()` input made the intended focus transition and no product code changed for that harness correction.
- `bun run check` passed with TypeScript 7.0.2, 90/90 Node tests, and 142/142 Bun viewer tests. `git diff --check`, the added-lines prohibited-reference scan, and the source/test over-500-line scan passed; the largest TypeScript file remains `src/sheet/route.ts` at 498 lines. Exact affected architecture references `state`, `work`, and `screen` remain present. Scanner reconciliation and the web UI were not changed.

Final review evidence: the targeted specification re-review passed and overall specification readiness passed. The targeted quality re-review passed and overall quality readiness passed. The final independent bun run check passed TypeScript 7.0.2, 90/90 Node tests, and 142/142 Bun viewer tests; git diff --check passed. Fresh current-tree agent-tty renders passed at 120x36 and 200x60. Artifacts: /private/tmp/groma-task164-final.2lbQla/sessions/01M0RDYJ9HPFNK4FEPFQV11CBE/artifacts/screenshot-34-reference-dark.png with SHA-256 a84935ffc093d576b90762324c6af480d91c5a5613a5897f009ba4bc1d0e4472, and /private/tmp/groma-task164-final.2lbQla/sessions/01M0RDYRGNF4GY2CZP1YERRS59/artifacts/screenshot-43-reference-dark.png with SHA-256 b72b7993ebf024cbee1c28329e13310072035d46b7226233bc2d47c5e83a9556. Both sessions were destroyed and the final session list was empty. The final browser regression smoke test loaded 50 elements and 12 flows with no console warnings or errors; one activated flow showed nine legs and nine lit routes, then returned to zero lit routes when deactivated. The full-context architecture review recommends keeping the architecture. It found one optional shared-rule simplification: consolidate the duplicated first-internal-system lookup used by browser and terminal; it also noted one unused terminal import and a non-blocking possible file rename. No recommendation is required for acceptance. These recommendations were presented to Alex and have not been applied pending his decision. TASK-164 remains In Progress and uncommitted.

Acceptance audit complete: all eight acceptance criteria and all six Definition of Done items are now checked from the recorded automated, browser, and agent-tty evidence. The task remains In Progress only for Alex's decision on the optional shared-rule cleanup and his confirmation to finalize, commit, and push.
<!-- SECTION:NOTES:END -->
