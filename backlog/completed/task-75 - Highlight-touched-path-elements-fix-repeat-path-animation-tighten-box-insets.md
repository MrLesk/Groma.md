---
id: TASK-75
title: 'Highlight touched path elements, fix repeat path animation, tighten box insets'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 06:03'
updated_date: '2026-08-17 06:08'
labels: []
dependencies: []
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web viewer follow-up to TASK-74 from user feedback. First, an active person-command path dims the rest but does not mark the boxes it touches; outline the elements the lit routes connect in the accent green. Second, the path animation often freezes after a re-activation: the first requestAnimationFrame timestamp can be earlier than the performance.now() captured at build, the negative elapsed time makes the modulo distance negative, the segment lookup indexes points[-1], and the uncaught TypeError kills the animation loop (reproduced in the browser console). Third, the uppercase name labels on parent slabs and group zones are drawn almost touching the top-left border; give them a clear inset.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While a person command is active, every element a lit route connects is outlined in the accent green in the city
- [x] #2 Re-activating a command after clearing it animates again, every time, with no uncaught errors in the browser console
- [x] #3 bun test passes
- [x] #4 Slab and zone name labels sit clearly inset from their box borders instead of touching the top-left corner
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
1. Fix the flow timebase in render.ts: initialize flowStart from the first requestAnimationFrame timestamp instead of performance.now() so elapsed time can never go negative.
2. In paintOutlines, outline elements whose representationId is a source or target of a lit route in the accent color.
3. Inset the start-aligned labels in atoms/label.ts by about 2.5 world units from the top-left border (slabs and zones share drawName).
4. Verify in the browser: repeated activate/clear cycles animate with a clean console, touched boxes glow green, labels sit off the border; bunx tsc and bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause of the frozen animation confirmed by browser instrumentation: after re-activation the requestAnimationFrame callback fired exactly once and never re-requested; the console showed 'Uncaught TypeError: Cannot read properties of undefined (reading x)'. The first frame timestamp preceded the performance.now() taken at build, elapsed time went negative, the modulo distance went negative, findIndex returned 0, and points[-1] crashed stepFlow. Fixed by anchoring flowStart to the first frame timestamp. Verified with four activate/clear cycles: the loop then ran 61 frames per 500ms with a clean console. Touched-element outlines: paintOutlines collects source/target of lit relationships (deliberately not elementOnPath, which includes ancestors); screenshots show the person, Cli, and Accept rimmed in accent green. Label inset: drawName start-aligned labels moved from a fixed 6px to 2.5 world units; verified at 305% zoom on CLI / TERMINAL VIEWER / WEB VIEWER. Cold simplicity review returned no accept-worthy findings; its optional comment-wording nit applied. bunx tsc clean, bun test 143 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the one-shot path animation (flowStart now anchors to the first requestAnimationFrame timestamp so elapsed time never goes negative and the dot lookup cannot crash), outlined every element a lit route touches in accent green via a touched endpoint set in paintOutlines, and inset slab and zone name labels 2.5 world units from the border in drawName. Verified in the browser with repeated activate/clear cycles (steady 60fps loop, clean console), screenshots of touched outlines and label insets at fit and 305% zoom, bunx tsc, and bun test (143 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
