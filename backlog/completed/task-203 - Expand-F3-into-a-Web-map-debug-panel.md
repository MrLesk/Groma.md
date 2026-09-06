---
id: TASK-203
title: Expand F3 into a Web map debug panel
status: Done
assignee:
  - '@codex'
created_date: '2026-08-28 20:25'
updated_date: '2026-08-30 15:07'
labels: []
dependencies:
  - TASK-181
references:
  - sheet
  - web-server
  - render
  - page
  - work-overlay
  - map-debug
modified_files:
  - src/sheet/scene.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/server.ts
  - src/viewers/web/chrome/fps.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - test-bun/web-fps.test.ts
  - test-bun/web-page.test.ts
  - test-bun/web-live.test.ts
  - docs/viewers/web/index.md
  - groma/observed/systems/groma/containers/web-viewer/components/fps.md
  - src/viewers/web/work/island.ts
  - src/viewers/web/chrome/map-debug.ts
  - test-bun/web-map-debug.test.ts
  - groma/observed/systems/groma/containers/web-viewer/components/map-debug.md
type: enhancement
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect presses F3 in the Web viewer, Groma shows one compact debug panel that explains both live rendering performance and the immutable map generation. It expands the existing FPS overlay without changing map geometry, camera, selection, routing, or URL state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 F3 toggles one debug panel containing live FPS and server timings for architecture loading, building placement, arrow routing, and total map composition
- [x] #2 The panel shows browser projection and SVG paint timings plus map counts for elements, relationships, buildings, routes, route points, surfaces, and sheet cells
- [x] #3 Diagnostics belong to the exact current map generation and update after a live world or revision change without triggering another placement, routing, projection, or paint pass
- [x] #4 The panel remains independent of F1 map-only mode and F2 layer mode and introduces no map geometry or camera changes
- [x] #5 Focused tests cover timing composition, panel formatting/state, and payload refresh; browser QA verifies the panel, refresh behavior, stable map geometry, and a clean console
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
1. Measure placement and routing around the existing sheet composition, and measure total map composition around the server load. 2. Carry architecture load, placement, routing, and total timings with each exact Web map generation. 3. Expand the existing FPS chrome atom into one compact debug panel whose static snapshot comes from current payload data and whose animation loop runs only while visible. 4. Wrap only existing browser projection and SVG paint calls, then update formatted diagnostics without adding map work. 5. Cover snapshot derivation, formatting, generation refresh, and live payload refresh; document the behavior; run the repository check, browser QA, and required reviews.

6. Define one theme-aware persistent chrome surface, apply it to the F3 panel and Live work island, audit higher-emphasis overlay surfaces separately, and verify all themes in Browser.

7. Rename the completed FPS domain to Map debug across its source module, DOM owner, focused test, architecture element, imports, and task reference; then rerun focused and repository checks.

8. Replace the raw floating-point Sheet display with separate rounded size and cell-count rows, verify the rendered panel does not overflow, and amend the unpushed task commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a measured sheet-composition entry point while preserving sheetScene for existing callers. Placement ends immediately after placeWorld; routing includes endpoint preparation and routeAll. The Web server independently measures total map composition around the architecture/project load and sheet composition.

The Web server profiles each exact boot, live, or historical map generation. Architecture and project reads remain parallel. Project-only saves reuse the existing immutable timing snapshot because they do not rebuild the world or sheet.

Expanded the existing FPS atom in place into one Map debug panel. Its static snapshot is derived from existing payload data, while its requestAnimationFrame loop runs only while visible. The panel is pointer-transparent and remains fixed chrome outside the SVG camera.

Browser timings wrap only existing projectScene/sceneAtSeparation and map.paint calls. The panel updates after paint from the current generation, timing snapshot, world, and sheet; F3 does not call either measured operation.

Cold simplicity review found missing focused evidence for formatted values and refreshed timing payloads, plus an unused sheet-total timing. Removed that field, collapsed display formatting into mapDebugValues, added formatting/generation tests, and added live-generation timing assertions. The targeted re-review passed with no regression.

The complete repository check passes: 193 tests, lint, and TypeScript. Two first runs exposed existing concurrent watcher/live-reload timeouts; each exact test passed alone and the complete check then passed cleanly.

Browser QA on the current Groma map at port 4848: F3 toggles the panel without changing generation or server timings; FPS reaches 60; all requested timings and counts render; the panel remains visible across F1/F2 and historical/current map changes; SVG geometry remains unchanged; console errors and warnings are empty. The latest visual build is open for human approval.

Surface consistency correction: the F3 panel had copied a fixed 72% paper mix, while persistent chrome used 35% in Light/Dark and 78% in Blueprint. Added one theme-aware --chrome-surface token in page.ts and made the page panels, F3 panel, and Live work island consume it. The audit found one other accidental persistent-panel mismatch: Live work remained 35% in Blueprint. Help, revision, and project-editor surfaces are higher-emphasis overlays and intentionally keep separate opacity. Browser QA on an isolated server verified exact computed matches for header, hierarchy, details, F3, and Live work in Light/Dark (35%) and Blueprint (78%); F3 toggles off/on and console logs are empty. Focused Web tests pass 13/13. The complete bun run check passes: lint, TypeScript, 81 Node tests, and 177 Bun/viewer tests. Cold simplicity and full-context complexity reviews found no blocking or optional implementation changes; both recommend the shared token as the simplest defensive design. A possible chrome/fps.ts rename was judged non-blocking churn and not applied.

Correction after human review: the earlier recommendation to leave chrome/fps.ts unchanged was rejected, and the domain rename was applied completely. The source module/export/DOM owner, focused test, architecture component, imports, task reference, and recorded paths now use Map debug; FPS remains only the name of the frame-rate metric inside that domain. Browser QA verified F3 opens #map-debug, no #fps owner remains, its surface still matches the header, and the console is empty. Focused Web verification passes 13/13. Lint, TypeScript, and all 81 Node tests pass in the full check; the combined viewer run remains affected by unrelated shared filesystem-watcher timeouts, while the same Web live tests pass in the focused suite. The targeted full-context re-review found the rename complete, easier for junior developers to discover, and free of blocking regressions or unnecessary churn.

The unrelated work watcher that timed out only in the combined shared run also passes alone: 9/9 in test-bun/work.test.ts; web-live already passes 9/9 inside the 13-test focused Web run.

Human screenshot review found that the Sheet row exposed the raw product of fractional scene dimensions as 26601.030399999996 and overflowed the debug panel. Reopened the task before push; acceptance criterion 2 and verification DoD items are pending the correction.

Corrected the screenshot-reported Sheet overflow at the display boundary: the immutable snapshot keeps exact fractional dimensions and area, while the panel shows Sheet as one-decimal width × depth and Cells as a separate rounded count. Browser QA rendered 167.3 × 159.0 and 26601 fully inside the 224px panel with an empty console. The fractional focused test and complete bun run check pass: 81 Node tests and 177 viewer tests. Final targeted complexity review found no blocking or non-blocking simplification.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-30 14:00
---
TASK-214 will change only the kindGlyph/kindLabel import in src/viewers/web/page.ts to the new shared owner src/viewers/atoms/kind.ts. Its map-debug implementation hunk remains untouched.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded F3 into one Map debug panel with exact-generation server timings, browser timings, map counts, and live FPS. Unified persistent chrome opacity through one theme-aware surface token, renamed the complete domain from FPS to Map debug, and kept raw fractional sheet values out of the UI through separate formatted Sheet and Cells rows. Verified with Browser interaction, computed bounds and styles, an empty console, focused fractional formatting tests, lint, TypeScript, 81 Node tests, and 177 viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
