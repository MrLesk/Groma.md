---
id: TASK-291
title: Limit automatic selection zoom to readable map labels
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:19'
updated_date: '2026-09-05 22:22'
labels: []
dependencies: []
references:
  - iso-camera
  - render
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/camera.ts
  - src/viewers/web/render.ts
  - test-bun/web-selection-camera.test.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 330000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Selecting an actor or small architecture item currently enlarges it to fill the map area, making its label too large. Cap automatic architecture and flow focus at a normal readable label scale, matching the supplied reference around 1006 percent of the fitted map, while still zooming out for larger selections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Automatic architecture and flow focus stops at a normal readable label scale instead of enlarging small items to fill the viewport.
- [x] #2 Selections remain centered and complete flow paths and larger architecture bodies still fit in the available map area.
- [x] #3 Manual zoom remains available beyond the automatic focus limit.
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
1. Give architecture and flow fitting a fixed readable-scale ceiling owned by the camera, separate from manual zoom limits. 2. Verify small selections hit the ceiling and larger selections still fit, update the web guide, and compare the actor view with the supplied screenshot. 3. Run bun run check and self reviews, then the required full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Camera fitting now owns an automatic focus ceiling of 1, the normal map label scale; the renderer no longer passes the manual zoom ceiling. Existing flow and body geometry fitting still zooms out when needed. Self specification and quality reviews found no blockers: pure tests verify centered complete geometry, the ceiling across viewport sizes, immutable scene state, and manual zoom beyond the ceiling. The container-versus-component comparison now permits equal zoom when both reach that ceiling. Focused tests pass 6/6; bun run check passes including lint, types, Node tests and 310 Bun tests. Browser verification shows the actor body about 170px wide, close to the supplied approximately 176px reference; manual plus zooms further and selecting the larger browser-review flow zooms out to fit. No OKF/C4 model or stored metadata changed; this is existing camera policy only.

Final full-context complexity review found no blockers or material recommendations. It confirmed camera ownership of the readable-scale ceiling and removal of the renderer override as the simplest sufficient correction. The shared web guide also has a TASK-289 startup-port edit; coordinated with its owner and will stage only the two TASK-291 focus hunks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Automatic architecture and flow focus stops at normal readable map-label scale while larger selections still fit and center. Manual zoom can go closer. Verified against the supplied actor screenshot in the browser, with six focused camera tests and the full repository check (310 Bun tests plus Node, lint, and type checks). Final complexity review found no blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
