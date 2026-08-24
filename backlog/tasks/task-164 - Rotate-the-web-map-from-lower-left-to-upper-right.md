---
id: TASK-164
title: Rotate the web map from lower left to upper right
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 17:28'
updated_date: '2026-08-24 17:42'
labels: []
dependencies: []
references:
  - iso-projection
modified_files:
  - src/viewers/web/iso/project.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex wants the isometric web map turned so its main depth direction rises from the lower left toward the upper right, matching the annotated screenshot, while the authored sheet layout and routes remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The fitted web map is projected in the annotated lower-left to upper-right direction
- [ ] #2 Buildings, labels, routes, grid, compass and camera fit remain aligned after the projection change
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rotate the shared projection as a temporary browser preview.
2. Compare the result against the supplied direction and text legibility.
3. Restore the original projection completely after the preview was rejected.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The temporary rotation changed the shared dimetric basis together with visible box faces and painter order. The focused projection suite passed, but Alex rejected the browser result because map text became harder to read.

The preview was fully reverted. A scoped git diff confirms no remaining source, test, or documentation change. The focused projection suite passes 13 of 13 tests after restoration. The open browser preview was reloaded.

Complexity review: keep the fixed projection. Do not add orientation configuration. A future projection change must coordinate the basis, visible faces, painter order, surface text, compass, grid, routes, bounds, and camera. If this direction is explored again, first consider changing the authored sheet layout while retaining the proven projection, subject to an approved example.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed without a product change. The rotated preview reduced text legibility, so the original projection, tests, and documentation were restored exactly. Verified by an empty scoped git diff, 13/13 passing projection tests, and a reloaded browser preview.
<!-- SECTION:FINAL_SUMMARY:END -->
