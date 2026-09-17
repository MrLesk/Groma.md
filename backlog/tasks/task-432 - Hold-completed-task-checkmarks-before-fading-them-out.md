---
id: TASK-432
title: Hold completed task checkmarks before fading them out
status: Done
assignee:
  - '@codex'
created_date: '2026-09-17 06:14'
updated_date: '2026-09-17 06:18'
labels: []
dependencies: []
references:
  - web-work-pins
  - island
modified_files:
  - src/viewers/web/work/badge.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/work/island.ts
  - src/viewers/web/work/summary.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 505000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web map hides completed task pins as soon as the flip ends, leaving too little time to see the checkmark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Visible completed task pins and chips finish their flip, hold the checkmark for 2.5 seconds, then fade out before following the Done status filter.
- [x] #2 The folded task summary holds its completion checkmark for 2.5 seconds and fades it out before restoring the task count.
- [x] #3 Existing status filters and task selection continue to work, and bun run check passes.
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
1. Share flip, hold, and fade timing across web work badges. 2. Extend pin and chip visibility through the hold and fade, preserving Done filters. 3. Update the folded summary animation and run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification caught the persistent arrival animation overriding the completion fade on pins added after initial load. Remove the arrival class when completion begins. Completion timestamps preserve chip animation progress across content rebuilds.

Verified in headless Chromium using the actual pin, island, and summary modules: checkmarks fully visible after the 500 ms flip and at 2.65 seconds, partial opacity at 3.15 seconds, pins/chips hidden and summary count restored after 3.3 seconds. Repaint during the hold preserves timing; Done filter restores visible completed pins and chips. Repeated the same check with a post-load arrival pin after fixing its animation conflict. bun run check passed (Node 16 pass; Bun 369 pass, 17 skip, 0 fail), including work selection and status-filter behavior. Initial sandboxed checks could not run local servers or filesystem watchers; the full run passed with required system access. Specification and quality self-reviews found no remaining scope or supported-flow defects. Updated only the completion paragraphs in the web documentation, preserving the existing unrelated relationship-list edits.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed web task badges flip for 500 ms, hold the checkmark for 2.5 seconds, and fade out over 300 ms when Done is filtered out. The folded summary uses the same timing before restoring its count. Browser timing/repaint/filter checks and bun run check pass.
<!-- SECTION:FINAL_SUMMARY:END -->
