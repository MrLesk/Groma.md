---
id: TASK-41
title: Mark C4 kinds with a shared glyph and color
status: Done
assignee:
  - grok
created_date: '2026-08-16 14:29'
updated_date: '2026-08-16 14:41'
labels: []
dependencies: []
references:
  - src/viewers/tui
documentation:
  - docs/viewers/tui/index.md
priority: high
type: feature
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The tree, map, and details pane do not share an identity for person, system, container, and component. Kind is a leftover box shape on the map, a word in details, and absent from the tree. Give every kind one glyph and one color, used in all three panes. Origin stays line style on the map and a word in details. Selection stays the green spine and does not recolor the mark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The tree, map, and details use the same kind mark: person yellow circle, system cyan square, container blue hollow square, component magenta small square
- [x] #2 External systems use a dim system mark; groups stay unmarked
- [x] #3 The map has no kind or origin words; details spells the kind next to the mark and origin as a word
- [x] #4 Viewer tests cover shared kind marks without asserting decorative color values
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
1. Add kindGlyph/kindLabel and kind colors on the theme (person yellow, system cyan, container bright blue, component magenta). Selection stays the existing accent.
2. Put kind on tree rows. Draw the mark in the tree, on map titles/cards (title uses the kind color), and in details (kind line, children, relationship peers). Dim external systems. Do not recolor the mark when selected.
3. Color map chrome with the kind color. Origin stays solid/dashed/dotted (+ hatch when missing).
4. Update TUI docs. Viewer tests assert the shared glyphs in the tree, map, and details without asserting color values.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Simplicity: dropped kindColor/kindTitle wrappers; title text uses theme[kind]; docs no longer mention the old tree ghost marker. Spec/quality blocked on boundary titles staying foreground and missing tree-glyph coverage; both fixed. bun test test-bun/terminal-viewer.test.ts 21/21; tsc --noEmit pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The tree, map, and details now share one kind mark: ● person, ■ system, □ container, ▪ component, each with its own color. External systems are dim; groups stay unmarked; origin stays line style and a details word. Verified with bun test test-bun/terminal-viewer.test.ts (21/21), tsc, and specification/quality re-review.
<!-- SECTION:FINAL_SUMMARY:END -->
