---
id: TASK-517
title: Group web map drawing code by component and test the camera layer
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 10:59'
updated_date: '2026-09-24 12:37'
labels: []
dependencies: []
references:
  - shell
  - camera
  - map
  - iso-project
  - presentation
  - map-highlights
  - render
  - map-sharing
  - grid
  - data
  - c4-filter
  - create
  - web-page
modified_files:
  - src/viewers/web/chrome/shortcuts.ts
  - src/viewers/web/iso/camera/camera.ts
  - test-bun/web-shell.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/web-camera-layer.test.ts
  - src/viewers/web/authoring.ts
  - src/viewers/web/chrome/c4-filter.ts
  - src/viewers/web/chrome/map-view.ts
  - src/viewers/web/editing/gestures.ts
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/projection/blueprint.ts
  - src/viewers/web/iso/camera/pointer.ts
  - src/viewers/web/iso/glow.ts
  - src/viewers/web/iso/painting/glow.ts
  - src/viewers/web/iso/grid.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/painting/map.ts
  - src/viewers/web/iso/morph.ts
  - src/viewers/web/iso/view-motion/morph.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/painting/buildings.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/painting/ground.ts
  - src/viewers/web/iso/paint-routes.ts
  - src/viewers/web/iso/painting/routes.ts
  - src/viewers/web/iso/presentation.ts
  - src/viewers/web/iso/view-motion/presentation.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/projection/project.ts
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/painting/scale.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/painting/style.ts
  - src/viewers/web/iso/svg.ts
  - src/viewers/web/iso/painting/svg.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/painting/text.ts
  - src/viewers/web/layers/orbit.ts
  - src/viewers/web/iso/view-motion/orbit.ts
  - src/viewers/web/layers/paint.ts
  - src/viewers/web/iso/painting/layers.ts
  - src/viewers/web/layers/separation.ts
  - src/viewers/web/iso/projection/separation.ts
  - src/viewers/web/map-highlights.ts
  - src/viewers/web/iso/highlights.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/sharing/cover.ts
  - test-bun/building-port-attachment.test.ts
  - test-bun/unidentified-container.test.ts
  - test-bun/web-c4-filter.test.ts
  - test-bun/web-layer-mode.test.ts
  - test-bun/web-map-highlights.test.ts
  - test-bun/web-map-pointer.test.ts
  - test-bun/web-map-presentation.test.ts
  - test-bun/web-selection-camera.test.ts
  - test-bun/web-sheet-morph.test.ts
  - test-bun/web-task-camera.test.ts
  - groma/systems/groma-md/containers/export/components/map.md
  - groma/systems/groma-md/containers/export/components/iso-project.md
  - groma/systems/groma-md/containers/export/components/presentation.md
  - groma/systems/groma-md/containers/export/components/map-highlights.md
  - groma/relationships.md
  - src/viewers/web/iso/painting/layer-planes.ts
