---
id: GROM-85
title: 'Group, band, and connect the blueprint canvas'
status: To Do
assignee: []
created_date: '2026-07-20 20:57'
labels:
  - pivot
  - web
  - renderer
milestone: m-5
dependencies:
  - GROM-83
  - GROM-84
references:
  - ../expert-career-path/editor/src/graph.ts
priority: high
type: feature
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The canvas renders every component as an identical box in a flat grid: no grouping, no edges, externals as peers of source boundaries, and a legend advertising four scale notations while every node is unscaled. Adopt the grouping model proven by the expert-career-path map: container components become React Flow parent nodes with a title pill, each group lays out independently before groups are packed, externals move to their own dependencies band instead of sitting beside owned code, and observed dependency edges are drawn on the sheet with notation distinct from containment. Node cards carry the evidence already available (file count, dependencies, shared, entry point). Provisional scale from a scan renders in a visibly un-curated notation so a first scan reads as a real diagram without claiming curation. A scale selector sets the deepest visible rung and auto-fits; geometric zoom stays independent and never changes what is shown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Container components render as group nodes with a title, laid out independently and packed without overlap, replacing the flat grid
- [ ] #2 External components render in a separate dependencies band rather than as peers of owned components
- [ ] #3 Observed dependency edges render on the sheet with notation distinct from containment, and edges into externals stay legible rather than forming a hairball
- [ ] #4 Node cards show the observed evidence available for the component, and provisional scale is visually distinct from curated scale
- [ ] #5 A scale selector sets the deepest visible rung and refits, geometric zoom never changes what is shown, and the legend describes only notation present on the sheet
- [ ] #6 Keyboard reachability and brand rules hold; bun run check stays green
<!-- AC:END -->
