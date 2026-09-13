---
id: TASK-384
title: Separate plugin settings from project findings in Groma web
status: Done
assignee: []
created_date: '2026-09-13 19:15'
updated_date: '2026-09-13 19:23'
labels: []
dependencies: []
references:
  - review-control
  - review-model
  - scanners-settings
  - page
  - render
modified_files:
  - src/viewers/web/atoms/settings-dialog.ts
  - src/viewers/web/review/control.ts
  - src/viewers/web/review/model.ts
  - src/viewers/web/settings/model.ts
  - src/viewers/web/settings/control.ts
  - src/viewers/web/scanners/settings.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - test-bun/project-review.test.ts
  - docs/scanners/setup.md
  - docs/viewers/web/index.md
  - docs/architecture-findings.md
ordinal: 430000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Groma web user must be able to configure plugins when the project is healthy, without opening a warning. Provide a permanent Settings entry containing Plugins. Keep Project review for potential duplicate findings. Scanner warnings appear only when action is needed and open the affected plugin in Settings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live web always offers Settings with the existing grouped plugin install, add, update, remove and retry operations.
- [x] #2 Project review contains duplicate findings only, with a neutral indicator for findings.
- [x] #3 Only scanner warning or error states show a warning entry; it opens Settings at the affected plugin. Healthy and partial coverage hint states do not show a warning.
- [x] #4 Keyboard dismissal restores focus, live scanner updates remain visible, and static exports offer no plugin management.
- [x] #5 Verify the healthy local web project and a fixture with scanner problems; bun run check passes.
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
Separate dialog ownership, reuse existing plugin and duplicate controls, replace combined tab state with scanner warning targeting, then validate browser flows and repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented independent Settings and Project review controllers. Both reuse the same small dialog chrome for expansion, Escape and focus return; existing scanner operations and duplicate comparison retain ownership. Removed combined tab selection and issue-count model. Scanner warning targeting prioritizes blocked, then missing, then matched recommended scanners. No persistence or architecture semantics changed. Self specification and quality reviews found no blocking defects or additional behavior required. UI verification in a disposable fixture covered direct warning-to-plugin details, Retry resolving the warning, focus returning to permanent Settings, installing missing and recommended plugins, update, removal, adding a custom local source, and search. Live updates remained in Settings. Static export showed duplicate source comparison with no Settings or scanner warning. Real localhost:4747 was restarted and confirmed all eight installed plugins healthy without Needs attention; screenshot /tmp/groma-settings-plugins.png. Full bun run check passed: lint, types, 16 Node tests, 305 Bun tests, 6 optional native tests skipped. Git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added permanent Settings → Plugins in live web, separate from Project review findings. Actionable scanner warnings open the affected plugin. Verified plugin operations, warning recovery, keyboard focus, static review, and all eight healthy local plugins in the browser. Full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
