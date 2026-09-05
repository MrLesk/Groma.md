---
id: TASK-251
title: Keep Safari map movement smooth on a 60 Hz display
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:06'
updated_date: '2026-09-05 16:19'
labels: []
dependencies: []
references:
  - iso-map
  - iso-camera
modified_files:
  - src/viewers/web/iso/map.ts
type: bug
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect pans or zooms the current Groma Web map in Safari on a 60 Hz external display, movement should remain smooth like the same map in Chrome. Alex reports substantial Safari slowdown while Chrome stays at 60 FPS. Diagnose the actual camera path and fix the demonstrated rendering cost.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repeated pan and zoom through actual camera handlers in Safari demonstrate improved frame pacing against the unchanged baseline on the current map.
- [x] #2 The complete map remains visible; camera anchoring, selection, geometry, and settled sharpness are preserved.
- [x] #3 Relevant focused checks, browser verification, required reviews, and bun run check pass.
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
1. Keep the current temporary HTML motion layer and settled SVG camera. 2. Increase the quiet-input interval from 80 ms to 250 ms so short trackpad gaps do not repeatedly rebuild and demote the map. 3. Compare burst pan and zoom in Safari, verify continuous movement and settled cleanup, run focused and repository checks, and complete the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Actual Safari wheel-handler A/B on the same 79-element map, Inspector closed: 240-frame burst pan with an input every six frames. At 80 ms, two runs made 41 SVG camera commits each, ran at 26.61 and 25.74 FPS, and had p95 frame times 69 and 73 ms. At 250 ms, two runs made one final commit each, ran at 58.31 and 57.90 FPS, and had p95 18 ms. All runs restored the idle HTML transform to empty. Continuous input and removing grid or blur did not reproduce or resolve this repeated-commit cost. The two browsers are on 60 Hz external monitors, as Alex confirmed.

Final built preview on localhost:4751, with no timer override: burst pan 58.07 FPS, burst zoom 58.59 FPS, continuous pan 58.61 FPS, continuous zoom 58.56 FPS. Each run had one final SVG camera commit, median 17 ms and p95 18 ms. Map markup and node identities stayed unchanged, and reverse gestures returned to the exact initial camera. Temporary transform and will-change were empty at idle; no injected styles remained. Individual startup frames still reached 69–116 ms, so this fixes the repeated mid-gesture stalls rather than claiming every frame meets 60 Hz. Safari selection/details, zoom controls, fit, and a settled 477 percent screenshot passed. Cold simplicity review passed without findings. Implementer specification review confirms the measured improvement and preserved camera/map semantics; quality review found no blocking defect in the constant-only lifecycle change. No new behavior or abstraction was introduced. The full bun run check passed outside the sandbox: lint/typecheck, 104 Node tests and 294 Bun tests. Initial sandbox check failed in the unrelated filesystem watcher with EMFILE.

Final full-context complexity review passed with no blocking findings or material architecture recommendations. It confirms that the existing camera lifecycle owns the timing, CAMERA_SETTLE_MS names both pan and zoom correctly, and no abstraction, component split, or new test is needed. The intentional tradeoff is 170 ms longer before the settled SVG commit.

Alex visually approved the Safari result and authorized committing and pushing the task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented repeated Safari SVG camera commits during short trackpad pauses by increasing the shared pan/zoom settle interval from 80 to 250 ms. Reproduced the original slowdown at about 26 FPS; the built fix measures 58–59 FPS for burst and continuous movement with p95 frame time 18 ms, unchanged map content and camera geometry, and correct idle cleanup. Focused checks, 104 Node tests, 294 Bun tests, browser interaction checks, and both required reviews pass. Occasional startup frame pauses remain; this change addresses the demonstrated repeated mid-gesture stalls.
<!-- SECTION:FINAL_SUMMARY:END -->
