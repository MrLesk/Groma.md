---
id: TASK-480.2
title: List changed components and relationships in the hierarchy pane
status: To Do
assignee: []
created_date: '2026-09-21 21:25'
labels: []
dependencies:
  - TASK-480.1
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
documentation:
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 558000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In a comparison the only way to find changes is to scan the map for tinted buildings. The hierarchy pane shows no status, collapsed containers hide their changed children, and containers kept only for removed components look identical to current ones, so "C# worker (4)" appears twice. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A comparison adds a Changes | All switch to the hierarchy pane title. Changes is the default. The switch is absent outside comparisons.
- [ ] #2 Changes lists changed components under their container and system in tree order, then changed relationships as Source → Destination. Actors, flows and external systems are absent.
- [ ] #3 A component row shows its name, the source lines added and removed when its owned source changed, and its status glyph in the status colour. A row without line counts changed only its record.
- [ ] #4 Container and system rows show per-status counts of the changed components inside them. Slabs and islands stay neutral on the map.
- [ ] #5 Removed components, and containers that exist only in the starting revision, have a muted name.
- [ ] #6 All shows the ordinary tree with the same marks and counts.
- [ ] #7 Selecting a row makes the same selection the hierarchy makes today: URL, camera and details follow. The current row is marked and scrolled into view.
- [ ] #8 A comparison with no changes says so in the pane instead of showing an empty list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
