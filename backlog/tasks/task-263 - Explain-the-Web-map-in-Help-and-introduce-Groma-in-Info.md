---
id: TASK-263
title: Explain the Web map in Help and introduce Groma in Info
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:42'
updated_date: '2026-09-05 17:46'
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
- [x] #1 Help explains architecture shapes, source-based building sizing, draft appearance and relationships while retaining map controls.
- [x] #2 Info shows the existing Groma logo, a brief product description and repository link above the existing dependency credits.
- [x] #3 Both popups remain readable and scrollable using the existing header popup design.
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
Extend existing Help content and Info markup/styles; verify sizing descriptions against current measurement code; inspect both popups in the browser, run bun run check, and perform the requested full-context review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified Help and About Groma at 1280x720 in the browser: readable map/sizing explanations, scroll to all existing shortcuts, shared outside-click dismissal, logo/description/repository link, and scroll to all runtime and development credits. Sizing wording checked against src/sheet/measure.ts. bun run check passed: 104 Node tests and 301 Bun tests, with 8 existing complexity warnings. Initial sandbox run hit filesystem watcher EMFILE; full run with watcher access passed. Implementer specification and quality reviews passed. Full-context reviewer recommends keeping the direct static content and existing boundaries; no material changes or blocking findings. No content-only automated tests added. Other agent owns a separate authoring documentation hunk; exclude it from this commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded Help with architecture shapes, building measurements, drafts and Markdown curation. Info introduces Groma with its existing logo, description and repository link above dependency credits. Browser scrolling and layout verified; full repository check and requested complexity review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
