---
id: TASK-238.3
title: Paint surfaces with the pattern of their kind
status: To Do
assignee: []
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 06:18'
labels:
  - tui
  - render
dependencies:
  - TASK-238.2
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
- [ ] #1 Islands, slabs and zones draw their kind pattern dim; the ground between surfaces stays plain
- [ ] #2 Line weight follows depth: island heavy, slab and building thin, route dim; origin keeps solid, dashed and dotted
- [ ] #3 The surface name and kind glyph sit in the top border; no counts anywhere in a border
- [ ] #4 Only viewport cells are painted; the scale checks from the large-world fixture pass
- [ ] #5 tui-test screenshots at 120x36 and 200x60 match the container map frames on the design page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. atoms/border.ts: one weight ladder for frames: thin (┌─│), round (╭─│) and heavy (┏━┃) glyph sets, origin keeping solid for observed and dashed for drafts; the selected surface or building draws one level up in the accent.
2. molecules/boundary.ts becomes the surface molecule: fillSurface paints the interior with the pattern of the item's kind, dim, only inside the viewport: system island plain, actors island dots ·, external island crosses ×, slab grain ╲, zone hatch ╱ (every other cell on a diagonal step, as the design page draws them); the frame weight follows depth (island bold, slab plain, zone dim dashed) and the name with its kind glyph sits in the top border; no count anywhere.
3. organisms/world.ts paints surfaces, then routes, then frames, then buildings, as now; the ground between surfaces stays the terminal background.
4. The projection needs no change: the pattern keys off the projected kind (system, container, group); the actors and external islands take their dots and crosses when TASK-238.9 projects them as islands.
5. Tests: surfacePattern per kind and a container-map frame from test/fixtures/containers-view showing grain inside the slab, hatch inside a zone and no pattern glyph on the ground; the large-world scale checks stay green.
6. tui-test captures of the container map at 120x36 and 200x60 against the design page frames.
<!-- SECTION:PLAN:END -->
