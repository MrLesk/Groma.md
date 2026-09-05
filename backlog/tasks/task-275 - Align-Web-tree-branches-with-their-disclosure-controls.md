---
id: TASK-275
title: Align Web tree branches with their disclosure controls
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:44'
updated_date: '2026-09-05 19:48'
labels: []
dependencies: []
references:
  - web-shell
  - page
modified_files:
  - src/viewers/web/organisms/sidebar-section.ts
  - src/viewers/web/page.ts
type: enhancement
ordinal: 314000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align the vertical branch lines under flow headings and parent rows with their disclosure chevrons in both the sidebar and details panel. Reuse the same spacing so the tree reads consistently below section separators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root flow branch aligns with the heading chevron in both panels, and nested branches align with the parent disclosure column.
- [x] #2 The shared tree keeps its existing labels, counts, selection, folding and chevron animation.
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
Give section headings the same disclosure column and horizontal padding as tree rows, and draw branch lines through that column center. Measure both panels and nested rows in the browser, check light/dark appearance and folding, then run the repository check and final review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Headings now use the same 12px disclosure column as rows; shared branch CSS draws through its center while preserving the 16px depth step. Browser measurements: sidebar heading axis 33px equals root branch 27px + 6px; details heading 903.40625px equals branch 897.40625px + 6px; actor axes 49px and 919.40625px match their child branches 43px + 6px and 913.40625px + 6px. Structure uses the same alignment: Groma chevron 33px matches the CLI branch 27px + 6px. Light/dark screenshots and actual folding, rotation, retained counts and TypeScript scan selection passed. Own specification and quality reviews and the final full-context complexity review passed with no findings. The complete bun run check passed 105 Node tests and 306 Bun tests, with seven existing lint warnings. The initial scan-watch timing failure passed on retry without changes; log /private/tmp/groma275-check-retry.log. No documentation change or decorative content test was needed for this spacing-only refinement.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned section chevrons and vertical branch lines through one shared disclosure column in both flow panels and nested structure rows. Verified browser measurements, light/dark appearance, folding and selection. Full repository check passed all 411 tests; final review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
