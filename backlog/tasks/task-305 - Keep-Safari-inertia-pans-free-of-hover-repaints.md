---
id: TASK-305
title: Keep Safari inertia pans free of hover repaints
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 15:02'
updated_date: '2026-09-06 15:12'
labels: []
dependencies: []
references:
  - iso-map
  - layer-modes
modified_files:
  - src/viewers/web/iso/map.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/layers/paint.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer panning the web map with a trackpad should retain smooth motion after lifting their fingers. Safari recomputes hover as elements move beneath a stationary pointer, repainting the cached map. Suppress transient map hover highlights while the camera is moving, then restore them after motion settles; keep selection, hit testing, and all map detail available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map hover highlights stay inactive through camera movement and inertia, then return when motion settles.
- [x] #2 Selected and focused treatments, element clicking, panning, zooming, and cached camera rendering retain their supported behavior.
- [x] #3 Record Safari before-and-after evidence, verify the final hover behavior in the browser, and pass bun run check.
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
Use the existing camera-settle timer to mark motion on the map host. Gate only map hover CSS with a selector that adds no specificity, preserving selected styles and pointer hit testing. Verify the motion lifecycle and interactions, compare Safari frame measurements, run bun run check, and perform implementer specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The existing camera-settle timer now controls transient hover styling without disabling hit testing or changing selected and focused styles. Safari diagnosis at the same zoom and decaying pan showed 34 frames over 25 ms with normal hover versus 1 with hover hit testing temporarily disabled; these are diagnostic measurements, not a benchmark of the final CSS change. Final browser verification observed the motion marker throughout inertia, removal after settling, unchanged world transforms during panning, retained selection, and successful element clicking. Alex reloaded the final viewer in Safari and confirmed: Smooth now. bun run check passed: 106 Node tests and 330 Bun tests, with six existing complexity warnings. git diff --check passed. Implementer specification and quality reviews found no blocking issues; the change uses the existing camera lifecycle and remains scoped to hover painting. Web viewer documentation describes the behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Paused transient hover highlights during camera movement and trackpad inertia, restoring them after settling while retaining selection and clicking. Verified the motion lifecycle and interactions in the browser, passed all 436 tests, and received confirmation from Alex that Safari inertia is smooth.
<!-- SECTION:FINAL_SUMMARY:END -->
