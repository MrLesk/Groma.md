---
id: TASK-512
title: Stop surface patterns below readable size on the web map
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 08:37'
updated_date: '2026-09-24 09:15'
labels: []
dependencies: []
references:
  - map
  - map-sharing
modified_files:
  - src/viewers/web/iso/scale.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/iso/map.ts
  - src/viewers/web/sharing/cover.ts
  - docs/viewers/web/index.md
type: bug
ordinal: 593000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex wants flow mode on the web map to be smooth. In Mobile Safari (iOS 27 simulator, 2026-09-24), switching Coding agent's flow on with the camera already at the flow held one frame for 485-691 ms. Script, style and layout took about 30 ms; the rest was Safari repainting the whole visible map, mostly the pattern fills of islands (actor dots, external crosses) and slabs (grain). With those patterns hidden the same switch took 121-139 ms. At the flow view (zoom 0.045) and at overviews these patterns repeat every fraction of a screen pixel, so they only draw a flat grey. Facade patterns already stop below readable size. Alex approved hiding island and slab patterns the same way on 2026-09-24.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In Mobile Safari, switching Coding agent's flow on with the camera already at the flow holds no frame longer than 200 ms
- [x] #2 Cover images follow the same rule as the live map
- [x] #3 Surface patterns (island dots and crosses, slab grain, group hatching) show while the dots, crosses and hatching repeat at least two screen pixels apart, such as at the Coding agent focus, and stop below that, such as at the flow view and the fitted map, where unidentified-container zones still take clicks
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
1. iso/scale.ts owns the rule beside the facade threshold: the island dots and crosses and the group hatching repeat every SURFACE_TILE (8) world pixels, and a repeat shorter than two screen pixels cannot be drawn, so surfacePatternsVisible(k) is k * 8 >= 2. style.ts takes the dot, cross and hatch tile size from the same constant; slab grain is coarser and stops with them.
2. The camera carries data-surface-patterns-hidden beside data-facades-hidden: iso/map.ts sets it when it commits a camera, sharing/cover.ts when it draws a cover. mapDrawingCss hides the island and slab .pattern polygons under it and gives group zones a transparent fill, so unidentified-container zones keep their hit area. The rules use plain selectors because covers render them with resvg, which ignores :is().
3. The web guide's pattern paragraph states the rule.
4. No new automated test: the wrong result is a Safari paint cost or a sub-pixel pattern drawn as flat grey, which the DOM-free suites cannot observe, and a threshold test would restate the formula.
5. Verify in the Mobile Safari simulator harness (flow switch at the flow view in repeated rounds; pattern and hatch states at the fitted map, the Coding agent focus and the flow view), zone clicks in Chrome, cover exports, and bun run check on HEAD plus this change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope note, 2026-09-24: the prototype of the next change (animated zoom-outs drawing their destination first) showed Safari drawing the group hatch at the flow view as a solid darker grey once it was first painted under an enlarged camera layer; the correctly drawn hatch at that zoom (tile 0.36 screen pixels) is nearly invisible. Group hatching is a surface pattern too, so it stops below the same two-pixel repeat, with a transparent fill so unidentified-container zones keep their hit area. This also makes the surface-pattern names accurate, which the end-of-task review asked for. The review's wording point (slab grain stops with the dots and crosses) is fixed in the guide and criterion.

Verification, Mobile Safari (iOS 27 simulator, local export). Switching Coding agent's flow on at the flow view: before this task 306-691 ms (five rounds across the session); island and slab patterns alone 108-147 ms (three rounds, load average up to 80); with group hatching too, no frame over 40 ms (three rounds). Pattern states read from computed styles: fitted map (zoom 0.014) patterns none and zone fill transparent; Coding agent focus (0.86) patterns inline and zone fill url(#hatch-ground); flow view (0.045) none and transparent; the settled flow view stays as sharp as its fresh-draw reference (22.29/22.31). Chrome (DevTools browser) at Fit: sampled points inside the unidentified-container zone select it (14 of 121 samples; routes and buildings drawn over it take the rest). Covers: the cover camera (zoom 0.045) carries the attribute, and all three cover PNGs are pixel-identical to the previous build because resvg already draws nothing for these tiles at that zoom; a minimal SVG showed resvg applies the plain selectors and ignores :is(), hence the plain rules. bun run check on HEAD 600a47ae plus the five files: Biome (4 existing warnings, none in these files), types, 16 Node tests, 723 Bun pass, 45 skipped, 0 fail.
End-of-task review (general-purpose agent with a written brief; the fork type is unavailable): keep the camera attribute plus CSS mechanism, keep the resvg note; fix the slab-grain wording (done); the names promised more than islands and slabs (resolved by including group hatching); open suggestions for Alex: one exported function in style.ts that returns the pattern attributes for a zoom so map.ts and cover.ts cannot drift, and later an iso/patterns.ts module owning tiles, rules, attributes and pattern CSS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Turning flow mode on no longer freezes Safari. At the flow view and overviews, the island dots and crosses, slab grain and group hatching repeat less than two screen pixels apart, so they draw only a flat grey, yet they were most of what Safari repainted when flow mode restyled the map. iso/scale.ts now owns a second readable-size rule beside the facade one; the map camera and the social cover carry data-surface-patterns-hidden, and mapDrawingCss hides those patterns under it (zones keep a transparent, clickable fill). Verified in Mobile Safari on the iOS 27 simulator: the flow switch went from 306-691 ms to no frame over 40 ms, patterns stay at the Coding agent focus and stop at the flow view and fitted map; zone clicks checked in Chrome, covers unchanged, bun run check passes.
<!-- SECTION:FINAL_SUMMARY:END -->