type: task
ordinal: 598000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the end-of-task review of TASK-515, approved by Alex on 2026-09-24 ("Do all together"). Camera control now lives in its own folder, but the other Map drawing components do not: Map painting, Map projection and Map view motion each keep files in both src/viewers/web/iso/ and src/viewers/web/layers/, and Map highlighting is a loose src/viewers/web/map-highlights.ts. A junior who learns from iso/camera/ that a component is its folder misses files of four components. The page keyboard's rules sit in camera.ts, although only the shell's chrome/shortcuts.ts uses them and Escape's deselect is no camera action; keyTarget sorts targets four ways where only "text field or not" changes anything, and shortcuts.ts translates keyAction's result a second time. The camera layer's draw rules, which keep Safari smooth and sharp (TASK-511 to TASK-514), are checked only by manual simulator runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map painting's files live in src/viewers/web/iso/painting/, Map projection's in iso/projection/ and Map view motion's in iso/view-motion/; Map highlighting is iso/highlights.ts beside iso/grid.ts; src/viewers/web/layers/ is gone, and every import and test uses the new paths
- [x] #2 Each Map drawing component in the architecture owns exactly its files at the new paths, and no relationship row points at a moved path
- [x] #3 chrome/shortcuts.ts holds the page keyboard: F1 to F3 toggle chrome everywhere, and +, =, -, _, 0 and Escape act on the map except in text fields; camera.ts has no key rules
- [x] #4 A Bun test checks the camera layer: a pan never draws, a zoom-in draws once when the map settles, a zoom-out navigation draws its destination once before moving, and the move after a repaint draws
- [x] #5 The map behaves as before in Chrome and Mobile Safari: keys, checking a flow, Fit and pans
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
1. Keys (Shell): chrome/shortcuts.ts gets one key table (F1 to F3 chrome toggles; +, =, -, _, 0, Escape map keys) and a text-field check; an exported shortcut(key, typing) lookup is the pure rule, and bindShortcuts feeds it the event. camera.ts drops KeyTarget, keyTarget and keyAction. The key assertions in test-bun/iso-map.test.ts move to test-bun/web-shell.test.ts, unchanged in meaning (Escape deselects, text fields keep map keys, x has no action).
2. Camera layer test: test-bun/web-camera-layer.test.ts gives the layer stateless stubs for document and requestAnimationFrame (bun test --parallel isolates each file's globals) and a painter that records the cameras it draws; each test awaits the layer's settled hook, so no fixed sleeps.
3. Folders: move Map painting to iso/painting/ (map, buildings, ground, routes, layers, style, svg, text, scale, glow; the paint- prefix goes, as camera-layer.ts became camera/layer.ts), Map projection to iso/projection/ (project, blueprint, separation), Map view motion to iso/view-motion/ (presentation, orbit, morph), map-highlights.ts to iso/highlights.ts; remove layers/. A scratch codemod resolves every relative import against the old layout and rewrites it for the new one, so importers and moved files both stay correct.
4. Architecture: fold the scanner's singleton records for the moved files back into their owners with groma edit --parent export and --combine; check owners' code lists and the derived relationship rows.
5. Verify: bun run check in a worktree at the check tree; Chrome key and map checks on an export; Mobile Safari flow and Fit runs; bundle diff against TASK-515.

Tests. Camera layer (new): the rule is the documented camera layer contract in docs/viewers/web/index.md (pans and zoom-ins move the cached picture without redrawing, zoom-outs draw their destination first, the map is drawn crisp once it settles), approved by Alex as B. It would catch a pan or gesture that redraws the SVG on every frame, a zoom-out that shrinks the close-up picture instead of drawing its destination first (the Safari freeze TASK-513 fixed), a zoom-in left at compositor scale (the blur TASK-511 fixed), and a repaint whose next move shows the old picture. Nothing covers createCameraLayer today; one file with four tests and a recording painter closes the gap. Keys (moved): the existing assertions move with the rule; no new assertions.

6. After review: painting/layers.ts became painting/layer-planes.ts, and the camera layer test's comment names bun test --parallel as what keeps its stubs per file. The hand-written render.ts relation was re-added with groma add relation for iso/painting/map.ts; the CLI cannot remove the stable row with the old path, so Alex approved deleting it by hand.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keys: chrome/shortcuts.ts has two tables (toggles F1 to F3; map keys +, =, -, _, 0, Escape), a pure shortcut(key, typing) lookup and a module-private isTextField (radio buttons and checkboxes stay controls, as keyTarget had them); camera.ts lost KeyTarget, keyTarget and keyAction (23 lines). The key test moved to test-bun/web-shell.test.ts with the same assertions; keyTarget's hierarchy and control cases behaved like other and are gone.
Camera layer test: test-bun/web-camera-layer.test.ts, four tests with a recording painter; stateless globals for document and requestAnimationFrame (bun test --parallel implies --isolate, so they cannot leak into other files); every test awaits the settled hook, no fixed sleeps. Checked against four broken copies of the layer in scratch (approach that does not draw, every move drawing, settle that does not draw, a repaint that does not mark the picture stale): each fails exactly its own test.
Folders: a scratch codemod resolved every relative import in the old layout and rewrote it for the new one (38 files, 17 moved), recording each file on the task as it went; one comment in painting/style.ts named iso/map.ts and now says map.ts.
Architecture: the watcher's scan made 17 singleton records (16 under cli, highlights under the system); groma edit <id> --parent export and groma edit <owner> --combine folded them into map, iso-project, presentation and map-highlights in their original order. The scan left Map painting's old src/viewers/web/iso/map.ts entry in place (the other owners dropped theirs), so groma edit map --detach removed it. The derived layer.ts to map.ts row follows the move.
Blocker: the hand-written row render.ts to src/viewers/web/iso/map.ts ("Draws the current map and selection") cannot be removed or re-pointed with the CLI: removeRelation in src/relation.ts removes only draft rows, and endpoints resolve through file owners, so the old path is an unknown target. groma add relation now carries the same relation for iso/painting/map.ts; the old row resolves to no element and is not drawn. Removing it needs a hand edit, which waits for Alex.
Bundles: sorted-line comparison of the exported render.js against TASK-515's shows only the keyboard consolidation; the rest is the same code in a different module order, and index.html differs only in the embedded architecture data.
Chrome (export served locally): + zooms in, - out, 0 fits; + in the revision search field does nothing; Escape clears ?actor=coding-agent; F1 toggles ?hud=off, also while typing; checking Coding agent's flow draws the destination first and settles at identity with data-tracing and patterns hidden; a wheel pan moves the cached picture; no console errors.
bun run check at the final check tree (6b9c0d23): Biome, types and the Node suite pass; Bun 727 pass, 45 skip, 0 fail.

Mobile Safari (iOS 27 simulator), TASK-515 export (b515) against this task's (c517), interleaved; worst frame after the event in ms, sharpness settled/fresh draw: flow b515 0, 0; c517 44, 131 (21.11-21.12 against 21.10-21.11 on both); Fit b515 64, 0; c517 50, 0 (18.21/18.21 on both); first pan after the settled flow zoom 17 in all four runs; zoom-in 20.97/20.97 on both. The bundles hold the same camera code, so the spread is machine load (a review agent and CI log downloads ran meanwhile); no frame reached 200 ms.

End-of-task review (one read-only agent covering the cold simplicity questions and Alex's complexity question): keep the approach, no defects; it confirmed there is no CLI route for the stale render.ts row. Applied its two in-scope cleanups: painting/layers.ts is now painting/layer-planes.ts (layer already names the cached picture in camera/layer.ts; the scan's layer-planes singleton was folded back into map), and the camera layer test's comment says the stubs stay per file only under bun test --parallel, which the repository check uses. Left for Alex: Map fonts is the one Map drawing component outside iso/ (regroup it or move atoms/fonts/), chrome/ and organisms/ still mix components in one folder, and component IDs differ from their folder names.

Alex approved deleting the stale row by hand (2026-09-24). Removed the render.ts to src/viewers/web/iso/map.ts row from groma/relationships.md; the model loads and holds one render to map relation ("Draws the current map and selection", Function call), from the row groma add relation wrote for iso/painting/map.ts. No groma/ file names an old path.

bun run check at the final check tree (a2c7beef, main 631089ed plus this task): Biome, types and the Node suite pass; Bun 727 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every Map drawing component now has one place under src/viewers/web/iso/: Camera control in camera/, Map painting in painting/ (map, buildings, ground, routes, layer-planes, style, svg, text, scale, glow), Map projection in projection/, Map view motion in view-motion/, and the single-file components Map grid and Map highlighting as grid.ts and highlights.ts; layers/ is gone. A codemod rewrote all 38 affected files' imports, and the architecture records were curated with the Groma CLI so each component owns exactly its files; the one hand-written relation to the old iso/map.ts was re-added for the new path, and Alex approved deleting the stale row by hand. The page keyboard moved from camera.ts to the shell's chrome/shortcuts.ts: two small key tables, a pure shortcut(key, typing) lookup and one text-field check replace keyTarget, keyAction and a second translation table. A new test pins the camera layer's draw rules (pans never draw, zoom-ins draw once on settle, zoom-outs draw their destination first, the move after a repaint draws) and fails on each of four broken copies of the layer. Verified by bun run check (Bun 727 pass, 0 fail), bundle comparison (only the keyboard code differs), Chrome key and map checks, and interleaved Mobile Safari runs matching TASK-515 (no frame near 200 ms, settled views as sharp as a fresh draw).
<!-- SECTION:FINAL_SUMMARY:END -->
