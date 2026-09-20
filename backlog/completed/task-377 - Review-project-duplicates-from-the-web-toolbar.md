---
id: TASK-377
title: Review project duplicates from the web toolbar
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 17:01'
updated_date: '2026-09-13 17:06'
labels: []
dependencies: []
references:
  - render
  - page
modified_files:
  - src/viewers/web/duplicates/model.ts
  - src/viewers/web/duplicates/view.ts
  - src/viewers/web/duplicates/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/web-duplicates.test.ts
  - docs/architecture-findings.md
ordinal: 423000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Potential duplicated logic is hidden inside component details. A compact warning icon should open a project-wide review panel that fits the existing map interface and lets developers compare source and navigate to owners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An icon-only warning control with a Potential duplicates tooltip opens and closes a project-wide panel while preserving the map and hierarchy.
- [x] #2 The panel uses existing core findings, supports component and match filters, and lists every occurrence in each selected group.
- [x] #3 Developers can compare occurrence source ranges with highlighted differences and open source or navigate to the owning component.
- [x] #4 Live world and revision changes replace the displayed findings and cannot leave stale source comparisons visible.
- [x] #5 The interface uses existing themes and panel controls, and repository checks pass.
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
1. Add a compact warning toolbar control and a map-preserving review panel using current world findings. 2. Filter whole groups by owner and match; compare selectable source occurrences through the existing source reader, with source and map navigation. 3. Refresh findings and invalidate pending source reads on world/revision changes. 4. Test filtering, source ranges, and stale-read lifecycle; inspect the browser and run bun run check. Update findings documentation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused duplicate tests pass (4 tests). Browser fixture verification confirms warning toggle, comparison source ranges and differences, source navigation to the selected owner, and Show on map. Full workspace check is currently blocked by concurrent TASK-378 routing changes: first an island-layout assertion, then RouteRequest type errors in src/sheet/place.ts. These files do not overlap this task.

Specification and quality self-review: toolbar opens a project overlay without changing architecture selection; filtering retains complete groups; occurrence selectors feed existing source reads; navigation selects the owning representation and exact source line; every world repaint refreshes findings and invalidates the comparison reader. No detector, OKF storage, C4 relationships, or CLI changes. Browser verified open/close/Escape, cross-owner filtering, source navigation, map navigation, and light/dark styling using the existing flows fixture with illustrative source payloads. Fixed count wrapping, singular group label, and expanded-control label. Full bun run check passed in /tmp/groma-task-377-verify, a HEAD snapshot plus exactly this task files and existing dependency links: 16 Node tests passed; 295 Bun tests passed, 6 skipped; lint/type checks passed. This isolates the result from concurrent routing edits. All changed source/test files are at or below 500 lines; git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an icon-only Potential duplicates toolbar entry and project review panel. Developers filter groups, compare any two occurrences with textual differences, and navigate to source or component owners. Uses existing core findings and source APIs; world changes invalidate stale comparisons. Verified in the browser and with the full repository check in an isolated snapshot containing only this task change (16 Node + 295 Bun tests passed, 6 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
