---
id: TASK-200
title: Give the web interface a coherent motion system
status: Done
assignee:
  - '@codex'
created_date: '2026-08-27 20:25'
updated_date: '2026-08-28 06:27'
labels: []
dependencies: []
references:
  - work-overlay
  - shell
  - page
  - render
  - motion
modified_files:
  - src/viewers/web/work/island.ts
  - src/viewers/web/chrome/motion.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - groma/observed/systems/groma/containers/web-viewer/components/motion.md
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer uses the web architecture view, hierarchy, task, details, theme, fit, and zoom state changes animate with one restrained motion language. Pane content remains at its final readable size, and pane motion does not recalculate page layout on every frame. The approved example is the current web view: side panes slide at constant width, disclosure chevrons rotate, theme fades through its surface colour, and fit and zoom controls give brief semantic feedback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening and closing the hierarchy pane slides its constant-width surface while its persistent disclosure icon rotates
- [x] #2 Opening and closing the details pane slides its constant-width surface without scaling or rewrapping its text during the transition
- [x] #3 The task island disclosure icon visibly rotates and its expansion does not scale task text
- [x] #4 Changing theme uses a short fade without animating page layout
- [x] #5 Fit and zoom actions animate their existing icons with brief semantic feedback
- [x] #6 Chrome motion avoids animating grid tracks, width, height, padding, and font size, and honors reduced-motion preferences
- [x] #7 The supported web interactions pass focused browser verification and bun run check
- [x] #8 The task strip never scrolls vertically; it fits one task row while keeping horizontal overflow for additional tasks
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
1. Start from the completed TASK-192 and TASK-199 web shell, preserving revision behavior and the details source drill-down.
2. Give hierarchy and details constant geometry and animate only compositor-friendly visibility, with one persistent rotating hierarchy disclosure and a logical safe camera frame.
3. Add the smallest shared chrome-motion operations needed for the theme fade and fit/zoom feedback, including keyboard activation and reduced-motion behavior.
4. Refactor the task island fold change so its chevron survives the state change, its final-size text is revealed without width, height, or scale animation, and its one-row strip never scrolls vertically.
5. Update the owning Web architecture record, verify the current 1280x720 shell and 640px source-detail mode in the browser, run bun run check, then complete simplicity, specification, quality, full-context complexity, and finalization reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context: L2 cross-module UI and performance change. Reuse the revision control’s persistent rotating chevron. Do not edit page.ts or render.ts until TASK-192 and TASK-199 have completed their overlapping shared-main work; preserve source mode and revision state.

Implemented the isolated work-overlay slice: the fold button is now persistent, its chevron rotates through the state change, and the content swaps behind a clip/opacity reveal instead of animating width and height. Focused browser proof showed the island expand from 101px to 476.8px with aria-expanded=true and the icon at rotate(180deg); the browser bundle test passes.

First repository check attempt compiled successfully and ran the suites, but the existing concurrent CLI watch test `groma scan --watch folds a settled TypeScript change and does not open a viewer` timed out with empty stdout. This task did not touch that flow; rerun the full check after shared web tasks settle.

Implemented the shared shell and control slice after TASK-199 confirmed its hunks were stable: hierarchy and details now keep fixed grid geometry and animate through transform/opacity; the hierarchy uses one rotating SVG; theme fades through paper; fit and zoom use brief icon feedback for mouse and keyboard. Source mode remains 640px with Back and the close button hidden. Browser measurements at 1280x720: the details surface stayed 409.6px wide while moving from x=858.4 to x=1280, grid columns remained 345.6/476.8/409.6px, and body transition duration was 0s. The task island exposed an intermediate rotated chevron before settling at 180 degrees. Browser logs were empty. Full bun run check passed with 81 Node and 189 Bun tests.

Simplicity fixes: the work chevron now disables its transition for reduced motion, its Backlog mark selector follows the persistent content wrapper, and the fold state names describe revisions and animations directly. The pane shell no longer uses an animating or width-reserving grid: header, hierarchy, and details are fixed-position chrome with stable final widths, while hierarchy and details move only by transform.

Final browser QA at 1280x720: body scroll width remained 1280; hierarchy remained 345.59 px wide while sliding left and rotating one persistent chevron; details remained 409.59 px wide while sliding fully off-screen; source details remained exactly 640 px wide with 59 numbered lines and Back visible; the task island changed from 101 px to 476.80 px with content transform none and its persistent chevron rotated; theme completed on dark with fade opacity 0; browser error log was empty.

Final review found and reproduced one task-island fill-mode defect: the completed cover animation kept clipping the revealed island. The cover is now cancelled before reveal. Fresh 1280x720 browser proof after 1.1 seconds: open is 476.80 px, opacity 1, clip-path none, final-scale content and a 180 degree chevron; close is 101 px, opacity 1, clip-path none; browser errors empty.

Alex required the task strip to avoid a vertical scrollbar. Browser measurement before the fix showed overflow-y auto with clientHeight 37 and scrollHeight 43. The strip now clips the vertical axis and is 54 px tall: clientHeight and scrollHeight are both 43, horizontal overflow remains 794 px across a 52 px viewport, and browser errors are empty.

Final gates passed: the cold simplicity review and its targeted re-review passed; specification and quality reviews passed after the task-island fill fix; the task-strip delta reviews passed; the full-context complexity review found no blocker and recommended keeping the domain split as-is. Its only optional follow-up is to extract one complete interaction domain from render.ts when the next related feature needs space. Final bun run check passed with 81 Node and 189 Bun tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added one restrained Web motion system: constant-width hierarchy and details panes slide by transform, persistent chevrons rotate, theme changes fade through paper, and fit/zoom icons respond for mouse and keyboard. Refactored the task island to reveal final-scale content, cancel interrupted/fill animations safely, and fit one task row without vertical scrolling. Browser QA verified stable pane widths, the 640px source pane, clean open/close task states, no vertical task overflow, and an empty error log; bun run check passed 81 Node and 189 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
