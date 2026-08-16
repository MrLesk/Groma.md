---
id: TASK-51
title: Inset Groma and connect people to the viewers
status: Done
assignee: []
created_date: '2026-08-16 18:23'
updated_date: '2026-08-16 18:25'
labels: []
dependencies: []
references:
  - src/world-layout.ts
  - src/viewers/tui/projection.ts
  - groma/observed/people/human-architect.md
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone opens the Groma containers map, children sit inside the system border with visible inset. The human architect and coding agent use Cli, Terminal viewer, and Web viewer — not only the Groma system box. The camera frames that system with a little room from the map pane edges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Children of a system or container sit inset from that parent border on every side.
- [x] #2 Human architect and coding agent use Cli, Terminal viewer, and Web viewer. They do not have a duplicate Groma row.
- [x] #3 Containers view shows those people and the routes into the viewers. The camera frames the system with space from the map pane edges.
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
1. Increase nested ELK padding so children are not flush to parent borders.
2. Author person → Cli / Terminal viewer / Web viewer; drop person → Groma.
3. Show people at containers level and include them in the fit when they use the focused system.
4. Increase camera fit padding so the system is not flush to the map pane.
5. Update TUI docs and tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nested ELK padding is now 20–32 so children sit off the parent border. Camera fit padding is 16 so the system is not flush to the map pane. People use Cli, Terminal viewer, and Web viewer; the Groma row is gone. Containers view shows those people and frames them with the system.

Verified: child inset left/right/bottom 20 against Groma; bun src layout dump; node world-layout 3/3; bun test test-bun 36/36; tsc --noEmit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Groma children sit inset from the system border. People use Cli, Terminal viewer, and Web viewer, and Containers view shows those routes. Verified with a layout dump, 53 node tests, and 36 bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
