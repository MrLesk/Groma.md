---
id: TASK-433
title: Match scanner settings to the setup card UI
status: Done
assignee:
  - '@codex'
created_date: '2026-09-17 07:01'
updated_date: '2026-09-17 07:07'
labels: []
dependencies: []
references:
  - scanners-settings
modified_files:
  - src/viewers/web/scanners/name.ts
  - src/viewers/web/startup/scanners.ts
  - src/viewers/web/scanners/settings.ts
  - docs/viewers/web/index.md
ordinal: 506000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The scanner setup screen presents a readable summary even for large projects. Settings should use the same visual hierarchy while retaining scanner management.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings shows compact scanner cards with readable names, versions, and clear status.
- [x] #2 Detection details remain collapsed, searchable, and usable with many project paths.
- [x] #3 Search, grouping, install, update, retry, remove, and add-source actions remain usable in light, dark, and narrow layouts.
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
Reuse the setup name presentation, restyle settings cards and detection details, preserve existing action bindings, verify through a fixture preview and the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented matching setup/settings name presentation and bordered scanner cards with version metadata, status badges, and primary actions. Detection paths are collapsed, counted, searchable, and bounded to a scrollable list; filters and expansion survive row refresh. Existing scanner model and management requests remain unchanged. Browser verification used the actual dialog and binding with sample state: dark and light themes, 375px narrow layout, 1,000 paths filtered to one match, filter retained during update, explicit version, install, restore, remove, retry, both bulk actions, add source, and scanner search. Full bun run check passed: 16 Node tests and 425 Bun tests, 25 skipped; one existing complexity warning outside this task. Initial sandbox run could not start servers or watchers; rerun with required access passed. Implementer specification and quality reviews found no blocking defects; no architecture or scanner contract change. Updated web documentation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Matched Settings scanner cards to the setup UI, preserving management actions and adding searchable detection paths. Verified actual UI in dark/light and narrow layouts with 1,000 paths; full repository check passed.
<!-- SECTION:FINAL_SUMMARY:END -->
