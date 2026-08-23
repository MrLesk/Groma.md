---
id: TASK-119
title: Show the Claude and Codex marks on their agents' badges
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 10:23'
updated_date: '2026-08-23 10:30'
labels: []
dependencies: []
references:
  - iso-map
  - render
modified_files:
  - src/viewers/web/atoms/marks.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex supplied the vendor marks for the two agents that work on Groma. Badges and chips for @claude show the Claude mark in its brand colour and those for @codex show the Codex mark in ink so it reads on both themes; every other handle keeps its two-letter monogram. The marks live in the repository as inline SVG strings stripped of prolog, titles, comments and editor styles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pins and chips for @claude show the Claude mark and those for @codex show the Codex mark; other handles show monograms
- [x] #2 Both marks read on the light and the dark theme
- [x] #3 The Live work pill shows a clearer hammer mark
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
1. src/viewers/web/atoms/marks.ts: MARKS with the Claude mark (brand fill) and the Codex mark (fill var(--ink)), both as inline SVG strings built from Alex's files with prolog, title, comments and editor styles stripped.
2. src/viewers/web/organisms/pins.ts imports MARKS from atoms; work-island.ts sizes a chip's mark and draws a clearer hammer in the pill.
3. Browser: @claude pins and chips carry the Claude mark, @scan keeps SC; the Codex mark parses and renders; both themes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence on the live board: 16 @claude pins and their chips carry the Claude mark (path fill #D97757), the @scan pin keeps SC, the pill shows the new hammer; the Codex mark extracted from the served bundle parses without error and its fill resolves to the ink in both themes (rgb(34,38,46) light, rgb(230,232,235) dark). bun run check green (92 node + 134 bun).

Review applied: the pin mark rule is scoped to #map so it beats the map's svg width rule (pin marks 18 px, verified), the chip ring keeps its 28 px against the island's icon rule (pre-existing defect from TASK-117, fixed here), comments trimmed. Final sizes in the browser: pin mark 18x18, chip ring 28x28, chip mark 12x12, pill hammer 18x18; check green (92 node + 134 bun).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Badges and chips for @claude show the Claude mark in its brand orange and those for @codex the Codex mark in ink, from inline SVGs in src/viewers/web/atoms/marks.ts supplied by Alex; other handles keep their monograms; the Live work pill has a clearer hammer. Verified in the browser on the live board and with a magnified render of both marks on light and dark.
<!-- SECTION:FINAL_SUMMARY:END -->
