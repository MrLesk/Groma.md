---
id: TASK-302
title: Inset surface labels from map borders
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 14:12'
updated_date: '2026-09-06 14:19'
labels: []
dependencies: []
references:
  - sheet-composition
  - iso-map
modified_files:
  - src/sheet/measure.ts
  - src/viewers/web/iso/text.ts
  - test-bun/iso-map.test.ts
  - test-bun/sheet-scene.test.ts
type: bug
ordinal: 340000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep system, container, and group labels visibly clear of their surface borders as zoom changes. The label gap follows the same zoom weight as border widths while roof labels and architecture geometry retain their current behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Surface labels gain a small inward inset on the outer edges; building roof labels retain their current placement.
- [x] #2 Label bounds, content clearance, and routes remain valid in the supported map, with browser verification and bun run check passing.
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
Make the surface-label inset use the same zoom weight as border strokes. Keep the existing layout inset as the anchor and apply the zoom adjustment inside the label plane when the camera scale settles. Verify the nested labels at the reported zoom levels and preserve camera caching during pure pans.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a separate 10-plane-pixel surface inset (previously 6), used by surface text/chips and shared label width/depth measurements. Roof labels still use their original proportional roof padding. Existing geometry assertions now check the actual surface inset. The captured supported map regenerates all 113 routes across 76 buildings and 18 zones. Browser inspection at zoomed-out scale confirms a visible gap between surface chips/text and border lines. The existing preview on port 4773 now uses this revision.

bun run check passes with 106 Node tests and 329 Bun tests, six unchanged complexity warnings, and clean git diff --check. Implementer specification and quality reviews confirm the inset remains shared between measurement and painting, with no change to architecture semantics or map interaction. Existing documentation describing labels near their surface edges remains accurate; the new metric has a concise source comment. No new decorative tests were added.

Alex clarified that padding must follow the border zoom-weight rule, rather than only increasing the fixed world-space inset. Reopening the task for this revision.

Final revision: the fixed 10-plane-pixel layout inset is an anchor. A small inner group moves each surface label and its chip by (CHIP_PAD - SURFACE_PAD + 3 * borderWeight / cameraScale) along +x and -y in its own plane. Therefore the chip-to-border inset in projected screen units follows 3 * borderWeight rather than shrinking linearly with camera scale. Existing --weight and --camera-scale values update when zoom settles; pure pan frames add no label updates. Roof labels do not receive this transform.

Browser verification at camera scale 0.022387 / weight 0.822552 produced local offset 103.225, and at scale 0.208499 / weight 2 produced offset 21.7771, matching the zoom-weighted gap. The Groma, Web viewer, and Blueprint map corner was inspected after further zoom and pan: all three labels remain clear of their borders. Final bun run check passes 106 Node and 329 Bun tests, with six unchanged complexity warnings. A subsequent source-comment clarification changes no behavior. Targeted implementer re-review confirms the transform is inside the label plane, both text and chip move together, existing styling and hit targets remain intact, and panning retains the cached layer.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made surface-label padding follow the same zoom weight as border widths, compensating for camera scale so the visible gap stays proportional when zooming out. Verified nested labels at multiple zoom levels, retained all 113 routes, and passed all 435 repository tests.
<!-- SECTION:FINAL_SUMMARY:END -->
