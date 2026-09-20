---
id: TASK-435
title: Animate task pins between touched components
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 07:58'
updated_date: '2026-09-19 08:02'
labels: []
dependencies: []
references:
  - web-work-pins
modified_files:
  - src/viewers/web/work/pins.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 508000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a live task records a file owned by another component, its map pin jumps to the new location. Give the map reader a clear, smooth visual connection between the previous and next touched component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An existing visible task pin travels smoothly from its previous component to the next touched component.
- [x] #2 Pan, zoom, repeated task updates, selection, and completion keep working during pin movement.
- [x] #3 New pins keep their existing arrival behavior, and reduced-motion users receive immediate placement.
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
1. Keep travel state in the existing Web pin layer and animate the displayed world position with a gentle arc and eased landing. 2. Retarget from the current position on another component update, preserving camera projection and existing pin identity. 3. Document the motion, verify it in a browser, and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification passed using /tmp/groma-pin-verify.mjs against a bundle of the real pin layer: intermediate arc position, exact landing, redirect from current position, unchanged-update continuity, camera scaling, selection and click, completion hold/hide, removal, baseline/new arrival, and reduced motion. Inspected /tmp/groma-pin-midflight.png. The first camera assertion compared the last painted animation frame with a later clock sample; synchronized the browser check to one timestamp and verified exact scaling. Source behavior did not require a correction. Initial sandboxed repository check could not create test servers/watchers; rerunning with access. Specification and quality review: applyWork retains pin identity; updatePin starts travel only for component changes; positionOf owns interpolation; place applies camera coordinates and stops requesting frames when travel ends. Existing draft styling and other concurrent edits are preserved. No architecture concepts, OKF metadata, or C4 boundaries changed.

Final validation: the real-browser motion checks pass. bun run check passed lint (existing warnings only), TypeScript, all 16 Node tests, and 593 Bun tests with 35 skips, but three large-world terminal tests timed out at 24.55 s against the unchanged 20 s limit. A focused run of test-bun/large-world.test.ts passed all four tests in 16.78 s. Investigation: the three tests await the same large-world model preparation through loadTerminalModel and sheetScene; they do not execute the Web pin layer. The suite/isolated difference is timing-sensitive shared fixture preparation, outside this presentation-only change. No test assertions, timeout, or runner settings changed. This unrelated full-suite limitation remains recorded; animation acceptance criteria and task-scoped checks pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task pins now travel between touched components on an 850 ms eased arc, retarget from their current position, and remain aligned during camera movement. Reduced motion places pins immediately. Existing arrival, draft, selection, and completion behavior is preserved. Browser checks passed. Full repository validation passed lint/types/Node tests but hit three unrelated large-world timeouts; all four large-world tests pass alone. Documentation updated.
<!-- SECTION:FINAL_SUMMARY:END -->
