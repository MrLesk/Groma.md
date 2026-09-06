---
id: TASK-208
title: Animate closing the Web details pane
status: Done
assignee:
  - '@codex'
created_date: '2026-08-29 18:12'
updated_date: '2026-08-29 18:18'
labels: []
dependencies: []
references:
  - render
  - shell
  - motion
  - page
modified_files:
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer closes the selected item details in the Web viewer, the pane leaves through the shared chrome motion instead of disappearing abruptly, while the map and work overlay recover the released space.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing the details close button visibly animates the complete pane and its content out while the pane becomes non-interactive
- [x] #2 The map and work overlay recover the released details space through the existing Web motion timing
- [x] #3 Closing clears the selected details state and reduced-motion preferences disable the transition
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
1. Preserve the last painted details content while the shared shell hides and makes the pane inert, letting the existing opacity/translate transition move the complete pane out. 2. Rely on the next selected details paint to replace stale hidden content; add no animation state or timer. 3. Verify close timing, released layout space, cleared selection, inert/aria-hidden state, reduced motion, and focused checks; then isolate the render hunk from shared work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the no-selection clearDetails call so the hidden, inert details pane keeps its last painted content during the existing chrome exit transition. The next selection already replaces that hidden content. render.ts is now 499 lines.

Browser QA at http://127.0.0.1:4872/?component=page measured the complete pane moving from left 858.41 to 1139.16 to 1254.47 to 1280 px while opacity fell from 1 to 0; its Page heading remained painted. Work right inset moved from 433.6 to 160.83 to 48.81 to 24 px. The URL selection cleared, and the pane became inert with aria-hidden=true immediately.

Rendered reduced-motion validation found and fixed a selector-specificity bug: body.details-hidden #details now also receives transition: none. Console warnings/errors were empty and no framework overlay appeared.

Focused navigation/page/shell tests pass (12 tests). The first full check had two concurrent watcher timeouts; both exact tests passed alone, and the clean rerun passed lint, TypeScript, 81 core tests, and 193 viewer tests.

Cold simplicity review passed with no blockers or follow-ups. The reviewer confirmed that preserving hidden inert DOM is simpler and safer than timers or transitionend state; clearDetails remains required by live-work updates. Selection owns open state, shell owns visibility/accessibility, renderer owns content, and page CSS owns motion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closing details now preserves the painted content while the existing pane fade/slide runs, then leaves the pane hidden, inert, and aria-hidden with selection cleared. Work releases its right inset through the same motion timing. Added the hidden-pane selector to the reduced-motion guard. Browser frame measurements verified the complete exit and space recovery with a clean console; focused tests and the full check pass with 81 core and 193 viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
