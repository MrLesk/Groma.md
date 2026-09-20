---
id: TASK-389
title: Animate the Settings dropdown and Theme submenu
status: Done
assignee:
  - '@codex'
created_date: '2026-09-13 20:24'
updated_date: '2026-09-13 20:51'
labels: []
dependencies: []
references:
  - settings-control
modified_files:
  - src/viewers/web/settings/control.ts
  - docs/viewers/web/index.md
ordinal: 435000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Settings dropdown and nested Theme menu appear abruptly next to the polished camera controls. Give their opening and dismissal a short, coordinated motion while preserving native disclosure, focus and theme behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings opens and closes with a subtle fade and movement from its trigger; Theme uses a matching motion from its parent row.
- [x] #2 Repeated toggling, outside clicks, Escape, Plugins and theme selection remain responsive; closed menus cannot receive pointer clicks and reduced motion removes animation.
- [x] #3 Verify live and static menus in the browser and pass bun run check.
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
Use scoped CSS transitions on the existing native details disclosures, with discrete content visibility for closing. Keep native selection and dismissal code unchanged and verify interaction during transitions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scoped CSS adds a 140 ms fade and 180 ms movement/scale to Settings and its Theme flyout, with the origin facing each trigger. Native details content visibility remains visible for the closing transition; no JavaScript timing or replacement menu state was added. Closed panels disable pointer events immediately, including the nested Theme panel when the parent closes. Browser verification observed intermediate closing opacity with open=false and pointer-events=none for both menus. Verified Escape, trigger toggling, outside click dismissal, Plugins access and static-export theme selection. Reduced-motion emulation showed zero transition duration and immediate full opacity; emulation was then removed. Restarted localhost:4747 and verified parent dismissal disables nested menu clicks. Consulted official browser documentation for native details transitions: https://developer.chrome.com/blog/styling-details . Full bun run check passed: lint, types, 16 Node tests, 307 Bun tests, 6 optional native tests skipped. Git diff --check passed. Self specification, quality and simplicity reviews found no blocker.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added coordinated opening and closing animations to Settings and Theme while keeping native menu behavior. Verified dismissal, plugin access, static themes and reduced motion in the browser. Full repository check passed; local Groma updated.
<!-- SECTION:FINAL_SUMMARY:END -->
