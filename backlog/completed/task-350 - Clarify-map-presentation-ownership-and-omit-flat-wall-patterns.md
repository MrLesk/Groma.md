---
id: TASK-350
title: Clarify map presentation ownership and omit flat wall patterns
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:08'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - presentation
  - layer-modes
  - iso-map
  - render
  - map-view
modified_files:
  - src/viewers/web/layers/orbit.ts
  - src/viewers/web/iso/presentation.ts
  - src/viewers/web/render.ts
  - src/viewers/web/chrome/map-view.ts
  - test-bun/web-layer-mode.test.ts
  - test-bun/web-map-presentation.test.ts
  - src/viewers/web/iso/style.ts
  - groma/systems/groma/containers/web-viewer/components/presentation.md
  - groma/systems/groma/containers/web-viewer/components/layer-modes.md
type: chore
ordinal: 396000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep selection of Iso, 2D and Layers beside scene presentation, leaving orbit geometry in the layer helper. Do not generate side-wall patterns in the overhead view where walls have no area. Preserve camera fitting and selection behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map view state and animation scheduling live with presentation; orbit helpers retain only pose geometry.
- [x] #2 The overhead map contains no degenerate side-wall patterns and renders the same top faces.
- [x] #3 View switches, F2 return behavior, selection and same-view camera behavior remain intact.
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
Move map motion types and state/scheduler into the existing presentation module, update imports and architecture responsibility descriptions, skip side-wall tiles for overhead projection, and verify motion tests plus the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved view state and animation scheduling into existing presentation; orbit retains pose geometry. Overhead rendering omits side-wall patterns. Twenty-six camera and motion tests passed. Browser verification confirmed six top faces, no side faces, nonsingular ground patterns, preserved selection during 2D/F2 transitions, F2 return to 2D, and unchanged zoom when choosing the current view. Architecture descriptions were curated through Groma commands; element IDs and source links remain intact. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved view state and animation scheduling into existing presentation; orbit retains pose geometry. Overhead rendering omits side-wall patterns. Twenty-six camera and motion tests passed. Browser verification confirmed six top faces, no side faces, nonsingular ground patterns, preserved selection during 2D/F2 transitions, F2 return to 2D, and unchanged zoom when choosing the current view. Architecture descriptions were curated through Groma commands; element IDs and source links remain intact. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
