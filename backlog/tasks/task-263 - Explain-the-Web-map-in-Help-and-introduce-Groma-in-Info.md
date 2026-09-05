---
id: TASK-263
title: Explain the Web map in Help and introduce Groma in Info
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:42'
updated_date: '2026-09-05 17:58'
labels: []
dependencies: []
references:
  - page
  - web-shell
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/credits.ts
  - docs/viewers/web/index.md
ordinal: 302000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An architect opening Help can understand the map and building measurements alongside the existing controls. The Info popup introduces Groma with its logo, brief description and repository link while retaining dependency credits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help concisely explains map shapes, source-based building sizing, drafts and relationships alongside all existing shortcuts.
- [x] #2 Info shows the existing Groma logo, brief description and repository link above dependency credits.
- [x] #3 All Help content fits without scrolling at the 1280x720 review viewport, using a modestly wider popup.
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
Cut Help prose to a compact reference and place it beside the existing shortcuts in a wider popup. Verify the entire popup fits at 1280x720 without scroll, run the repository check and targeted full-context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified Help and About Groma at 1280x720 in the browser: readable map/sizing explanations, scroll to all existing shortcuts, shared outside-click dismissal, logo/description/repository link, and scroll to all runtime and development credits. Sizing wording checked against src/sheet/measure.ts. bun run check passed: 104 Node tests and 301 Bun tests, with 8 existing complexity warnings. Initial sandbox run hit filesystem watcher EMFILE; full run with watcher access passed. Implementer specification and quality reviews passed. Full-context reviewer recommends keeping the direct static content and existing boundaries; no material changes or blocking findings. No content-only automated tests added. Other agent owns a separate authoring documentation hunk; exclude it from this commit.

Alex rejected the long scrolling Help. Reopened to reduce copy and fit explanations and controls together without scrolling.

Correction verified in browser at 1280x720: 640px two-column Help fits entirely from y74 to y635, with all guide sections and shortcuts visible and no scrolling. Reduced prose roughly by half; Info unchanged. Targeted full-context review passed without recommendations. Shared check hit the concurrent relationship-removal change; full bun run check passed on a temporary verification copy of HEAD plus only the Help correction (104 Node, 301 Bun tests). Implementation remained in shared main; other agents files and hunks excluded.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Help is a compact two-column reference: map meanings and building measurements beside the existing shortcuts, all visible without scrolling at 1280x720. Info retains the Groma introduction and credits. Browser verification, isolated full repository check, and targeted complexity review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
