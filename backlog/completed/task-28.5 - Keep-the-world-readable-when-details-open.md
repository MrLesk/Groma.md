---
id: TASK-28.5
title: Keep the world readable when details open
status: Done
assignee:
  - '@grok'
created_date: '2026-08-15 15:10'
updated_date: '2026-08-15 15:22'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
  - src/viewers/tui/projection.ts
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the architect inspects a person or other leaf in groma view, the context diagram stays readable beside the details. Enter on a system or container still frames that item's children.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enter on a person at System Context opens details and still shows Coding agent, Human architect, Groma, and Git as compact cards
- [x] #2 Enter on Groma still opens Containers and frames Groma's containers
- [x] #3 Relationship labels do not overwrite a card's name or kind line
- [x] #4 Headless viewer tests and an agent-tty 120x36 walkthrough cover start, person details, and Groma inspect
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
1. In projection, frame the side-panel camera on the selection's children only when children exist. Otherwise keep the current-level camera so a person or other leaf does not fill the world.
2. Size every card as a compact titled card centered in its projected bounds so people and external systems do not stretch to empty ELK boxes.
3. Keep relationship labels on routes, not on a card's name or kind line. Tighten placement only if compact cards still collide.
4. Extend the headless details tests and verify start, person details, and Groma inspect with agent-tty at 120x36.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Camera frames children only when they exist. Cards are compact titled boxes; overlapping cards after a side-panel shrink are separated. Labels stay off card name and kind lines. Simplicity review dropped origin-width and extra closed-context assertions. Collapsing label search put Reads back on PERSON or clipped it to Re, so the route-and-row search stayed. Verified with bun run check (52 Node, 9 viewer) and agent-tty 120x36 start, person details, and Groma inspect. Start snapshot has no PER Reads. Person details shows Human architect, Groma, and Git beside the panel.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Inspecting a person keeps the System Context diagram beside the details. Enter on Groma still frames its containers. Labels sit on routes. Verified with viewer tests and an agent-tty 120x36 walkthrough of start, person details, and Groma inspect.
<!-- SECTION:FINAL_SUMMARY:END -->
