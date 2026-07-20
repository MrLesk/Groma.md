---
id: GROM-85
title: 'Group, band, and connect the blueprint canvas'
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 20:57'
updated_date: '2026-07-20 21:18'
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
- [x] #1 Container components render as group nodes with a title, laid out independently and packed without overlap, replacing the flat grid
- [x] #2 External components render in a separate dependencies band rather than as peers of owned components
- [x] #3 Observed dependency edges render on the sheet with notation distinct from containment, and edges into externals stay legible rather than forming a hairball
- [x] #4 Node cards show the observed evidence available for the component, and provisional scale is visually distinct from curated scale
- [x] #5 A scale selector sets the deepest visible rung and refits, geometric zoom never changes what is shown, and the legend describes only notation present on the sheet
- [x] #6 Keyboard reachability and brand rules hold; bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the web API/model so the canvas has dependency edges and observed evidence per component (relationships already exist per component; add a bounded blueprint-wide edge read).
2. graph.ts: container components become React Flow parent nodes with reserved title space, children positioned inside; externals partition into a dependencies band; dependency edges styled distinctly from containment nesting.
3. canvas.tsx: scale selector sets deepest visible rung with refit; geometric zoom untouched; legend renders only notation present.
4. Node cards carry observed evidence; provisional scale distinct from curated.
5. Browser verification against the compiled binary plus bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Container components now render as React Flow parent plates with a title pill and reserved title height, children nested inside with extent parent, each group laid out independently before groups are packed across the sheet — the grouping model from the expert-career-path map. Group contents are arranged by the dependency edges among the siblings, so a group reads left to right along its own dependency order rather than as a bare stack; in this repo that puts cli at the left and core at the right without anyone saying so. Containment is carried by nesting, which freed edges to mean dependency: a new bounded /api/connections route backed by exportBlueprint gives the canvas one page of components with their relationships, drawn as dependency edges with external targets dashed and faded. Externals moved into their own dependencies band instead of sitting beside owned code. Cards carry the observed evidence that already existed but was never shown: shared, entry, link count, contained count. The legend now lists only notation present on the sheet. The scale selector sets the deepest visible rung and refits; geometric zoom is untouched, so semantics never change under the user's hands. Two layout bugs found in the browser: sheet roots were derived from component.parent while the canvas hierarchy actually comes from loaded childIds, which duplicated every nested node, and a constant graph-space margin could not clear the fixed title block because fitView normalizes constant offsets — replaced with asymmetric fitView padding. Supported boundary: dependency edges come from one bounded connections page, so a blueprint larger than that page draws the edges it has read rather than claiming completeness. Verified against the compiled binary in the browser at each step; bun run check green at 451 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The canvas now groups, bands, and connects: containers are plates their contents nest inside, contents are ordered by their own dependencies, externals sit in a dependencies band, observed dependency edges are drawn, cards carry observed evidence, and a scale selector chooses the deepest visible rung while zoom only changes size. A plain groma scan of this repository now renders a readable architecture diagram with no human or agent annotation.
<!-- SECTION:FINAL_SUMMARY:END -->
