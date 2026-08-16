---
id: TASK-43
title: Make web relationship labels readable
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 14:45'
updated_date: '2026-08-16 14:46'
labels: []
dependencies:
  - TASK-39
references:
  - src/viewers/web/render.ts
  - src/world-layout.ts
priority: high
type: bug
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On `groma web`, relationship labels on the map are unreadable: they appear as mirrored or sliced letter-fragments beside the routes. Box names stay readable. A person looking at this repository's city in 3D or 2D must be able to read each relationship description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relationship descriptions on the web map are readable in the 3D city and the 2D plan
- [x] #2 Labels stay on the map plane at their laid-out positions and do not change world layout
- [x] #3 Box names, group names, routes, and the 2D/3D switch still work
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
1. Size each relationship label canvas and plane to the measured text, not the 1-unit ELK reservation. Keep the ELK box only as the position.
2. Draw the description with the paper halo on that plane, still flat on the map.
3. Check 3D and 2D in the browser against this repository; keep scene tests passing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause: ELK label height is 1 world unit; the canvas was 16px tall with 64px type, so only a sliced band of each glyph showed. Fix: size the label plane to the measured text and keep the ELK box as the position only. Browser: 3D and 2D on this repo now show readable descriptions (e.g. Supplies the annotated world, Reads and writes architecture Markdown). bun test test-bun/web-scene.test.ts 9/9. No doc change — the contract already said routes have labels.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relationship labels on groma web were sliced into unreadable fragments because they were painted into ELK's 1-unit-tall reservation. They now draw at the measured text size on the map plane. Verified in the browser on this repository in 3D and 2D, and with the existing scene tests.
<!-- SECTION:FINAL_SUMMARY:END -->
