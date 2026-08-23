---
id: TASK-161
title: Optically center the map controls in the web header
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 20:52'
updated_date: '2026-08-23 20:55'
labels: []
dependencies: []
references:
  - render
  - page
modified_files:
  - src/viewers/web/page.ts
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect views the web header, the bordered Fit and zoom group should look vertically centered beside Help and Theme instead of appearing slightly low despite geometric centering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Fit and zoom control group is shifted upward by one pixel without changing header height or the position of Help and Theme
- [x] #2 Fit, zoom out and zoom in continue to work
- [x] #3 Browser QA confirms the corrected header alignment at 1280x720 with no console errors
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
1. Apply a one-pixel upward transform only to the existing #map-controls group.
2. Leave header dimensions and sibling actions unchanged.
3. Verify Fit and zoom interactions, rendered geometry and console health at 1280x720, then run focused checks and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied a one-pixel upward transform to #map-controls only. Browser QA at 1280x720 measured the header, Help and Theme at centre y=36 and map controls at y=35, with the expected -1px transform. Fit and zoom readouts progressed 100% -> 80% -> 100% -> 100%; page content, screenshot and console health passed. Focused web tests and typecheck pass.

Full bun run check passes with 93 Node and 177 viewer tests.

Cold simplicity and full-context architecture reviews passed with no findings. Both confirmed the one transform declaration in the existing #map-controls selector is the smallest and safest placement: it preserves sibling layout, avoids duplicate child adjustments and keeps header-control geometry locally owned.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shifted only the Fit and zoom group upward by one optical pixel while preserving header layout and Help/Theme positions. Verified measured geometry, Fit and zoom interactions, screenshot, console health, 15 focused tests, typecheck, the full 93/177 suites, and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
