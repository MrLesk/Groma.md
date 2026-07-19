---
id: GROM-61
title: Complete the branded technical-sheet identity of the local blueprint
status: To Do
assignee: []
created_date: '2026-07-19 22:02'
labels: []
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
- [ ] #1 The sheet carries a drawing title block with the drawing name, CURRENT BLUEPRINT designation, generation, and node count, using only deterministic values (no clock reads)
- [ ] #2 A coordinate frame (numbered columns, lettered rows) and four corner registration marks surround the sheet, drawn deterministically for any sheet height
- [ ] #3 A notation block inside the sheet presents the legend in the STYLE.md visual-semantics drawing language for the states the renderer actually shows, plus convention, scale, and units rows
- [ ] #4 The browser tab shows the frontal mark as a self-contained data-URI favicon, and inline brand markup stays byte-identical to the canonical SVGs in brand/ (verified by test)
- [ ] #5 Palette and typography follow brand/STYLE.md: white sheet, graphite structure, green 1D9E75 only for surveyed points, selection, and the lockup .md suffix; no blueprint blue, no dark mode, no gradients on marks
- [ ] #6 The artifact stays one self-contained deterministic HTML file with no network requests within CLI_MAX_RENDERED_BYTES
- [ ] #7 Renderer tests cover the title block, coordinate frame, notation block, favicon, and brand byte-exactness
<!-- AC:END -->
