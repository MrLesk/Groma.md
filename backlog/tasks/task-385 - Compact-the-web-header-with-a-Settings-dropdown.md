---
id: TASK-385
title: Compact the web header with a Settings dropdown
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 19:59'
updated_date: '2026-09-13 20:04'
labels: []
dependencies: []
references:
  - settings-control
  - settings-dialog
  - page
  - theme-control
  - review-control
modified_files:
  - src/viewers/web/atoms/settings-dialog.ts
  - src/viewers/web/review/control.ts
  - src/viewers/web/settings/control.ts
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/theme-control.ts
  - docs/viewers/web/index.md
ordinal: 431000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web header spends too much width on separate Settings and Theme controls. Users need one compact Settings entry that keeps plugin management and appearance choices easy to find.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header has an icon-only Settings dropdown containing Plugins in live web and a nested Theme dropdown; the separate header Theme control is removed.
- [x] #2 Theme choices and saved preference still work in live web and static export; static export offers no plugin management.
- [x] #3 The Settings dialog has no expand button, while Project review retains its expand action.
- [x] #4 Dropdown dismissal and keyboard focus work, plugin warnings still open the affected plugin, and the full repository check passes.
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
Reuse native details dropdowns and existing theme state. Move theme markup under Settings, open Plugins from its menu item, and make dialog expansion optional for the two current callers. Verify browser flows and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused native details and the existing popover dismissal/theme controller. Settings now contains Plugins and a left-opening Theme flyout. Plugin dialog expansion is disabled through the shared dialog options; Project review keeps expansion. Browser verification covered nested Escape dismissal and focus return, Plugins opening without expansion, warning opening the blocked plugin details, preserved review expansion, theme selection and reload, and static export Theme with Plugins hidden. Visual verification caught and fixed the generic header popover top-position rule overriding the nested flyout; the flyout now aligns with its Theme row. Restarted localhost:4747 and verified Installed 8, no Needs attention, and no Settings expand button. Full bun run check passed after the final change: lint, types, 16 Node tests, 305 Bun tests, 6 optional native tests skipped; git diff --check clean. Self specification, quality and simplicity reviews found no scope-backed blocker. Existing theme persistence and plugin data ownership remain unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compacted the header into an icon-only Settings dropdown with Plugins and nested Theme choices. Removed Settings dialog enlargement. Verified keyboard dismissal, warnings, static theme persistence and all eight healthy local plugins; full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
