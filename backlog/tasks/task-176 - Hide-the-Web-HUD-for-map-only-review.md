---
id: TASK-176
title: Hide the Web HUD for map-only review
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 21:48'
updated_date: '2026-08-26 19:47'
labels: []
dependencies: []
modified_files:
  - src/viewers/web/url.ts
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/render.ts
  - test-bun/web-url.test.ts
  - test-bun/web-shell.test.ts
priority: high
type: feature
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens the Groma Web viewer in map-only mode, Groma removes its interface chrome and overlays so the architecture map occupies the complete viewport. The normal viewer remains unchanged. This mode provides clean, matched visual evidence for evaluating the production map against the isolated libavoid experiment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening the Web viewer with the map-only entry state shows only the architecture map across the viewport, without header, hierarchy, details, work overlay, task pins, or footer chrome
- [x] #2 A user can enter and leave map-only mode without changing world geometry, selection, routes, or normal viewer behavior
- [x] #3 The map-only state is addressable by URL so the production map can be served and captured directly at http://localhost:4343
- [x] #4 Focused tests cover map-only state and camera viewport behavior, and browser QA verifies the normal and map-only views without console errors
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
1. Keep the existing shareable hud=off Web view state and full-viewport camera frame. 2. Remove the visible Map only control and its unused icon from the page. 3. Make F1 the single keyboard entry and exit for map-only mode while preserving selection, routes, world geometry, and normal viewer behavior. 4. Keep the focused URL and viewport tests, run bun run check, then verify normal -> F1 map-only -> F1 normal in the browser on port 4343.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shareable `hud=off` state, the Map only/H toggle, full-viewport camera framing, and hiding for header, hierarchy, details, Live work, and task pins. Focused Web URL, shell, camera, and live-server checks pass: 29 tests, TypeScript, and diff check.

Browser QA at 1280x720 on http://localhost:4343 verified `?hud=off` hides header, hierarchy, details, Live work, and task pins while the map SVG remains exactly 1280x720. H restored the normal HUD and removed `hud=off`; pressing H again restored map-only mode. The selected architecture id and 44 rendered buildings were unchanged across the round trip, and the console remained free of warnings/errors. Evidence: /tmp/groma-4343-map-only.png, /tmp/groma-4343-hud.png, and /tmp/groma-4343-map-only-clear.png.

Replaced the visible Map only button and the H shortcut with one hidden F1 toggle. Browser QA on http://localhost:4343/?system=groma verified no Map only/Hide HUD button, F1 -> ?system=groma&hud=off with header, hierarchy, details, work and pins hidden, and a second F1 -> the normal HUD. The same 122 buildings, 60 routes and 10 architecture surfaces remained across both transitions. Browser warnings/errors: 0. bun run check passes: 81 Node tests and 168 Bun tests; Biome reports 41 existing complexity warnings outside this change.

Cold simplicity review passed with no blocking findings. The reviewer would keep the same flow: F1 -> one toggleHud transition -> shell class, camera refit and URL sync. It found no code, concepts, indirection or tests to delete, and judged the domain split safer for junior developers than moving HUD behavior into camera key handling.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shareable map-only Web state and full-viewport camera frame. F1 is the only entry and exit; no visible map-only control remains. Verified on :4343 that F1 hides and restores all HUD regions without changing 122 buildings, 60 routes, or 10 architecture surfaces. Browser console is clean, bun run check passes, and the cold simplicity review found no blocking issue.
<!-- SECTION:FINAL_SUMMARY:END -->
