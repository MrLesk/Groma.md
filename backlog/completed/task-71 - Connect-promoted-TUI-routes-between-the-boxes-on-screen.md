---
id: TASK-71
title: Connect promoted TUI routes between the boxes on screen
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 20:31'
updated_date: '2026-08-16 20:34'
labels: []
dependencies: []
references:
  - src/viewers/tui/projection.ts
  - src/viewers/tui/projection-routes.ts
priority: high
type: bug
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At System Context a person-to-container relationship is shown as person to system. The map currently draws the inner ELK path, which runs down the system and back up, so the Reads arrow loops beside the people. The visible route should connect the two displayed boxes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A person-to-inner-software relationship projected at context connects the person card to the system box without running past both boxes and back
- [x] #2 A relationship whose displayed ends are the authored ends still follows its laid-out route
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
1. When a projected route uses promoted endpoints, connect the displayed boxes with a short orthogonal path instead of the inner laid-out polyline.
2. Keep the laid-out route when both displayed ends are the authored ends.
3. Fixture-test the context promotion case and the unpromoted case.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Promoted endpoints now use routeBetweenBoxes on facing edges. Authored endpoints still use the laid-out polyline. No public doc change: the map already claimed one route between the visible boxes.

Verification: bun run check. Fixture test keeps a detoured person→container context route inside the person and system boxes. Unpromoted person→system keeps the laid-out bend. Live Reads dump is person right edge (31,10) to Groma left (36,10).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
At context, a person-to-viewer relationship no longer traces the inner path around Groma. The Reads arrow now runs from the person card to Groma’s facing edge. Authored-end routes still follow layout.

Verified with bun run check and a live route dump: Human architect → Groma is two cells across, not a down-and-back loop.
<!-- SECTION:FINAL_SUMMARY:END -->
