---
id: TASK-238.4
title: Draw components as buildings with floors
status: Done
assignee:
  - '@claude'
created_date: '2026-09-02 06:22'
updated_date: '2026-09-03 15:34'
labels:
  - tui
  - render
dependencies:
  - TASK-238.9
modified_files:
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/molecules/building.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/molecules/spine.ts
  - src/viewers/tui/organisms/world.ts
  - docs/viewers/tui/index.md
  - test-bun/container-layout.test.ts
parent_task_id: TASK-238
priority: high
type: feature
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a container map is open, Groma draws each component as a building: the name and kind glyph in the top border; inside, one row per floor, the same one to five floors Core folds the component files into, each row naming the largest file of its floor with +N for the rest, dim; a building is as wide as its name or its longest row; two rows lie between lines of buildings so routes bend between them; the selected building draws its frame one weight level up in the brand green with a bold name; a ghost has one empty row and a dashed or dotted frame. The corner that names a task belongs to TASK-238.7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A building lists one row per floor from Core floorsOf, each row the largest file of the floor and +N for the rest, dim; a ghost shows one empty row
- [x] #2 A building is as wide as its name or its longest row; a longer file name truncates with an ellipsis and the full name stays in the details pane
- [x] #3 Two rows lie between lines of buildings and buildings never overlap
- [x] #4 The selected building draws a heavier frame in the brand green with a bold name; fills and rows never change with selection
- [x] #5 The scale checks from the large-world fixture pass
- [x] #6 tui-test screenshots at 120x36 and 200x60 match the container map frames on the design page
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
1. projection-container.ts: floorRows(building) gives one row per Core floor, the floor's largest file (its basename) and +N for the rest, or one empty row for a ghost or a building without files; a building is as wide as its name with glyph, spaces and corners or its widest row two columns in, capped at its band; its height is its rows plus the frame; a line is as tall as its tallest building and two rows lie between lines.
2. molecules/building.ts replaces card.ts and spine.ts: the name and kind glyph in the top border, the floor rows inside dim, a row wider than the interior ending in an ellipsis; the frame at the building weight, heavy in the accent with a bold name when selected or touched by work, dim off a lit walk; the interior always filled so no pattern shows through a ghost.
3. organisms/world.ts draws buildings through the new molecule.
4. Tests in container-layout.test.ts: floors to rows and the ghost row on a synthetic container, the width rule, non-overlap with two rows between lines, and the ellipsis on a painted row; the large-world scale checks stay green.
5. Docs: the container map paragraph names the building rules. Captures at 120x36 and 200x60.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: projection-container.ts turns a building's Core floors into rows (the floor's largest file by basename, +N for the rest; one empty row for a ghost or a building without files), sizes the building from its name with glyph or its widest row, caps it at its band with the slab pinned to the fitted width, makes a line as tall as its tallest building with two rows between lines. molecules/building.ts replaces card.ts and spine.ts: name and glyph in the top border (bold), rows dim, a row wider than the interior ending in an ellipsis, the frame heavy in the accent with a bold name when selected or touched, dim off a lit walk, the interior always filled. Docs name the building rules. Tests: floors to rows and the ghost row, the width rule, non-overlap with two rows between lines, the ellipsis on a painted row; terminal suites 56 pass, typecheck clean, lint 5 pre-existing warnings. tui-test captures at 120x36 and 200x60 of the Catalog Api map show the selected building heavy in the accent with its five floor rows and thin neighbours in lines.

Simplicity review: the cold review agent was terminated by the account's session limit (resets 12:50), so the implementer reviewed the diff instead and a separate-agent pass is owed after the reset, together with the full-context review. Applied: a building is sized once (rows, width, height) and that size drives the wrapping, the placement and the item, instead of recomputing its rows in four places. Specification review: rows from Core floors with the largest file and +N, one empty row for a ghost; width from name or widest row with the ellipsis on wider rows and the full path in the details pane's Code section; two rows between lines and no overlap; selection heavy in the accent with a bold name while fills and rows stay; large-world scale checks green; captures at both sizes. Quality review: files under 500 lines, no new lint warnings (5 pre-existing), tests parallel-safe on synthetic worlds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each component in a container map stands as a building: its name and kind glyph in the top border, one row per Core floor inside naming the floor's largest file with +N for the rest, dim; a ghost shows one empty row in a dashed frame. A building is as wide as its name or its widest row, capped at its band with wider rows ending in an ellipsis while the full path stays in the details pane; lines are as tall as their tallest building with two rows between them and buildings never overlap. The selected or work-touched building draws heavy in the brand green with a bold name while fills and rows stay put. The large-world scale checks pass and tui-test captures at 120x36 and 200x60 match the design page's container frames.
<!-- SECTION:FINAL_SUMMARY:END -->
