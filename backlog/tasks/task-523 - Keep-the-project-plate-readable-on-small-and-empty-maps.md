---
id: TASK-523
title: Keep the project plate readable on small and empty maps
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 16:26'
updated_date: '2026-09-24 17:03'
labels: []
dependencies: []
references:
  - iso-project
  - shell
  - render
  - presentation
modified_files:
  - test-bun/iso-map.test.ts
  - src/viewers/web/iso/projection/blueprint.ts
  - test-bun/web-shell.test.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/chrome/empty.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
  - src/viewers/web/iso/view-motion/morph.ts
type: bug
ordinal: 607000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On a new project with nothing scanned, the web map's title plate splits the project name into two-letter lines (Em / pt / y ...) and the overview into three-letter ones, and the plate stretches the frame into a long strip. The plate is capped at the sheet's width, and an empty world's sheet is an 8-cell placeholder while a short title already needs about 42 cells. The same cap breaks overview words on small maps: with one actor the overview reads 'Architectur / e for Empty'. The web guide already says the plate grows to fit its text, up to 80-character lines. On an empty map the welcome card also covers the plate, because the card and the camera fit share the same clear area. Alex chose to keep the plate on empty maps and fit the map into the space the card leaves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On any map, including an empty one, the title plate keeps whole words and its lines up to 80 characters; the frame widens to hold the plate beside the compass instead of the plate shrinking to the sheet
- [x] #2 On an empty current map the camera fits the sheet and its plate into the space below the welcome card, so the card covers no part of the plate
- [x] #3 When the welcome card appears or disappears with a world update, the camera fits the new clear area rather than the previous one
- [x] #4 The web guide describes the widened frame and the empty-map fit; browser checks of an empty and a one-actor map and bun run check pass
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
1. Map projection (iso/projection/blueprint.ts): the plate takes its natural width (its lines up to 80 characters) instead of min(sheet width, natural width). When the plate is wider than the sheet, the frame west edge moves to the plate west edge minus twice the compass inset, so the compass stays centred between the frame edge and the plate. The compass inset becomes one shared helper for the compass and the frame.
2. Map controls (chrome/empty.ts): welcomeCard(host) returns the full welcome card box while it stands over an empty map; the compact notice and a hidden card return nothing.
3. Map controls (chrome/shell.ts): pageHosts gains the empty host; mapFrame takes the optional welcome card and starts the camera frame 12 px below it, with the HUD shown or hidden.
4. Browser session (render.ts): the empty state uses hosts.emptyHost, and applyWorld paints it before measuring the frame, so a card that appears or disappears with a world update is measured in its new state. Startup keeps the server-rendered card state.
5. Web guide: the widened frame in the plate paragraph and the empty-map fit in Layout.
6. Tests. (a) iso-map.test.ts, one regression test on an empty world. Authority: the web guide (the plate grows to fit its text, lines up to 80 characters) and the reproduced failure. Wrong result caught: the title split into Em / pt / y, or the plate outside the frame or over the compass. Gap: the existing plate and compass tests use the wide viewer fixture, where the cap never binds. (b) web-shell.test.ts, one test that the welcome card moves the camera frame below it in both HUD modes. Authority: Alex chose to fit the empty map into the space the card leaves. Wrong result caught: the map fitted under the card. Gap: mapFrame tests cover only the panes. The update ordering in render.ts is DOM sequencing inside the orchestrator with no harness; it is verified in the browser (empty, one actor, empty again).
7. Verify empty and one-actor maps plus both transitions in the browser, then run bun run check.

8. Subtraction on this path: fitScene becomes a one-line arrow beside viewport, and the morph.ts comment no longer claims the plate rewraps. The empty-frame special case in morph.ts stays, pinned by its test, until Alex decides whether an appearing map should grow out of the empty frame.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause: projectPlate capped the plate at the sheet width, and an empty world gets an 8x8-cell placeholder sheet (sheet/place.ts), so the title wrapped every two letters. The plate now takes its natural width, and projectBlueprint moves the frame west edge to the plate west edge minus twice the compass inset, so the compass stays centred between the frame edge and the plate. compassInset is shared by the compass and the frame.

Empty-map fit: welcomeCard (chrome/empty.ts) returns the full welcome card box and nothing for the compact notice or a hidden card. mapFrame (chrome/shell.ts) starts the camera frame 12 px below that box with the HUD shown or hidden, and measureFrame reads it through pageHosts().emptyHost.

Ordering: render.ts paints the empty state before every fit that follows a world change: at startup before the first fit, and in applyWorld before measuring. paintWorld no longer paints it. Correction: the first version relied on the server-rendered card at startup. revisionControl.live is false for published delivery, so the client startup paint hides the page notice in exports; without it the notice stayed visible. The startup paint was restored, now before the first fit.

Verification: the regression test failed before the fix with Em / pt / y / pr / oj / ec / t and passes after. The web-shell test covers the card in both HUD modes. In the browser at 1440x900: an empty map puts the card bottom at 581 and the frame at 617-864; adding one actor hides the card and refits to 229-733 with whole plate lines; removing it returns the frame below the card; map-only mode keeps the frame below the card; a published export keeps the notice hidden and the plate whole. bun run check in a detached worktree at HEAD plus this diff: Biome no errors (3 warnings in untouched files), tsc clean, Node 16/16, Bun 736 pass, 45 skip, 0 fail. The shared tree currently fails tsc in three scanner test files owned by another in-flight change, unrelated to these files.

End-of-task review: the fork agent type was unavailable, so a general-purpose reviewer received a written brief of the conversation, not the transcript. It kept the approach and recommended rewording the morph.ts comment: an appearing map keeps its own frame because a frame blended from the empty placeholder would leave its surfaces outside it and under the plate (its throwaway script measured both). Alex approved that rewording; the special case and its test stay. Deferred by the review, not in this task: moving mapFrame and measureFrame into their own chrome file, and splitting render.ts (499 lines) the next time it grows. Final check of the exact commit on main 0371b601 in a detached worktree: Biome no errors (3 warnings in untouched files), tsc clean, Node 16/16, Bun 736 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web map title plate now keeps its natural width (whole lines up to 80 characters) on every map: when the sheet is narrower than the plate, as on an empty or one-actor map, the frame widens west and the compass stays centred between the frame edge and the plate. On an empty map the camera fits the sheet and plate into the space below the welcome card, and the card is painted before any fit after a world change, so the first element refits to the whole clear area and an emptied map returns below the card. Verified by a regression test that failed before the fix, a camera-frame test, browser checks of empty and one-actor maps, both transitions, map-only mode and a published export, and bun run check on the exact commit.
<!-- SECTION:FINAL_SUMMARY:END -->
