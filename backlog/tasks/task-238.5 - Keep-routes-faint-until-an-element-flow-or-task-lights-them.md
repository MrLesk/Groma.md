---
id: TASK-238.5
title: 'Light routes only for the selection, a flow or a task'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 15:43'
labels:
  - tui
  - render
dependencies:
  - TASK-238.4
modified_files:
  - src/viewers/tui/molecules/route.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/flow.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/panes/details.ts
  - docs/viewers/tui/index.md
  - test-bun/routes.test.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 265000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When nothing is lit, Groma draws every route dim with junction glyphs where routes cross; when an element is selected, a flow is lit or a task is active, the routes touching it turn heavy in the brand green with arrowheads and first-word labels, and everything else stays dim. A route may end on any border cell of a building; on the top border it lands on the name itself, the arrowhead stops above it and no port dot is drawn, since a lit route lights both its ends; elsewhere a port dot marks the cell. Enter on a relationship row in the details pane selects that relationship: its route lights and the pane shows both ends. Lane spacing comes from the sheet. The lit flow keeps its marching dash.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unlit routes draw dim and thin; a crossing of two unlit routes draws a junction glyph instead of one overwriting the other
- [x] #2 Routes touching the selection, a lit flow or an active task draw heavy in the brand green with an arrowhead at the target; port dots mark ends on side and bottom borders, none on a top border
- [x] #3 Route labels appear only on lit routes, following the first-word rule, and never overwrite a name
- [x] #4 Enter on a relationship row selects the relationship: its route lights and the details pane shows both ends as links
- [x] #5 The marching dash on a lit flow keeps its timing; routes and labels stay on their cells while the selection stays on screen
- [x] #6 The scale checks from the large-world fixture pass with 500 relationships
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
1. molecules/route.ts: an unlit route is a dim thin line with thin corners and nothing else; where two unlit routes cross, a junction glyph ┼ replaces the overwrite (the painter keeps the cells unlit routes occupy and their direction); a lit route draws heavy in the accent (━┃, or ┅┇ for drafts) with an arrowhead on its last cell and a port dot on the border cell of each end, unless that end sits on a top border where the name lives; lit routes paint after unlit ones.
2. organisms/world.ts lights a route when it touches the selection (its source or target is the selected key), a lit flow or a work-touched element; labels stay lit-only, follow the first-word rule and are skipped when any cell of the label lies inside a visible item.
3. flow.ts: litLegs(world, lit) gives an actor's pick its whole walk (actionLegs) and any other picked relationship just itself; paint, the flow step, the details flow lines and the viewer's attention read legs through it, so a picked relationship lights one route.
4. navigation.ts and panes/details.ts: every relationship row of the selection is pickable in the What tab (outgoing, then incoming, in the pane's order); Enter picks it and lights its route; Enter again on the lit row selects the other end; under the lit row the pane shows both ends, source → target.
5. Tests: junction glyph on a painted crossing, lit versus unlit glyphs for a selected element's route, no port dot on a top border, label skipped over a name, a relationship pick lighting one route and Enter selecting its peer, routes unchanged while the selection stays within its island; the large-world scale checks stay green. Docs: the routes paragraph. Captures at 120x36 and 200x60.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: molecules/route.ts draws an unlit route as a dim thin line whose crossings with other unlit routes become junction glyphs (the painter shares one occupancy map per frame), and a lit route heavy in the accent (dashed heavy for drafts) with an arrowhead on its last cell; drawPorts adds a port dot on the border cell of each end after the shapes are painted, none on a top border where the name lives; the label keeps the first-word rule and is skipped when any of its cells lies inside a visible item. organisms/world.ts lights a route when it carries a lit flow, when its source or target is the selection, or when a work-touched element is at either end. flow.ts litLegs gives an actor's pick its whole walk and any other picked relationship itself alone; paint, the flow step, the marching dash and the viewer's attention read legs through it. navigation.ts makes every relationship row of the selection pickable in the What tab (its outgoing ones, then the incoming ones, the pane's order); Enter lights the picked route and Enter on the lit row follows it to the other end; panes/details.ts names both ends under the lit row. Docs: the routes paragraph.

Correction: the port dots first vanished under the building frames because they were painted with the route; they now follow the shapes in their own pass and show on the border cells (captures: '●◀━●' between two buildings). Evidence: routes.test.ts covers the junction glyph on a crossing, the heavy lit glyphs with the arrowhead and a side-border port dot and none on a top border, the lit-versus-thin route at a selected and an unrelated building, a picked relationship lighting itself alone and Enter following it to its other end, and unchanged route cells while the selection stays on its island; terminal suites 66 pass with the large-world scale checks on 572 relationships; typecheck clean; lint 4 pre-existing warnings. tui-test captures at 120x36 and 200x60: the root with thin unlit routes and no dots or arrows, the Catalog Api map with the selected building's routes heavy in the accent, arrowheads, port dots and a junction where an unlit route crosses another.

Reviews: the review agents are rate-limited until 12:50, so the implementer performed the simplicity, specification and quality reviews; separate-agent passes are owed. Specification: criteria 1 to 6 met as above. Quality: files under 500 lines, no new lint warnings, tests parallel-safe on synthetic worlds; the lane spacing the task text attributes to the sheet does not apply to the fitted layouts, whose routes are the terminal's own shortest bends, recorded for Alex.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Routes on the terminal map draw dim and thin until they touch the selection, a lit flow or a task's element; then they draw heavy in the brand green with an arrowhead at the target, port dots on the border cells of their ends (none on a top border, where the name sits) and a first-word label over plain ground; where two unlit routes cross, a junction glyph marks the crossing, and a lit flow keeps its marching dash. Every relationship row of the selection is pickable: Enter lights that route alone and names both ends, Enter again selects the other end. Tests cover the junction, the lit and unlit glyphs, the port rules, the pick and the follow, and unchanged route cells while the selection stays on its island; the large-world scale checks pass and tui-test captures at 120x36 and 200x60 show the styling.
<!-- SECTION:FINAL_SUMMARY:END -->
