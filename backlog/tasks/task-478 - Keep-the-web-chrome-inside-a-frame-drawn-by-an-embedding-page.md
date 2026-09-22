---
id: TASK-478
title: Keep the web chrome inside a frame drawn by an embedding page
status: Done
assignee:
  - '@claude'
created_date: '2026-09-21 20:50'
updated_date: '2026-09-22 22:19'
labels: []
dependencies: []
references:
  - web-page
  - island
  - shell
modified_files:
  - src/viewers/web/page.ts
  - test-bun/web-page-inset.test.ts
  - docs/viewers/web/index.md
  - src/viewers/web/work/island.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/chrome/shell.ts
ordinal: 554000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex embeds the live web map in his slides. The slide draws its own frame a few pixels inside its edge, and the map's header, hierarchy, details, tools and work island sit on top of that frame because they are placed from the window edge. He wants the map itself to keep filling the window to its edge while the chrome stays inside the slide's frame lines. The embedding page cannot restyle the iframe, because it is another origin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening the web map with inset=<pixels> moves the header, hierarchy, details, map tools, view switch and work island that many pixels in from every window edge
- [x] #2 The map still fills the whole window, and the camera still fits selections into the space left between the chrome
- [x] #3 Without the parameter, or with a value that is not a positive whole number of pixels, the page is laid out exactly as before
- [x] #4 The web viewer guide documents the parameter next to the embedding message
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
1. page.ts: place the body with margin and height from a --chrome-inset variable (0px by default). The chrome is positioned from the body and the map is fixed to the window, so only the chrome moves.
2. Chrome placed from the window rather than the body adds the inset itself: the work island inside the map, the fixed first-scan notice, the details dock where it is fixed at 1024px and below, and details widths taken from the window (--chrome-width, the window width less the inset on both sides).
3. renderPage reads inset from the request URL and writes the variable on the body only for a positive whole number.
4. Test renderPage with and without usable values, and measure the layout in a browser against unchanged main.
5. Document the parameter next to the embedding message.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/viewers/web/page.ts: the body takes its margin and height from --chrome-inset, and renderPage writes that variable on the body only for a positive whole-number inset. The map stays fixed to the window, so it still fills it. The camera needed no change: mapFrame measures the header and panes where they really are.

Correction during finalization: a browser measurement showed that chrome placed from the window instead of the body ignored the inset. That was the work island (it lives inside the map), the fixed first-scan notice, the details dock at 1024px and below (fixed there), and details widths computed from 100vw, which let an opened source file overlap the hierarchy by twice the inset. Each now adds the inset itself: the island and the shared bar rule through --window-inset (island.ts, page.ts), the notice in empty.ts, and the dock and widths in shell.ts through --chrome-width. The map editing toolbar is hidden in this build (display: none), so it has no position to check. The vertical C4 filter bar is placed from the body and moves with it.

Verification with Playwright on the orders demo, at 1280x720 and 1000x700, with inset=37 and against unchanged main 0ad06447. The header, hierarchy, details, view switch, C4 filter and work island each sit exactly 37px further in. The nearest chrome edge is 47px from the window (the header's usual 10px plus 37). The map element still spans the whole window. The fitted map lies inside the frame computed from the chrome's real positions, both with nothing selected and with the system selected. An opened source file keeps its 12px gap from the hierarchy. The first-scan notice keeps its 10px gap below the view switch. Without the parameter every measured rectangle equals unchanged main: wide, wide with a file open, narrow with the system selected, narrow with a file open, and a first scan. test-bun/web-page-inset.test.ts covers the body tag for 32 and for a missing, 0, -8, 1.5 and non-numeric value.

Shared files: page.ts also carries uncommitted header CSS from TASK-480.1, and docs/viewers/web/index.md carries other sessions' paragraphs. This task's commit stages only its own hunks there: in page.ts the body rule, the shared bar rule and chromeInset; in the guide the inset paragraph.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-21 21:13
---
TASK-479 coordination: I am changing iso/map.ts, iso/style.ts and only the component/flow glow paragraphs in docs/viewers/web/index.md. Your recorded code files and inset documentation stay untouched. I will stage only TASK-479 hunks; please preserve its glow paragraphs in the shared guide.
---

author: @claude
created: 2026-09-22 20:29
---
TASK-484 coordination (touch pinch): I change only the Map rows inside helpControl in src/viewers/web/page.ts and the gesture sentence under What you can do in docs/viewers/web/index.md. Your chromeInset and style hunks stay untouched. Please stage only TASK-478 hunks in those files.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An embedding page can now open the web map with inset=<pixels>. The body takes that margin, so the header, panes, view switch, filters, work island and first-scan notice stay inside the page's own frame, while the map still fills the window and the camera fits selections into the space the chrome leaves. Chrome placed from the window rather than the body (the work island in the map, the fixed notice, the details dock at 1024px and below, and window-sized details widths) adds the inset itself. Verified with Playwright on the orders demo at 1280x720 and 1000x700: with inset=37 every piece of chrome moves exactly 37px in and the fit stays inside the frame, and without the parameter every measured rectangle matches unchanged main. A unit test covers the body tag for usable and unusable values. bun run check on a clean clone of main plus only this task's hunks: 687 pass, 43 skip, 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
