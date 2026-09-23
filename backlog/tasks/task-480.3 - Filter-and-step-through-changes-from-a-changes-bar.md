---
id: TASK-480.3
title: Filter and step through changes from a changes bar
status: To Do
assignee: []
created_date: '2026-09-21 21:25'
labels: []
dependencies:
  - TASK-480.2
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
documentation:
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
- [ ] #1 While comparing, a changes bar sits at the bottom centre on the Tasks panel surface. It shows one toggle per status that has changes, each with its count of components plus relationships. The legend row in the hierarchy pane is gone.
- [ ] #2 Turning a status off removes its rows from the Changes list and its counts from container and system rows, and removes its tint from buildings and routes. Removed buildings and routes, and context kept only for them, leave the map.
- [ ] #3 The bar shows a stepper with the position and the total of visible changes. Next and previous follow the Changes list order, wrap around, and make an ordinary selection. J and K do the same outside text inputs while comparing.
- [ ] #4 With nothing selected the position shows a dash and Next selects the first change.
- [ ] #5 At 1000 px with the hierarchy and details panes open the bar fits between them without covering either.
- [ ] #6 Filters reset when the pair changes and are not part of the URL. A comparison with no changes shows no bar.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
