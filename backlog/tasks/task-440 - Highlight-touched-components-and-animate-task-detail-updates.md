---
id: TASK-440
title: Highlight touched components and animate task detail updates
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 11:02'
updated_date: '2026-09-19 20:33'
labels: []
dependencies: []
references:
  - map-highlights
  - map
  - task-diff-control
  - render
modified_files:
  - src/viewers/web/map-highlights.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/task-diff/control.ts
  - src/viewers/web/task-diff/updates.ts
  - src/viewers/web/task-diff/view.ts
  - test-bun/web-task-highlights.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/render.ts
type: enhancement
ordinal: 513000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer following live work needs to see every component touched by an active task and read individual task changes without the detail panel disappearing and rebuilding during refresh.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Active tasks highlight every mapped touched component, including when a flow is selected, and clearing task selection removes the task highlight.
- [x] #2 Refreshing the same task keeps its visible details, unchanged rows, focus, and scroll position while new data loads.
- [x] #3 Acceptance and Done check changes and other changed task fields animate locally; unchanged content does not animate, and reduced motion updates immediately.
- [x] #4 Task switching and file drill-down remain correct; focused checks and the repository check are recorded.
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
1. Preserve task emphasis alongside flow tracing using existing touched-element mapping. 2. Retain same-task loaded data and reconcile summary sections and rows in place with local motion. 3. Verify selection and loading lifecycle plus browser updates, document behavior, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Same-task refresh retains loaded details and file rows; summary DOM reconciliation uses section and row identities so checks update in place and unchanged buttons retain focus. Checks animate their mark and changed row; structural updates move displaced rows without change highlighting. Highlighting uses the existing file-owner and exact-ID mapping and stays visible with flow tracing. OKF stored Markdown and C4 concepts are unchanged. This behavior depends on task data and architecture ownership, not source language. Focused mapping tests: 10 pass. Browser verification through the real controller and page CSS passed same-task pending reads, row identity, local check and Done animations, unchanged repaint, focus, scroll, insertion/removal, pending file enabling, file drill-down, request races, switching, and reduced motion. Harness: /tmp/task-440/verify.mjs. Screenshot inspected: /tmp/task-440/check-change.png.

Implementer specification and quality review: applyWork selects current tasks; map-highlights unions their existing touched-element IDs and map style keeps them visible with flow tracing. TaskDiffControl.refresh owns loading and clears old data only on a task switch. paintTaskSummary builds task section/row identities; updates.ts updates matching DOM nodes and animates changed content or displaced rows. Request counters prevent late data from another task or older refresh from applying. Checklist counts come from the displayed details so they remain consistent while a newer response loads. Browser re-verification passed after final refinements. All changed source/test files stay below 500 lines, focused lint has no warnings, and diff whitespace check passes. No architecture model or additional source-language behavior was introduced.

Actual map browser verification also passed: both file-owner and referenced component are highlighted, highlights persist alongside a selected flow, camera is unchanged, touched components outside the traced path remain fully visible, and clearing tasks removes the highlight. Harness: /tmp/task-440/map-verify.mjs.

Quality review found one regression caused by retaining the old diff: a task becoming Done without its matching commit could hide the existing commit-unavailable error behind the old working-tree diff. Clear only the invalid diff when its request fails, preserving the summary and the established error display. Verification is limited to that finding and the previously covered update flow.

Final validation passed: bun run check completed with exit 0; lint (existing repository warnings only), TypeScript, Node tests, and the Bun suite all passed. Full log: /tmp/task-440/check.log. The targeted browser recheck confirmed that completing a task without its matching commit retains the task details, shows the existing commit-not-found error, and removes the obsolete diff source. No further blocking findings remain.

Commit isolation: map-highlights.ts is an uncommitted extraction owned by another task. Package the identical unconditional map.mark calculation in the tracked render.ts instead; leave the extracted working-tree behavior untouched. The extra map-highlight test imports that uncommitted extraction, so retain it as a local verification artifact at /tmp/task-440-commit/web-task-highlights.test.ts rather than ship a test with a missing dependency. Existing touchedElements tests and both browser checks remain the verification evidence. No product behavior changes in this packaging step.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Active tasks keep all mapped touched components highlighted alongside flows. Same-task refreshes retain current details and update matching rows in place, with local check/field animations and smooth row movement; unchanged rows preserve focus and scroll. Reduced motion updates immediately. Verified with mapping tests, real-browser lifecycle and map checks, and a passing bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
