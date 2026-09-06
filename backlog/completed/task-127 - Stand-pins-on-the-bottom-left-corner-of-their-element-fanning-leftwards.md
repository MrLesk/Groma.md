---
id: TASK-127
title: 'Stand pins on the bottom-left corner of their element, fanning leftwards'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 12:48'
updated_date: '2026-08-23 12:58'
labels: []
dependencies: []
references:
  - iso-map
  - render
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/organisms/pins.ts
  - docs/viewers/web/index.md
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pins stand on the roof centre and cover the name. Alex wants each pin's foot at the bottom-left corner of its building (the west corner of the footprint at ground level; for a slab the west corner of its top, for a system island its west corner), with the pins of one element fanning out leftwards from that corner, so nothing sits over the roof text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pin's foot sits on the west corner of its building's footprint at ground level; on the west corner of a slab's top or of a system island
- [x] #2 Several pins on one element fan out leftwards from that corner, the first standing straight on it
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
1. src/viewers/web/iso/map.ts: anchorOf returns the first point of a building's lowest left face (the ground west corner), the top face's west corner for a slab and the polygon's west corner for an island; centroid() goes.
2. src/viewers/web/organisms/pins.ts: fanOut spreads the pins of one element leftwards from the foot (fan = -index * pitch); comments follow.
3. docs/viewers/web/index.md: the stem and fan sentences.
4. Browser: a building pin's foot equals the west corner of its footprint at ground (projected), two pins on one element sit at fan 0 and -46 px, the roof text is clear.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence (Chrome, 1280x800, fitted view): the TASK-40 pin's foot coincides with the first point of the scanner-plugin building's lowest left face (its ground west corner) within a pixel; the pins sharing render stand at --fan 0, -46, -92 … -460 px, leftwards from that corner, and a lone pin stands straight on it. At the fitted zoom seven badges of the long fans still lie over other buildings' roof text, which fanning across the sheet cannot avoid. Review applied: the place() comment, a comment naming the corner each face index is, and a docs clause exact for round and pill buildings, whose foot is the curve's leftmost ground point (kept on the silhouette rather than the empty rect corner). bun run check green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A pin's foot stands on its building's bottom-left corner (the ground west corner of a box, the leftmost ground point of a round or pill building, the west corner of a slab's top or of a system island) and the pins of one element fan out leftwards from it, so roof names stay clear. Verified in Chrome by comparing pin positions with the projected faces, and by bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
