---
id: TASK-126
title: >-
  Show the task title on hover over chips and pins, and lighten the island's
  glass
status: Done
assignee:
  - '@claude'
created_date: '2026-08-23 12:33'
updated_date: '2026-08-23 12:52'
labels: []
dependencies: []
references:
  - render
  - iso-map
modified_files:
  - src/viewers/web/organisms/tip.ts
  - src/viewers/web/organisms/pins.ts
  - src/viewers/web/organisms/work-island.ts
  - src/viewers/web/render.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hovering a chip in the Live work island should show a hover state with the task's whole title, the way a pin does; both use one tooltip bubble drawn over the map, because the strip clips anything drawn inside it. The island's paper goes from 55% to 40% so more of the map shows through.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering a chip or a pin head shows a tooltip with the assignee and the whole task title above it, drawn outside the strip so it is never clipped; leaving hides it
- [x] #2 A hovered chip shows a hover state
- [x] #3 The island's paper is 40% opaque over the blur
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
1. src/viewers/web/organisms/tip.ts: createTip(host) returns show(anchor, text) and hide(); one div in the map host placed above the anchor.
2. pins.ts and work-island.ts take the tip; pin heads and chips show it on mouseenter and hide it on mouseleave, replacing the native title attributes; a chip hover style in the island CSS; the island background at 40% paper.
3. docs/viewers/web/index.md: the tooltip sentence.
4. Browser: dispatch mouseenter on a chip and on a pin head, read the tip's text and position; mouseleave hides; computed background alpha 0.4.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser evidence: mouseenter on a chip showed #tip with '@scan · <title>' 6 px above the chip, centred on it, z-index 1; mouseleave hid it; mouseenter on a pin head showed 'TASK-40 · <title>' 6 px above the head; no native title attributes remain on heads or chips; the #work .chip:hover rule is present; the island background computes to color(srgb 1 1 1 / 0.4). bun run check green.

Post-review: the tip exposes one attach(node) (show and hide are private), the redundant [hidden] rule is gone, both bubbles read assignee · title; re-verified: a chip's data-tip reads '@claude · Toggle tasks active…' and a pin head's '@scan · Inspect this repository…'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hovering a chip or a pin head shows one tooltip bubble over the map with the assignee and the whole task title (drawn in the map host, so the strip cannot clip it), chips have a hover border, and the island's glass is 40% paper. Verified by dispatched mouseenter and mouseleave in Chrome (bubble text, 6 px above the anchor, centred, hidden on leave) and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
