---
id: TASK-238.9
title: 'Root map as rows, fitted and centered'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 21:04'
updated_date: '2026-09-03 08:07'
labels:
  - tui
  - render
dependencies:
  - TASK-238.3
modified_files:
  - src/viewers/tui/projection-root.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/navigation-spatial.ts
  - src/viewers/tui/molecules/row.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/molecules/surface.ts
  - test-bun/navigation.test.ts
  - test-bun/root-layout.test.ts
  - test-bun/chrome.test.ts
  - test-bun/tree.test.ts
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/navigation-search.ts
  - src/viewers/tui/terminal-viewer.ts
  - test-bun/large-world.test.ts
  - test-bun/container-layout.test.ts
  - test-bun/projection.test.ts
  - docs/viewers/tui/index.md
  - test-bun/surface.test.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/projection-routes.ts
  - test-bun/camera.test.ts
  - test-bun/projection-routes.test.ts
  - src/viewers/tui/flow.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens the root map, Groma shows the sheet island row, actors, systems and external systems west to east, each island listing one row per child in the sheet placement order: kind glyph and name, then one Unicode block per component (observed ▪, planned and missing ▫, missing dim), then the current task from TASK-238.7. An island is never wider than the map minus the side padding; a longer row wraps its blocks onto the next line with the task at the end of the last line; an island grows down, never past the fold. The selected island is centered, its neighbours peek in the padding on both sides, and Left or Right crosses to a neighbour with a short animated pan. Up and Down walk the rows of an island; the island itself is one stop; Enter on a row opens the container map, which is fitted to the map width and centered the same way with sibling containers peeking; Right past the last building or Left past the first crosses to the neighbouring container and selects its first building; the map scrolls down and up only as far as a selection needs. Groups appear only in the container map. No counts anywhere. A small world fits without wrapping or panning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each island lists one row per child with glyph, name and one block per component in the sheet placement order; no counts
- [x] #2 A row wider than the island wraps its blocks; an island is never wider than the map minus the padding and grows down instead
- [x] #3 The selected island is centered with its neighbours peeking on both sides; Left and Right cross to a neighbour with an animated pan; Up and Down walk rows; the island is one stop; Enter on a row opens the container map
- [x] #4 The container map fits and centers the selected container with sibling containers peeking; Right past the last building or Left past the first crosses to the neighbour; vertical scrolling moves only as far as the selection needs
- [x] #5 The root map shows no collapsed groups; groups appear only in the container map; the viewer documentation states the change
- [x] #6 A test on the large-world fixture proves the selected island or container stays centered after every arrow move and that scrolling never exceeds what the selection needs
- [x] #7 tui-test screenshots at 120x36 and 200x60 match the root map frames on the design page
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
1. projection-root.ts (new): rootLayout(model, mapWidth) lays the sheet's islands west to east in sheet order (actors, systems, externals by island gx): each island lists one row per child in sheet placement order (containers on a system island by slab rect, actors and externals by building rect), a row being the kind glyph and name, then one block per component (observed ▪, draft ▫ dim) wrapped inside the island's bar width; an island is never wider than the map minus 8 columns of padding each side and grows down; islands sit two columns apart. Items get two new shapes, island and row; the root no longer projects slabs, zones or component cards.
2. projection.ts: the root camera centres the selected island (the whole island row when it fits) and reveals the selection vertically; the container map centres the selected container the same way; routes at root and in the container map are the terminal's own straight paths between the shapes they join (routeBetween), since the fitted layouts no longer share the sheet's geometry.
3. navigation-spatial.ts: at root, Up and Down walk an island's rows with the island itself one stop above its first row, Left and Right cross to the neighbouring island (its stop, or its first row for the actors and external islands), the map edges still lead to the panes; Enter on a container row opens the container map. In the container map, Right past the last building or Left past the first crosses to the neighbouring container of the same system and selects its first building.
4. projection-container.ts (new): the container map fits the selected slab to the map width minus the padding and centres it; zones stack as bands, buildings wrap into lines two rows apart; sibling containers peek on both sides as slabs with their name.
5. Painter: molecules/row.ts draws a row (name plain, blocks plain, drafts dim; the selected row in the accent, bold); islands draw through the surface molecule with the actors island dots and the external island crosses; the shared islands are titled Actors and External without a glyph.
6. terminal-viewer.ts: a short animated pan (a few frames) when the centred island or container changes; the frame is the final projection shifted by the remaining offset.
7. Tests: root layout rules (width cap, wrapping, order, one block per component, no counts), row and island navigation, container crossing, and a large-world test that the selected island or container stays centred after every arrow move while the camera moves vertically only as far as the selection needs. Docs: the map scopes and camera sections. Captures at 120x36 and 200x60.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: projection-root.ts lays the sheet's islands west to east (by island gx) listing one row per child in placement order with one block per component (▪ observed, ▫ draft dim), wrapped inside the island's bar; islands never exceed the map minus 8 columns of padding each side and grow down; rows span their island so routes port on its edge. projection-container.ts fits the selected slab to the same width, stacks its zones as bands with buildings wrapped into lines two rows apart and lets the neighbouring containers of the same system peek on both sides. One fittedCamera centres the island or slab holding the selection (the whole row when it fits) and scrolls vertically only as far as the selection needs, never above the top. Routes at both levels are routeBetween paths, the sheet's geometry no longer applying to the fitted layouts; the sheet still decides what exists, its order and its groups. Root arrows: Up and Down walk rows with the system one stop above its first row, Left and Right cross islands; container arrows follow same-lane lines and cross to the neighbouring container's first building past the first or last one; the map step state is gone and the map width lives in the viewer state for the fitted layouts. The viewer slides the map over four frames when a selection change at the same level moves the camera. Tests: root-layout (rows, blocks, no counts, width cap and wrapping), container-layout (fit, centre, neighbour peeking, crossing), navigation (rows, islands, lines), a large-world walk asserting the holder stays centred after every arrow and the camera scrolls only when needed; projection and surface tests adjusted to the fitted rules; docs rewritten for map scopes and camera.

