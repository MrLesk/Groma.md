---
id: TASK-455
title: Remove the nested card from regular web loading
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 13:11'
updated_date: '2026-09-20 13:14'
labels: []
dependencies: []
references:
  - web-server
modified_files:
  - src/viewers/web/startup/page.ts
type: enhancement
ordinal: 527000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The regular loading status has a second border inside the main card. Alex approved removing this extra frame and aligning the loading row with the header.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Regular loading shows the spinner and status directly below the divider, aligned with the header content, with no inner card or extra inner padding at desktop and narrow widths.
- [x] #2 The outer card, divider, status updates, and other startup screens retain their existing behavior.
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
Remove the border, radius, and padding from the existing status row, including its narrow-width padding override. Inspect desktop and narrow layouts in the browser and run bun run check. This CSS-only change needs no new tests or public contract changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the inner status border, radius, and desktop/narrow padding in the existing startup page stylesheet. Browser checks at 1280x720 and 375x667 show the row and header share the same left edge, row border and padding are zero, the outer card and divider remain 1px, and there is no horizontal overflow. bun run check passed: 16 Node tests and 617 Bun tests, with 36 configured skips. Specification and quality reviews found only the two intended CSS changes; no public behavior or documentation contract changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the extra card around regular loading and aligned its spinner/status with the header. Verified desktop and narrow browser layouts and passed bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
