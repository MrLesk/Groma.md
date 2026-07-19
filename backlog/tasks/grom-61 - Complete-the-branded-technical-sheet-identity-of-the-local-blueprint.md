---
id: GROM-61
title: Complete the branded technical-sheet identity of the local blueprint
status: Done
assignee:
  - '@claude'
created_date: '2026-07-19 22:02'
updated_date: '2026-07-19 22:19'
labels:
  - visualization
  - first-run
  - brand
milestone: m-4
dependencies:
  - GROM-60
references:
  - brand/README.md
  - brand/STYLE.md
  - src/cli/blueprint-html.ts
priority: high
type: feature
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The local artifact carries the canonical lockup but stops short of the approved technical-sheet identity in brand/STYLE.md and the reference mockup: there is no drawing title block, no coordinate frame or registration marks, no notation block in the drawing language, and the browser tab has no favicon. The Visual Blueprint Renderer component's curated intent already requires coordinate and registration notation and following the official brand guides. Complete the branded sheet so the first-run artifact reads as the approved luminous architectural master drawing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The sheet carries a drawing title block with the drawing name, CURRENT BLUEPRINT designation, generation, and node count, using only deterministic values (no clock reads)
- [x] #2 A coordinate frame (numbered columns, lettered rows) and four corner registration marks surround the sheet, drawn deterministically for any sheet height
- [x] #3 A notation block inside the sheet presents the legend in the STYLE.md visual-semantics drawing language for the states the renderer actually shows, plus convention, scale, and units rows
- [x] #4 The browser tab shows the frontal mark as a self-contained data-URI favicon, and inline brand markup stays byte-identical to the canonical SVGs in brand/ (verified by test)
- [x] #5 Palette and typography follow brand/STYLE.md: white sheet, graphite structure, green 1D9E75 only for surveyed points, selection, and the lockup .md suffix; no blueprint blue, no dark mode, no gradients on marks
- [x] #6 The artifact stays one self-contained deterministic HTML file with no network requests within CLI_MAX_RENDERED_BYTES
- [x] #7 Renderer tests cover the title block, coordinate frame, notation block, favicon, and brand byte-exactness
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Give the sheet a technical drawing frame: outer ink border, inner frame rule, absolutely positioned coordinate strips (columns 01-12 top and bottom, rows A-H left and right, muted monospace) that stretch with sheet height, and four corner registration crosshairs in graphite ink (green stays reserved for surveyed points and selection).
2. Replace the plain meta text with a bordered drawing title block at the top right of the sheet: TITLE ARCHITECTURAL BLUEPRINT, DIAGRAM CURRENT BLUEPRINT, GENERATION, NODES, SCALE LOGICAL, UNITS LOGICAL - all deterministic, no clock reads. The canonical lockup stays at top left.
3. Move the notation legend from the overlay panel into a notation block drawn on the sheet bottom-right in the drawing language (boundary line, surveyed root point, containment and view-local notes, convention rows); the overlay keeps selection details, controls, and a compact navigation hint.
4. Embed brand/mark-frontal.svg as a byte-exact inline constant and emit it as the self-contained data-URI favicon.
5. Extend renderer tests: title block, coordinate strips, registration marks, notation block, favicon data URI, and byte-exactness of both inline brand constants against brand/lockup.svg and brand/mark-frontal.svg; keep determinism and no-network assertions.
6. Verify with bun run check plus browser verification of the rendered self-blueprint artifact at desktop width.
Supported boundary: the frame uses fixed 12-column and 8-row label sets at any sheet height; the drawing name is the fixed deterministic ARCHITECTURAL BLUEPRINT title because the bounded overview contract carries no workspace name; favicon rendering uses the frontal mark as shipped (currentColor resolves to black on light tab strips).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/cli/blueprint-html.ts: coordinate strips (columns 01-12 top and bottom, rows A-H left and right) positioned absolutely so they stretch with any sheet height; four graphite corner registration crosshairs; inner frame rule; a two-row drawing title block (TITLE ARCHITECTURAL BLUEPRINT, DIAGRAM CURRENT BLUEPRINT, GENERATION, NODES); a notation footer on the sheet with the legend plus CONVENTION, NOTATION, SCALE, and UNITS rows; and brand/mark-frontal.svg embedded byte-exact and emitted as the data-URI favicon. Green stayed reserved for surveyed points, selection, and the lockup suffix; the drawing name is the fixed deterministic ARCHITECTURAL BLUEPRINT because the bounded overview contract carries no workspace name.
Validation: renderer suite now 3 tests / 41 assertions including byte-exactness of both inline brand constants against brand/lockup.svg and brand/mark-frontal.svg; bun run check green (414 tests plus compiled Iteration 1A black-box). Browser verification of the self-blueprint artifact at 1280px: frame, registration marks, title block, and notation block render correctly at fit and stay crisp at 3x canvas zoom; groma scan afterwards produced a minimal canonical diff (only the changed file's fingerprint and epoch bookkeeping) with curated intent untouched, and the generation-141 artifact rendered end-to-end.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The local blueprint artifact now carries the complete approved technical-sheet identity: coordinate frame, corner registration marks, drawing title block, on-sheet notation block, byte-exact canonical lockup, and a self-contained frontal-mark favicon, all deterministic with green kept to the surveyed accent. Verified with the extended renderer tests, the full bun run check gate, browser inspection at fit and 3x zoom, and a post-change self-scan whose canonical diff stayed minimal with intent preserved.
<!-- SECTION:FINAL_SUMMARY:END -->
