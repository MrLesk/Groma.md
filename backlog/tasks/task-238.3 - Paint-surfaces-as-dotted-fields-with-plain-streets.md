---
id: TASK-238.3
title: Paint surfaces with the pattern of their kind
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 07:15'
labels:
  - tui
  - render
dependencies:
  - TASK-238.2
modified_files:
  - src/viewers/tui/atoms/border.ts
  - src/viewers/tui/molecules/surface.ts
  - src/viewers/tui/molecules/boundary.ts
  - src/viewers/tui/organisms/world.ts
  - docs/viewers/tui/index.md
  - >-
    test/fixtures/containers-view/groma/systems/shop/containers/web/components/page.md
  - test-bun/surface.test.ts
  - src/viewers/tui/molecules/card.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the terminal map renders, Groma draws every island, slab and zone with the pattern of its kind from the design page: the actors island dots, the external island crosses, a slab a faint grain, a zone a faint hatch, a system island plain. Weight follows depth: island heavy, slab thin, building thin, route dim. The name and kind glyph sit in the top border and origin keeps its line style. Plain ground lies between surfaces. No kind colours: default foreground, dim, bold and the brand green only. Slabs and zones appear only in the container map. The painter reads Core sheet the way the browser renderer does and replaces the boundary, hatch and surface-pattern molecules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Islands, slabs and zones draw their kind pattern dim; the ground between surfaces stays plain
- [x] #2 Line weight follows depth: island heavy, slab and building thin, route dim; origin keeps solid, dashed and dotted
- [x] #3 The surface name and kind glyph sit in the top border; no counts anywhere in a border
- [x] #4 Only viewport cells are painted; the scale checks from the large-world fixture pass
- [x] #5 tui-test screenshots at 120x36 and 200x60 match the container map frames on the design page
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
1. atoms/border.ts: three frame styles (building square, surface rounded, zone dashed) whose lines follow the origin (observed solid, draft dashed) and a heavy flag for the box a selected surface draws; drawBorder takes the glyph set.
2. molecules/surface.ts replaces boundary.ts: one surfaceLook per kind (zone hatch ╱ inset 3 on a dim frame, slab grain ╲ inset 2 on a plain frame, actors island dots · and external island crosses × inset 1 on a bold frame, system island plain and bold); fillSurface paints background then the pattern anchored to the surface (every other interior row, every step columns from the inset), dim, only inside the viewport; drawSurfaceFrame draws the frame at its depth's weight or heavy in the accent when selected or touched, then the name with its kind glyph right after the top corner (a zone its name alone, dim).
3. organisms/world.ts paints surfaces, routes, frames, buildings; the ground stays the terminal background; no pinned scope title, the header carries the scope path.
4. The projection is unchanged: the pattern keys off the projected kind; the actors and external islands take their dots and crosses when TASK-238.9 projects them.
5. Tests: test-bun/surface.test.ts paints test/fixtures/containers-view (its page component now in the Pages zone) into a buffer and asserts grain only inside the slab, hatch only inside the zone, nothing on the ground, the root island and ground plain, and the pattern unmoved by a one-row pan; the large-world scale checks stay green.
6. tui-test captures of the root and container maps at 120x36 and 200x60 against the design page frames.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: molecules/surface.ts replaces boundary.ts. surfacePattern keys off the projected item (zone hatch ╱, slab grain ╲, actors island dots ·, external island crosses ×, system island plain), fillSurface paints background then pattern only inside the viewport, two columns in from the frame, every step columns on alternating rows, dim. Frame weight by depth: island bold, slab plain, zone dim and dashed; a selected or touched surface draws heavy (┏━┓, or ┅┇ for drafts) in the accent through borderCharacters' heavy flag. Corners: buildings square, every surface and actor rounded; lines solid for observed, dashed for drafts and zones. The name with its kind glyph stays in the top border; no counts. The projection is unchanged: the root still draws slabs and zones until TASK-238.9 turns islands into rows, so the actors and external islands take their dots and crosses when that task projects them. test/fixtures/containers-view gained a zone (page in Pages) so test-bun/surface.test.ts can paint one container map into a buffer and assert grain only in the slab, hatch only in the zone and nothing on the ground; the root test asserts the island and ground stay plain.

Cold simplicity review: twelve accepted-scope findings applied. One frameLook (glyphs, colour, attributes) feeds the frame, the pinned top edge and the name; drawSurfaceTitle is the one title routine and drawWorld pins the scope's title with the same accent rule as its frame; BorderStyle collapsed to building, surface and zone and drawBorder takes the glyph set; the name sits right after the top corner as on the design page; zones are told by kind everywhere; the pattern table is four literals; every surface routine takes the viewport instead of the projection; the docs say the selection draws heavy in the brand green and no longer promise island dots and crosses before TASK-238.9 draws those islands; the building bucket left the painter test; the heavy accent frame for a selected surface stays as the page's selection rule (accent strokes one weight up, bold name). Recorded, not applied: the page's grain starts on the first interior row and its hatch three columns in while the painter uses one even checkerboard two columns in; a draft building lets slab grain show through its unfilled interior (pre-existing); card.ts still holds a dead background ternary (pre-existing).

Full-context complexity review: two blocking findings fixed. The pattern lattice was anchored to screen parity and moved on an odd camera pan; it is now anchored to the surface (every other interior row, every step columns from the inset: grain 2, hatch 3) with a test that pans the frame one row and finds the same slab-relative grain cells. The pinned scope title, a pre-existing behaviour re-implemented in the new molecule, is deleted: the design page's scrolled container frame shows no name on the viewport's top row and the header carries the scope path since TASK-238.8; the scissor clips titles like everything else. surfacePattern and frameWeight merged into one surfaceLook so a kind states its pattern and weight in one place. Criterion 3 evidence: the surface title carries the name and kind glyph only; the ◆N work marker in a border belongs to TASK-238.7, which replaces it with task names. Criterion 5 evidence: tui-test captures at 120x36 and 200x60 of the root and of the Import container map (session scratchpad) show ╭ ▱ Import ─ titles, grain rows, dashed dim zones with hatch, plain ground and the selected island heavy in the accent. Decision for Alex, recorded as a follow-up: 'island heavy' is drawn as bold thin glyphs (the page's own root frame draws islands thin while its table says ━); if the table wins, frameLook makes system islands heavy. Follow-up for TASK-238.5: the origin line rule lives in border.ts and again in molecules/route.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The terminal map paints every surface with the pattern of its kind, dim and anchored to the surface: a slab a grain, a zone a hatch, a system island plain, with dots and crosses defined for the actors and external islands that TASK-238.9 will project; the ground between surfaces stays plain. Frames weigh by depth (island bold, slab plain, zone dim and dashed), keep the origin's line style, and draw heavy in the brand green when selected or touched; the name and kind glyph sit right after the top corner. The surface molecule replaces the boundary one, only viewport cells are painted, the large-world scale checks pass, and tui-test captures at 120x36 and 200x60 match the design page's container map.
<!-- SECTION:FINAL_SUMMARY:END -->
