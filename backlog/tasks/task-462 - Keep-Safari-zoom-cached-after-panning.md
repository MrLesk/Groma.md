---
id: TASK-462
title: Keep Safari zoom cached after panning
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 14:25'
updated_date: '2026-09-20 14:55'
labels: []
dependencies: []
references:
  - map
  - camera
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/map.ts
  - docs/viewers/web/index.md
priority: high
type: bug
ordinal: 534000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Safari map zoom becomes slow after panning, while zooming without a preceding pan remains smooth. Alex reports that the map stays crisp during the slow zoom, suggesting the browser is repainting instead of reusing the camera layer. Restore the supported cached-camera behavior for the pan-then-zoom sequence without reducing map detail or changing navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Panning followed by zooming in Safari reuses the camera paint cache during movement and returns to sharp rendering when zoom settles.
- [x] #2 Pan pauses, zoom-only gestures, selection and source labels retain their current positions and supported behavior.
- [x] #3 Record Safari evidence for the reported sequence and pass the required repository check.
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
1. Keep the existing cached camera and settle timer. Move hierarchy-label padding updates from each movement frame into commitCamera, alongside the sharp SVG scale update. Pure pan keeps its cached transform without repainting labels.
2. Update the web guide to describe the approved behavior: labels and hit areas scale with the cached map during pan/zoom; exact eight-pixel padding returns when zoom settles. Browser presentation owns this behavior; OKF knowledge and C4 element boundaries stay unchanged.
3. Verify the production bundle in native Safari using the same pan → pause → zoom benchmark, plus settled-padding, label-selection and camera-alignment checks. Existing camera-motion and iso-map tests cover motion rules and settled geometry; use real browser evidence for cache behavior instead of adding source-text or duplicate geometry tests.
4. Run bun run check, complete implementer specification/quality reviews and the requested full-context complexity review, then finalize and commit/push only this task’s files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnosis: TASK-402 (9aa31558, 2026-09-16) added padSurfaceLabels to every scale-changing move. This changes 116 SVG label attributes per zoom frame in the current manual scene, invalidating Safari cached rendering. Native Safari 27.0, 1512×781 map viewport, DPR 2, fixed snapshot with 114 buildings/55 routes: baseline pan → 600 ms pause → zoom was 7.10/7.10 FPS (two runs), versus 60.15/60.11 FPS when only the per-frame label writes were suppressed. Pan remained about 50–51 FPS, with no label or world-transform mutations. Explicitly promoting the existing paint surfaces did not fix the slowdown (7.23/7.22 FPS). The controlled zoom-only run also reproduced slow painting in this scene; the report is therefore confirmed for pan → zoom but is not exclusive to that sequence.
Design decision pending: the web guide explicitly promises eight-pixel label padding on every zoom frame. Proposed minimal correction keeps the cached map unchanged during movement and restores exact padding with the existing sharp-scale commit after 250 ms. Alex was asked whether this brief scaling of padding is acceptable.
Coverage review: existing camera-motion tests cover interpolation/interruption, and iso-map tests cover label clearance at multiple settled zoom levels in iso and 2D. The missing evidence is browser paint-cache behavior, which pure geometry tests cannot establish. Use the native Safari benchmark plus DOM mutation/settled-padding checks for this small rendering fix; do not add a test that freezes source text or duplicates geometry coverage. Temporary benchmark files and measurements are under /tmp/groma-task462 and are not repository changes.

Reviewable prototype (temporary bundle only; repository source unchanged while the design question is pending): moving padding updates into commitCamera gives 60.13 FPS for zoom after pan, p95 18 ms, zero >25 ms frames, and zero label/world SVG mutations during movement. After settling, all 29 hierarchy labels return to 8 px (maximum error <0.000001 px); label identity and selection checks pass; all world camera coordinates align within 0.00001 px. Pure pan retains its cached CSS transform after the pause.

Alex approved the minimal correction: “apply the same approach as the panning/zoom. do not change while zooming is happening or during panning.” Label padding and hit-area geometry will remain unchanged during gestures and update with the sharp camera commit once zoom settles. This replaces the previous per-frame padding requirement.

Implementation: moved the existing padSurfaceLabels call into commitCamera, where sharp SVG scale, stroke weight and facade detail already settle together. No new rendering layer, state, helper, dependency or source file. The web guide now reflects the approved cached-motion behavior. bun run check passed (lint/type checks and Node/Bun suites); the Bun suite reported 617 passing, 36 skipped, zero failures. Existing lint diagnostics are outside the changed code.

Production verification: unmodified production module bundled in the same Safari 27 benchmark, fixed 114-building/55-route isometric scene at 1512×781 DPR 2. Both pan → 600 ms pause → 3 s zoom runs reached 60.13 FPS, p95 18/17 ms, zero frames over 25 ms, and zero label/world SVG writes during motion. Pan-only stayed 50.43/50.33 FPS versus baseline 51.26/50.93 FPS; zoom-only improved from 6.7 FPS to 54.2 FPS. After every pause, 29 labels had exact 8 px clearance (error <0.000001 px), label ownership and selection passed, and screen camera alignment error stayed <0.00001 px. Pure pan preserved the CSS camera transform; settled zoom cleared it. Evidence: /tmp/groma-task462/production-iso-*.json.
Checks: bun run check exited 0; Node 16 passed, Bun 617 passed/36 skipped/0 failed. git diff --check passed. Existing lint warnings concern untouched tests.
Implementer specification review: the reported pan → zoom regression is corrected; cached panning, zoom-only, label selection and settled positions pass; the user-approved temporary scaling is documented. Quality review: gestures/animation enter move, which changes the shared CSS transform; the existing 250 ms settle timer invokes commitCamera for changed zoom, now applying label padding and sharp SVG scale together. paint still handles fresh scene labels. Pure pan does not commit or touch label geometry. This keeps ownership in the existing map renderer, adds no state/layers/dependencies, and leaves world geometry unchanged. No blocking defect or necessary additional test was found.

Final full-context complexity review: no findings. The reviewer confirmed that moving one existing operation into settled rendering is the simplest solid fix; map.ts owns camera timing, text.ts owns label geometry, and paint must retain its initialization call for newly created labels. No further deletion or architectural change was recommended.

2D verification also passed in native Safari: pan → zoom measured 60.11/60.13 FPS, with no label/world SVG writes during motion; all 29 labels restored 8 px spacing (error <0.000001 px), ownership/selection passed, and camera alignment error was <0.00002 px. The full-context reviewer reported no findings. All acceptance criteria and Definition of Done items have supporting evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hierarchy-label padding and hit areas now stay unchanged during pan and zoom. The existing camera commit restores exact eight-pixel padding and sharp SVG rendering after zoom settles; pure pan retains its cached layer. This removes the per-frame label writes introduced by TASK-402 without adding state or rendering layers.
Native Safari 27 verification of the production renderer improved pan → pause → zoom from approximately 7 FPS to 60 FPS in the same isometric scene. Iso and 2D checks confirmed unchanged label geometry during motion, correct settled padding, selection and camera alignment. bun run check passed (16 Node tests; 617 Bun tests passed, 36 skipped). Implementer reviews and the full-context complexity review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
