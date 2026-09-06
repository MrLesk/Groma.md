---
id: TASK-181
title: Toggle a Web FPS counter with F3
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 19:45'
updated_date: '2026-08-26 20:19'
labels: []
dependencies:
  - TASK-176
references:
  - shell
  - render
  - page
  - fps
modified_files:
  - src/viewers/web/chrome/fps.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/web-fps.test.ts
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/web-viewer/components/fps.md
type: feature
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect checks the Web viewer performance, F3 toggles a live frames-per-second counter over the map. The counter is independent of the F1 HUD state, so it remains visible in map-only mode and does not change the architecture map or camera.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing F3 shows a live FPS counter, and pressing F3 again removes it
- [x] #2 The FPS counter remains visible while F1 hides or restores the HUD, and either key can be used in either order
- [x] #3 Showing the counter does not reserve layout space or change map geometry, selection, routes, or camera state
- [x] #4 Focused checks cover FPS sampling and the independent F1 and F3 states, and browser QA verifies all four HUD and FPS combinations without console errors
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
1. src/viewers/web/chrome/fps.ts: own one fixed FPS overlay, the frame sample calculation, and a requestAnimationFrame loop that runs only while the counter is visible. Keep its CSS beside the component; normal HUD mode places it in the map safe area and map-only mode moves it to the viewport corner.
2. src/viewers/web/render.ts and src/viewers/web/page.ts: create the counter once, let F3 toggle it independently beside the existing F1 branch, include its CSS, and list F3 in Help. Do not add FPS to URL, shell, camera, selection, or world state.
3. test-bun/web-fps.test.ts and docs/viewers/web/index.md: cover the sampling calculation and document F1/F3 as independent viewer controls.
4. Run the focused FPS test and bun run check, then verify normal HUD/FPS off, normal HUD/FPS on, map-only/FPS on, and map-only/FPS off in the browser with unchanged map counts and no console warnings or errors.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-176 owner confirmed its uncommitted F1 HUD implementation is stable for TASK-181 to build on and will coordinate before further edits to overlapping files.

Implemented the FPS overlay as an independent Web chrome component. F3 starts or stops its requestAnimationFrame sampler; F1 remains the only HUD transition and the FPS overlay is not part of URL, camera, selection, or world state.

Verification: bun test test-bun/web-fps.test.ts passed. Browser QA at 1280x720 passed all four HUD/FPS combinations in both key orders; the live sample rendered, the SVG geometry fingerprint and selected item stayed unchanged across F3, and the console had no warnings or errors. bun run check reached 171 passing viewer tests with one unrelated live-reload timeout; rerunning that exact test passed in 267 ms.

Cold simplicity review found no blocking issue. Accepted its only deletion: removed the one-use FpsCounter interface and kept the factory return type inferred.

Direct live-architecture validation found the scanner-created fps component without lead prose. Added its meaning through the supported `groma edit fps --description` command, not by editing groma/ manually.

Context-aware architecture review confirmed the domain boundary and recommended two final reductions. Removed the redundant FPS hidden rule because the native hidden attribute already owns that behavior.

Moved the F1/F3 documentation after the complete pan sentence so the controls section reads cleanly without changing TASK-180's building-floor section.

Final verification after the context-aware cleanup: focused Web tests passed (13 passed, 0 failed), bun run typecheck passed, git diff --check passed, and bun run check passed with 81 Node tests and 172 Bun tests. Browser QA evidence remains valid because the cleanup only removed a redundant hidden CSS rule and repaired documentation paragraph order.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an independent F3 FPS overlay in the Web chrome domain. It samples only while visible, stays on screen when F1 hides the HUD, and does not affect map geometry, selection, routes, camera, URL, or world state. Verified with 13 focused Web tests, typecheck, full bun run check (81 Node and 172 Bun tests), and browser QA across all four F1/F3 states with stable map geometry and a clean console.
<!-- SECTION:FINAL_SUMMARY:END -->
