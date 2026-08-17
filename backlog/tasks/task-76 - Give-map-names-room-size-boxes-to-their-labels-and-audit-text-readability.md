---
id: TASK-76
title: 'Give map names room: size boxes to their labels and audit text readability'
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 06:09'
updated_date: '2026-08-17 06:13'
labels: []
dependencies: []
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web viewer follow-up from user feedback: centered names on person cards and leaf boxes run edge to edge (e.g. Coding agent, Instructions) because ELK minimum sizes ignore the name length, and canvas maxWidth then compresses the glyphs. Size element boxes from their names in the world layout, keep a safety margin on centered labels, and audit every text drawn on the map (parent slab labels, zone labels, leaf and person names, relationship and flow captions) for readability: no clipping, no glyph squeezing, clear insets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every leaf and person name fits inside its box with a visible margin on both sides and without glyph compression, for all elements of the observed world
- [x] #2 All other map texts (parent slab labels, zone labels, relationship captions) remain readable with clear insets after the resize, verified in the browser at fit and zoomed views
- [x] #3 bun test passes
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
1. In src/world-layout.ts, derive each element node width from its name (per-character width plus side padding, floored by the kind minimum) so ELK sizes boxes to their labels.
2. In src/viewers/web/atoms/label.ts, widen the centered-label safety margin from 0.5 to 2 world units per side.
3. Audit every map text in the browser at fit and zoomed views: leaf/person names, slab and zone labels, relationship and flow captions.
4. bunx tsc, bun test, cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ELK node widths now derive from the name (name.length * 3 + 6, floored by the kind minimum) in world-layout.ts; centered labels keep a 2-world-unit margin per side in drawName. Verified in the browser: at 381% zoom every component name (Navigation spatial, Projection camera, Relationship text, Instructions) fits with clear side margins and no glyph compression; at 195% both person cards fit their names with the head dot clear of the text; slab and zone labels (TERMINAL VIEWER, SCANNER, CLI, GROMA) stay inset; relationship captions unchanged and halo-backed. Cold simplicity review: no accept-worthy findings. bunx tsc clean; bun test 143 pass. Note: sibling order in the tree follows layout x-order, so wider boxes can reorder roots (Human architect now first); this is the documented bounds-driven ordering, not a regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sized map boxes to their names: element node width in the ELK layout is now max(kind minimum, name length * 3 + 6), and centered canvas labels keep a 2-unit side margin instead of a fixed 8px. Audited all map texts in the browser at fit, 195%, and 381%: leaf, person, slab, zone, and relationship texts all readable with clear insets and no glyph squeezing. Verified with screenshots, bunx tsc, and bun test (143 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
