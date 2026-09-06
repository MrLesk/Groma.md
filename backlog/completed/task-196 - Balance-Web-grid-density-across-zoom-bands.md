---
id: TASK-196
title: Balance Web grid density across zoom bands
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 19:11'
updated_date: '2026-08-27 19:22'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/map.ts
  - test-bun/iso-scale.test.ts
  - src/viewers/web/iso/paint-ground.ts
priority: high
type: bug
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect zooms the Web map from 225% down to 50%, the graph-paper hierarchy remains calm and readable instead of becoming crowded at close zoom or thick again at distant zoom. The result should match the reported bands: 225%-85% is currently too dense, 85%-65% is acceptable, and 65%-50% is currently too dense or thick.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 From 225% through 85%, the grid reads as a quiet drafting aid rather than a crowded texture
- [x] #2 From 85% through 65%, the currently acceptable grid hierarchy is preserved
- [x] #3 From 65% through 50%, grid lines do not become dense or visually thicker again
- [x] #4 Light, dark, and Blueprint use the same zoom behavior with theme-appropriate contrast
- [x] #5 Pan performance keeps the distant-grid optimization and does not add frame-by-frame geometry work
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
1. Replace the full-viewport grid field with one finite field inside the existing camera, bounded by the projected scene, so the grid is attached to the architecture and pan changes only the camera transform. 2. Keep the five-cell hierarchy, but show minor cells only when their projected pitch is at least six screen pixels and draw each repeated major boundary once. 3. Verify 244%, 195%, 156%, 125%, 100%, 80%, 64%, and 50% in light, dark, and Blueprint; prove pan does not mutate the pattern; run focused and full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rendered diagnosis at 1280x720: at 244%, minor cells appeared with roughly three screen pixels of projected pitch; at 195% the major-only grid still filled the complete viewport. This made the background read as a moving texture even though the theme colours were already soft.

Replaced the full-viewport field with one polygon using the projected sheet frame, placed first inside the existing camera. The pattern now owns only the constant ground-plane matrix; zoom and camera movement transform the parent group, so map.move performs no pattern geometry or transform write.

Raised the minor-cell threshold from three to six screen pixels and removed the repeated tile's duplicate terminal major edges. Production code is seven lines smaller across map.ts and scale.ts.

Browser verification at http://localhost:4752/?system=groma, 1280x720: 244%, 195%, 156%, 125%, and 100% retained a finite frame-bound major grid; 80%, 64%, and 51% removed the grid at the existing distant threshold. Light, dark, and Blueprint all rendered cleanly. The patternTransform stayed exactly matrix(1 0.5 -1 0.5 0 0) from 244% through 51%, while the camera and visibility states changed. Page identity and meaningful content passed; no framework overlay, console warning, or console error appeared.

Cold simplicity review: the flow is scene paint -> assign frame polygon and plane matrix -> camera movement transforms the shared group -> scale toggles minor/full visibility. Moving the field into the existing camera deletes the separate grid-view state and every camera-dependent pattern rewrite. No new component, renderer, token, or dependency exists, and further collapse would either duplicate scene geometry or mix grid paint into the sheet painter.

Verification: bun run check exited 0; TypeScript, 81 Node tests, and 185 Bun tests passed. Biome reported only existing complexity warnings and no errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bound the Web grid to the projected architecture frame, moved it into the existing camera, delayed minor cells until their pitch is readable, and removed duplicate major edges. The grid is calm from 244% to 100%, disappears cleanly at distant zoom, and never rewrites its pattern during camera movement. Verified in all three themes through Browser QA and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
