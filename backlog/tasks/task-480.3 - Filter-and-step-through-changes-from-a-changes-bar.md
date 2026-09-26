---
id: TASK-480.3
title: Filter and step through changes from a changes bar
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-26 15:57'
labels: []
dependencies:
  - TASK-480.2
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - organisms-hierarchy
  - render
  - web-page
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/comparison/tree.ts
  - src/viewers/web/comparison/control.ts
  - src/viewers/web/organisms/hierarchy.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/revision-comparison.test.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 559000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reviewer cannot tell how much changed or move through the changes in order. The legend row in the hierarchy pane names the statuses but counts nothing. Comparisons carry no tasks, so the Tasks panel slot at the bottom centre is free. With the pair used for the design, 97 of 134 changes are Modified and drown the 37 structural ones. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While comparing, a changes bar sits at the bottom centre on the Tasks panel surface. It shows one toggle per status that has changes, each with its count of components plus relationships. The legend row in the hierarchy pane is gone.
- [x] #2 Turning a status off removes its rows from the Changes list and its counts from container and system rows, and removes its tint from buildings and routes. Removed buildings and routes, and context kept only for them, leave the map.
- [x] #3 The bar shows a stepper with the position and the total of visible changes. Next and previous follow the Changes list order, wrap around, and make an ordinary selection. J and K do the same outside text inputs while comparing.
- [x] #4 With nothing selected the position shows a dash and Next selects the first change.
- [x] #5 At 1000 px with the hierarchy and details panes open the bar fits between them without covering either.
- [x] #6 Filters reset when the pair changes and are not part of the URL. A comparison with no changes shows no bar.
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
1. Add a comparison-owned bottom bar using the shared floating surface and chrome buttons. 2. Share enabled statuses and semantic change order with the hierarchy; filter removed scene items without changing stored world or layout. 3. Wire stepper selection and J/K outside inputs, reset filters on pair changes, and remove the old legend. Tests: AC 2-4 require filtering/count/navigation consistency; existing tests cover hierarchy projection but not filtering or wraparound, so extend that fixture test and add a small navigation assertion. Verify narrow layout and keyboard interaction in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused comparison suite: 6 pass; TypeScript and Biome pass. Browser at 1000×850: Next selects Checkout with 1/6, disabling Modified yields four changes and updates ancestor counts, J selects Receipt worker at 1/4. Bar bounds x351–568 lie between hierarchy right292 and details left628. Pure test verifies wraparound, removed building/route/context filtering and unchanged scene bounds/immutability. Final pair reset/live/theme checks remain part of parent integration.

Parent TASK-480 integration is verified: live and static delivery, all three themes, small/empty comparisons, 1000 px layout, a single-snapshot export, 400 commits, reduced motion and live owned-source refresh. Final repository check passed (752 Bun tests, 16 Node tests; 48 skips; zero failures). Cold simplicity, implementer specification/quality and final full-context complexity reviews have no blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added comparison status filters and wraparound change navigation using one hierarchy order. Removed filtering changes only projected visibility, preserving the source world and geometry. Verified by six focused tests, TypeScript/Biome and browser filtering, keyboard and narrow-layout checks; parent owns final integration verification.
<!-- SECTION:FINAL_SUMMARY:END -->
