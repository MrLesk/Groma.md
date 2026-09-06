---
id: TASK-34.9
title: Keep arrow moves inside the boundary and exit one level up
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 12:35'
updated_date: '2026-08-16 12:41'
labels: []
dependencies: []
parent_task_id: TASK-34
priority: high
type: bug
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Map arrows currently pick the nearest same-level element anywhere in the world, so exiting a container jumps to a component inside a neighboring container. Instead, same-level arrow moves are bounded by the shared parent: arrows move between siblings inside the same boundary, and when none lies in that direction the selection exits one level up, selecting the nearest outer item in the exit direction, with the existing zoom-out follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Arrows only select same-level elements that share the selection's parent
- [x] #2 With no sibling in that direction, selection exits to the nearest outer-level item in the exit direction, and the camera zooms out as before
- [x] #3 Context-level movement between people, systems, and external systems is unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. navigation.ts moveView: filter same-level candidates by element.parent === selected.parent.
2. Update the unit expectation where exiting a container previously landed on a far component; docs and AGENTS.md wording; live agent-tty check from a component at a container edge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope note: bounding arrows to siblings made the just-entered system a dead end (it has no siblings at Containers), so Enter on a system now selects its first container, mirroring how Enter on a container selects its first component; flagged by the cold review and folded in as required for the flow to stay navigable. First child is chosen by id order, which may not be the spatially leftmost box. Verified live: Enter on Groma selects Architecture workspace, arrows walk sibling containers, and exiting the system edge selects Git at context. Committed selectively; parallel web-viewer changes in the same tree were left uncommitted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Map arrows now move only between siblings inside the same boundary; with no sibling in that direction the selection exits one level up to the nearest outer item in the exit direction, with the existing zoom-out. Enter on a system selects its first container so the entered level is immediately walkable. Verified by reducer tests (21 pass) and live agent-tty checks.
<!-- SECTION:FINAL_SUMMARY:END -->
