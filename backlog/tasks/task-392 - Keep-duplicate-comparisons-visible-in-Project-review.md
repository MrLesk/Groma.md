---
id: TASK-392
title: Keep duplicate comparisons visible in Project review
status: Done
assignee:
  - '@codex'
created_date: '2026-09-14 07:40'
updated_date: '2026-09-14 14:54'
labels: []
dependencies: []
references:
  - review-control
  - button
  - settings-control
modified_files:
  - src/viewers/web/duplicates/control.ts
  - src/viewers/web/review/control.ts
  - src/viewers/web/duplicates/view.ts
  - src/viewers/web/atoms/settings-dialog.ts
  - src/viewers/web/settings/control.ts
  - docs/architecture-findings.md
type: bug
ordinal: 438000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In Groma web, a developer opens Project review and selects a duplicate group. The comparison is rendered after the full list, so with 80 groups a click appears to do nothing. The dialog also uses extra vertical space for filters and an unwanted enlarge control.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project review has no enlarge button.
- [x] #2 Component and match filters sit to the right of the duplicate heading when space permits and remain usable in a narrow dialog.
- [x] #3 Clicking a result expands its comparison directly below the row and keeps it in view; clicking again collapses it, and opening another result closes the previous one.
- [x] #4 Occurrence selection, filtering, source navigation, and stale-read cancellation still work.
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
1. Use one accordion list: row selection expands the comparison immediately below that row, collapses the previous selection, and keeps the selected row in view. Update only the comparison when occurrence selectors change. 2. Place filters beside the duplicate heading and remove the unused shared dialog expansion feature. 3. Verify the long list, collapse and selection, filters, navigation, and narrow layout in the browser. Run duplicate model tests and bun run check. Document the final layout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user selected an accordion layout during implementation. Replace the separate comparison scroll area with inline row expansion; retain compact controls and removal of expansion chrome.

Browser verification found that the last row could remain at the bottom while source loaded. Reposition the opened row after its source response is rendered, using the existing stale-read guard so an old response cannot move the current selection.

Specification and quality self-review passed. The existing review control owns one selected group and one comparison section; row buttons place that section inline, while the existing reader cancels stale responses. No scanner, architecture model, or storage change. Browser verification used the real 80-group payload: expand/collapse, switching groups with only one expanded, last-row visibility after loading, occurrence selection, component and match filters including an empty result, Open source at src/scanner/registry.ts line 97, and Show on map. Checked default width and 600px width; filters wrap and comparison columns stack. No enlarge control remains. Existing duplicate model tests pass (4 tests). Final bun run check passes lint, types, 16 Node tests, and 312 Bun tests with 6 existing optional native-tool skips. git diff --check passes. No decorative UI tests added.

Pre-commit quality check: extracted group list construction from paint to meet the function complexity limit without changing accordion behavior.

Final pre-commit check passes with no complexity warnings: lint, types, 16 Node tests and 314 Bun tests; 6 existing optional native tests skipped. Tests ran outside the sandbox because local listeners, FSEvents and process inspection require it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Project review uses one open accordion row for inline source comparison. Filters sit beside the heading, and the enlarge control is removed. Verified the real 80-group browser flow, narrow layout, source and map navigation, and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
