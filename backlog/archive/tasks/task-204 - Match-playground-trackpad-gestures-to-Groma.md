---
id: TASK-204
title: Match playground trackpad gestures to Groma
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-28 20:50'
updated_date: '2026-08-30 21:07'
labels: []
dependencies: []
references:
  - layout-comparison
modified_files:
  - layout-comparison/src/interaction.ts
  - layout-comparison/test/interaction.test.ts
type: enhancement
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect navigates the routing playground, two-finger scrolling pans the map and a trackpad pinch smoothly zooms around the pointer, matching the supported Groma Web map gesture semantics without changing layout, routes, or selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A trackpad pinch smoothly zooms the playground around the pointer instead of applying a fixed jump
- [ ] #2 Two-finger scrolling pans horizontally and vertically; command/control plus wheel zooms
- [ ] #3 Route selection, pointer dragging, double-click reset, variant switching, and topography remain unchanged
- [ ] #4 Focused camera tests and browser QA cover pinch zoom, two-finger pan, stable route geometry, and a clean console
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse Groma's wheel-action semantics in the playground interaction domain: plain trackpad deltas pan, while control/command wheel deltas produce a smooth exponential zoom factor. 2. Apply pan in viewBox units and zoom around the pointer without touching layout or route state. 3. Add focused tests for gesture interpretation and camera math. 4. Run playground checks, bun run check, and browser QA on port 4141.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the playground's fixed wheel zoom jump with one dependency-free viewBox operation that follows Groma's gesture semantics and is injected into the existing browser interaction script.

Added focused camera tests that compare the playground operation with Groma's production wheelAction for two-finger pan, trackpad pinch, and command-wheel zoom.

Verification: all 40 playground tests and its TypeScript check pass; bun run check passes with 193 repository tests. Browser QA at http://localhost:4141 confirms the tested wheelViewBox implementation is embedded in the rendered page, variant switching remains functional, the map renders without a framework overlay, and console warnings/errors are empty. The Browser runtime cannot emit a native trackpad gesture, so human pinch feel remains the final approval check.

The cold simplicity review passed with no blocking or optional findings: one pure camera operation and one wheel listener are the minimum sufficient implementation, and the three tests cover distinct required paths.
<!-- SECTION:NOTES:END -->
