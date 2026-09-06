---
id: TASK-28.7
title: Keep routes still when selection changes
status: Done
assignee:
  - '@grok'
created_date: '2026-08-15 15:37'
updated_date: '2026-08-15 15:42'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect arrows between items at the same level, cards, relationship labels, and arrows stay put. Only the selection mark changes. The camera does not follow the selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Arrowing between items at System Context does not move relationship labels or arrows
- [x] #2 The same selection at the same level has the same card positions whether details are open or closed
- [x] #3 Headless tests compare two context selections and an agent-tty walkthrough arrows between Groma and a person
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
1. Keep the camera on the current level (the world at context, the entered system or container otherwise). Do not reframe to the selection or its connections.
2. Assert two context selections share scale, card bounds, routes, and labels. Verify with agent-tty by arrowing from Groma to a person.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Camera is the current level only. Labels sit outside a one-cell card halo and paint after the selection mark so Curates, Reads, and Versions stay on the same cells when selection changes. Simplicity review inlined cameraBounds and compared personView to gromaView. Verified with bun run check (52 Node, 9 viewer) and agent-tty 120x36: Groma vs Human architect keep those three labels on the same lines.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Arrowing at the same level no longer moves cards, labels, or arrows. Only the selection mark changes. Verified with viewer tests and an agent-tty walkthrough from Groma to Human architect.
<!-- SECTION:FINAL_SUMMARY:END -->
