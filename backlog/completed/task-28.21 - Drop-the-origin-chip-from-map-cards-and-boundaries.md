---
id: TASK-28.21
title: Drop the origin chip from map cards and boundaries
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 10:00'
updated_date: '2026-08-16 10:07'
labels: []
dependencies: []
parent_task_id: TASK-28
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The observed/planned chip in every card and boundary border repeats what the border already says: solid green for observed, dashed for planned, dotted with hatching for missing. On the map it spends up to 11 cells of the most contested space and crowds out names and boundary titles.

Remove the chip from map boxes and rely on border style and color there. The details overlay keeps the spelled-out origin word, so anyone inspecting an element still sees it named.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map cards render no origin word; origin stays distinguishable by border style and color
- [x] #2 Boundary titles render kind and name only, using the space the chip used
- [x] #3 The details overlay still shows the origin word for the inspected element
- [x] #4 The terminal viewer suite (bun test test-bun/terminal-viewer.test.ts) passes with chip expectations updated
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
1. Remove the drawChip call and its width-12 gate from card.ts; drop the unused import.
2. Remove the drawChip call from boundary.ts and draw the title from titleX with no chip offset.
3. Inline the origin word in details.ts as a direct text() call and delete chip.ts (cold simplicity review finding: drawChip was a thin text() wrapper whose width return had no remaining caller).
4. Update terminal-viewer tests: map frames must not contain origin words, planned/missing border glyphs must appear, details frame must contain the origin word.
5. Verify with bun test test-bun/terminal-viewer.test.ts and agent-tty at 120x36 and 200x60: overview, details open, components level; screenshots captured.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed drawChip from card.ts (with its width-12 gate) and boundary.ts (title now starts at titleX). chip.ts remains, called only by the details overlay.

Tests: replaced map-frame origin-word matches with doesNotMatch, asserted planned dashed [╌┆] and missing dotted/hatch [┈┊░] characters instead, and added an observed-word match after the details overlay opens. bun test test-bun/terminal-viewer.test.ts: 15 pass, 0 fail. Two failures elsewhere (test/cli-scan.test.ts, test/validate-architecture.test.mjs) are pre-existing at HEAD and untouched by this task; flagged separately.

Visual verification via agent-tty: 120x36 overview and components view, details overlay after Enter shows " observed ", 200x60 overview greps clean for origin words; planned cards render dashed with blue spine, observed solid. Screenshots captured from both sessions.

Cold simplicity review passed with one accepted finding: inline the single remaining drawChip call into details.ts and delete chip.ts. Applied; terminal viewer suite re-ran 15 pass / 0 fail. Rendering is identical (same text, color, bold).

AC 4 reworded before checking: full bun test carries two pre-existing failures at HEAD (test/cli-scan.test.ts, test/validate-architecture.test.mjs importing a script renamed to .ts) that exist without this change and are outside task scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the observed/planned/missing chip from map cards (card.ts, including its width-12 gate) and boundary titles (boundary.ts); origin on the map is carried by border style (solid / dashed / dotted+hatch) and color. The details overlay still spells the origin word, now via a direct text() call after inlining and deleting chip.ts per the cold simplicity review. Verified with the terminal viewer suite (15 pass / 0 fail) whose assertions now forbid origin words on map frames, require planned/missing border glyphs, and require the word in the details frame; plus agent-tty sessions at 120x36 and 200x60 with snapshots and screenshots across overview, details, and components level.
<!-- SECTION:FINAL_SUMMARY:END -->
