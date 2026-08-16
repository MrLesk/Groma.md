---
id: TASK-59
title: Name TUI actions from the relationship description
status: Done
assignee: []
created_date: '2026-08-16 19:28'
updated_date: '2026-08-16 19:29'
labels: []
dependencies: []
references:
  - src/viewers/tui/organisms/details.ts
  - src/viewers/action-path.ts
priority: high
type: bug
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person has several outgoing relationships that promote to the same ancestor, details listed that ancestor three times. Outgoing actions use the relationship description as the name and the authored target as the detail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An outgoing action row is titled with the relationship description, not the promoted ancestor name.
- [x] #2 Two outgoing actions that share an ancestor stay distinguishable by their authored targets.
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
1. Caption outgoing actions with description plus authored target.
2. Keep incoming rows on the promoted peer.
3. Fixture-test the caption, not live Groma copy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Outgoing action rows use the relationship description as the title and the authored target as the detail. Incoming rows still use the promoted peer. Fixture-tested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Details action rows now show Starts the viewers / Reads the architecture, with Cli or the viewer as the detail, instead of Groma three times.
<!-- SECTION:FINAL_SUMMARY:END -->
