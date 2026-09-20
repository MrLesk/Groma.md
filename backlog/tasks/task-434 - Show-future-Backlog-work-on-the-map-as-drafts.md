---
id: TASK-434
title: Show future Backlog work on the map as drafts
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 07:50'
updated_date: '2026-09-19 08:06'
labels: []
dependencies: []
references:
  - src-work-pins
  - work-model
  - web-work-pins
  - tui-paint
modified_files:
  - src/work/status-filter.ts
  - test-bun/work-status-filter.test.ts
  - src/viewers/tui/work/model.ts
  - src/work/pins.ts
  - src/viewers/web/map-session.ts
  - src/viewers/web/export.ts
  - src/viewers/web/work/pins.ts
  - test-bun/work-pins.test.ts
  - test-bun/work.test.ts
  - test-bun/work-folding.test.ts
  - src/viewers/tui/molecules/work-marker.ts
  - docs/viewers/tui/index.md
  - docs/viewers/tui/interaction-spec.md
  - docs/viewers/web/index.md
  - docs/product-model.md
type: feature
ordinal: 507000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Future work is currently represented only by hidden To Do task pins, so a person cannot see planned work while reading the architecture map. Project the configured default Backlog status onto both map viewers by default and give those markers the map's draft treatment, while keeping Groma architecture records and OKF/C4 lifecycle state unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mapped tasks in the configured default Backlog status are visible on the map without opening or changing a status filter.
- [x] #2 Future-work markers are visibly distinct as drafts in the Web and terminal map views.
- [x] #3 Tasks in intermediate and terminal statuses keep their existing visibility, highlighting, selection, and completion behavior.
- [x] #4 A task with no mapped architecture element remains absent from the map, and the architecture model is not rewritten from Backlog data.
- [x] #5 Tests and viewer documentation cover the new default-status map behavior.
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
1. Treat the configured Backlog default status as future work in the shared work projection: include it in initial map visibility for Web and terminal viewers, while keeping terminal task-list expansion folded.
2. Mark default-status Web pins as draft work and render their badge and label with dashed draft treatment; render default-status terminal corners with the terminal draft marker and quiet styling. Keep Groma element origin and architecture Markdown unchanged.
3. Update focused work-model tests and Web/TUI viewer documentation to cover visibility, draft distinction, and unchanged task mapping rules.
4. Run focused work tests, then bun run check, and review the final flow against TASK-434 acceptance criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared default-status projection. Web and terminal viewers now show mapped default-status work by default; the terminal task list keeps To Do folded. Web pins carry draft metadata and use dashed badge, stem, and task-label styling; terminal corners use the quiet diamond draft marker. Unmapped tasks still have no pin, and no Groma architecture data is written from Backlog work.

Validation: focused work suite passed 27/27 tests; bun run typecheck passed; git diff --check passed. bun run check reached lint and typecheck, then the full suite reported 579 passed, 35 skipped, and 18 environment-sensitive failures involving port-0 servers, FSEvents, and ps permission; none involved the changed work tests. tui-test was available but its daemon failed to become ready, so the scripted terminal screenshot check could not run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mapped default-status Backlog work is visible in both viewers by default, with Web dashed draft pins/labels and quiet terminal draft markers; intermediate and terminal behavior stays unchanged, unmapped tasks remain absent, and architecture data stays untouched. Verified with 27 focused work tests, passing typecheck and diff check; the full check's remaining failures are environment-sensitive watcher/server permission failures.
<!-- SECTION:FINAL_SUMMARY:END -->