Correction: entering a container now selects its first building in map order (placement), not the alphabetical first child, so the opened map starts unscrolled on the building the eye lands on; the crossing already used the same rule. Evidence: terminal suites 63 pass; typecheck clean for this task's files; lint 8 warnings, all pre-existing (the projection's own complexity warning is gone). tui-test captures through a direct viewer runner (the CLI entry cannot start while another session's uncommitted src/cli.ts imports a deleted relate.ts): 120x36 and 200x60 root frames with the actors, Orders, Catalog (selected, heavy accent, centred) and External systems islands listing rows with blocks and no counts; a Right pan centring the neighbour; the Catalog Api container map fitted to the width with zones as bands, buildings wrapped into lines and the neighbouring containers peeking; three Rights crossing to Import at its first building.

Cold simplicity review applied: the old sheet-scaled camera (centeredCamera, clampCamera, reveal) and its tests deleted; the route clipper is private behind routeBetween, its dead branch gone; one WorldItem type; byPlacement and encloses shared; one levelItems lookup for anchors and projection; fittedCamera takes its subject; the pan origin travels with the repaint call; MAP_PADDING, fittedWidth and ROW_INSET name the shared numbers; the slab shape is called slab; docs no longer claim pane changes never re-fit the map or that the touched set is framed.

Full-context complexity review: four blocking findings fixed. Root routes left one line below their row (the port inset and a rounded-up centre): a one-line row keeps its line and centres floor. Routes between rows of one island painted stray glyphs: the root skips them, they belong to the container map. Work focus at root with a component selection centred an unrelated island: the selection now stands on its visible ancestor before any fallback. Right crossed containers at the end of every line: Left and Right walk the buildings in reading order and cross only past the first or last; Up and Down keep the nearest, same-lane first. Also: the top rule wins in scrolledTo so a tall island shows its title; the tiny-map guard left the layout and the two tests project at real widths; the dead stops filter and a doubled doc comment are gone; the projection names its scope so flows find the slab by id; the pan keeps one timer; the painter names its surfaces; the docs say an endpoint in a peeking neighbour attaches there. Follow-ups recorded, not applied: a container name wider than the island overflows it; rootStops and the neighbour and first-building lookups could live beside the arrows; initialState could take the map width; CLAUDE.md's TUI map section still describes the old spatial rules (Alex's call); route styling and lanes belong to TASK-238.5.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The root map is one row of islands west to east, each listing one row per child in the sheet's placement order with its kind glyph, name and one block per component, wrapped inside the island and capped at the map minus its padding; no counts, no groups. The selected island is centred with its neighbours peeking, Left and Right cross islands with a four-frame pan, Up and Down walk rows with the island one stop above them, and Enter opens the container map fitted to the map width with its zones as bands, buildings wrapped into lines and sibling containers peeking; Left and Right read through the buildings and cross past the first or last one; the map scrolls vertically only as far as the selection needs. Routes at both levels are the terminal's own shortest bends. A large-world walk proves the centring and the scroll rule after every arrow; tui-test captures at 120x36 and 200x60 match the design page's root frames.
<!-- SECTION:FINAL_SUMMARY:END -->
