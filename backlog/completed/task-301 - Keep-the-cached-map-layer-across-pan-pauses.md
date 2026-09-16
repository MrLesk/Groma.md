---
id: TASK-301
title: Keep the cached map layer across pan pauses
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 13:51'
updated_date: '2026-09-06 13:58'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/map.ts
type: bug
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer panning the zoomed-out web map in Safari should avoid unnecessary SVG redraws between short movements. Preserve the current map detail, camera position, hit targets, and sharp rendering after zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pure panning and pauses keep the existing SVG camera transforms and scale-dependent styles unchanged while the displayed map follows the camera.
- [x] #2 Zoom still settles to sharp SVG rendering with the correct detail level; panning followed by zoom and selection stays aligned.
- [x] #3 The supported map is compared before and after in Safari; browser verification and bun run check pass.
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
Capture the current renderer and compare a fixed pan-and-pause sequence in Safari. Keep the cached camera transform after a pure pan; commit the SVG layers only when scale or zoom weighting changes. Verify long pans, zoom transitions, and selection in the browser, run the repository check, and review the small change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a small change in iso/map.ts: track the committed zoom ratio and retain the CSS camera transform across pure pan pauses. Commit all three SVG camera layers only when scale or zoom weighting changes. This preserves geometry, detail, routing, and selection. No additional abstraction, dependency, or UI was added; existing public documentation remains accurate and the camera-settle comment now describes the behavior.

Safari 27 comparison used the same captured 76-building/113-route map, 1920×937 viewport, device pixel ratio 1, and eight 700 ms pan / 400 ms pause cycles at twice fit. Original: 47.6 FPS, 77 ms p95, 24 frames over 50 ms, 24 SVG-world transform mutations. Repeated original: 48.0 FPS, 75 ms p95, 24 frames over 50 ms, 24 mutations. Fixed: 58.8 FPS, 18 ms p95, 2 frames over 50 ms, zero world-transform mutations; the initial and final SVG camera transforms match. All runs remained visible. Evidence: /tmp/task301-first-baseline.json and /tmp/task301-results.json. A temporary comparison-page URL replacement was corrected before measuring the fixed version; the originally measured baseline used the original renderer as intended.

Safari interaction verification: panned the focused Iso map view, zoomed in, inspected sharp surfaces and labels, then clicked the visible Iso projection building; the URL and details correctly selected iso-projection. bun run check passes: 106 Node plus 329 Bun tests, six unchanged complexity warnings. git diff --check passes. Implementer specification and quality reviews found no blocking defect; pan offset remains relative to the committed SVG camera and zoom settles the complete current camera, preserving hit coordinates. No new decorative or DOM-content unit tests were added for this small rendering change; the browser measurements directly verify the camera lifecycle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Kept the cached map layer across pan pauses and retained sharp SVG commits after zoom. In the controlled Safari comparison, panning improved from about 48 to 59 FPS and frames over 50 ms dropped from 24 to 2. Verified zoom and selection alignment; all 435 repository tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
